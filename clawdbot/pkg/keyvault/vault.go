// Package keyvault reads a local env-file vault and enforces IP allowlists.
package keyvault

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const (
	EnvVaultEnabled    = "CLAWDBOT_VAULT_ENABLED"
	EnvVaultFile       = "CLAWDBOT_VAULT_ENV_FILE"
	EnvVaultAllowedIPs = "CLAWDBOT_VAULT_ALLOWED_IPS"
	EnvVaultToken      = "CLAWDBOT_VAULT_TOKEN"
	EnvKeysToken       = "CLAWDBOT_KEYS_TOKEN"
)

type Vault struct {
	Path       string
	Values     map[string]string
	Control    map[string]string
	AllowedIPs []string
	Enabled    bool
}

type Status struct {
	Enabled         bool     `json:"enabled"`
	Source          string   `json:"source"`
	Keys            int      `json:"keys"`
	TokenConfigured bool     `json:"tokenConfigured"`
	AllowedIPs      []string `json:"allowedIps"`
}

func Load(path string) (*Vault, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		path = os.Getenv(EnvVaultFile)
	}
	if path == "" {
		path = ".env.local"
	}
	if abs, err := filepath.Abs(path); err == nil {
		path = abs
	}

	values, err := parseFile(path)
	if err != nil {
		return nil, err
	}
	control := readControl(values)
	enabled := truthy(firstNonEmpty(os.Getenv(EnvVaultEnabled), control[EnvVaultEnabled]))
	allowed := splitCSV(firstNonEmpty(os.Getenv(EnvVaultAllowedIPs), control[EnvVaultAllowedIPs]))
	if len(allowed) == 0 {
		allowed = []string{"127.0.0.1", "::1"}
	}
	return &Vault{
		Path:       path,
		Values:     values,
		Control:    control,
		AllowedIPs: allowed,
		Enabled:    enabled,
	}, nil
}

func (v *Vault) Status() Status {
	return Status{
		Enabled:         v.Enabled,
		Source:          v.Path,
		Keys:            len(v.Keys()),
		TokenConfigured: v.Token() != "",
		AllowedIPs:      append([]string(nil), v.AllowedIPs...),
	}
}

func (v *Vault) Token() string {
	return firstNonEmpty(os.Getenv(EnvVaultToken), os.Getenv(EnvKeysToken), v.Control[EnvVaultToken], v.Control[EnvKeysToken])
}

func (v *Vault) Keys() []string {
	keys := make([]string, 0, len(v.Values))
	for key := range v.Values {
		if isControlKey(key) {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (v *Vault) Get(name string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" || isControlKey(name) {
		return "", false
	}
	value, ok := v.Values[name]
	return value, ok
}

func (v *Vault) Export(names []string) string {
	if len(names) == 0 {
		names = v.Keys()
	}
	var b strings.Builder
	for _, name := range names {
		value, ok := v.Get(name)
		if !ok {
			continue
		}
		b.WriteString("export ")
		b.WriteString(name)
		b.WriteString("=")
		b.WriteString(shellQuote(value))
		b.WriteByte('\n')
	}
	return b.String()
}

func (v *Vault) ClientAllowed(clientIP string) bool {
	ip := net.ParseIP(strings.TrimSpace(clientIP))
	if ip == nil {
		return false
	}
	for _, entry := range v.AllowedIPs {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if entry == "*" {
			return true
		}
		if _, network, err := net.ParseCIDR(entry); err == nil {
			if network.Contains(ip) {
				return true
			}
			continue
		}
		if allowed := net.ParseIP(entry); allowed != nil && allowed.Equal(ip) {
			return true
		}
	}
	return false
}

func parseFile(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("read vault env file: %w", err)
	}
	defer file.Close()

	values := make(map[string]string)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if !validKey(key) {
			continue
		}
		values[key] = unquote(strings.TrimSpace(value))
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("parse vault env file: %w", err)
	}
	return values, nil
}

func readControl(values map[string]string) map[string]string {
	control := make(map[string]string)
	for _, key := range []string{EnvVaultEnabled, EnvVaultFile, EnvVaultAllowedIPs, EnvVaultToken, EnvKeysToken} {
		if value, ok := values[key]; ok {
			control[key] = value
		}
	}
	return control
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func validKey(key string) bool {
	if key == "" {
		return false
	}
	for i, r := range key {
		if r == '_' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || i > 0 && r >= '0' && r <= '9' {
			continue
		}
		return false
	}
	return true
}

func unquote(value string) string {
	if value == "" {
		return value
	}
	if parsed, err := strconv.Unquote(value); err == nil {
		return parsed
	}
	if strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'") && len(value) >= 2 {
		return strings.TrimSuffix(strings.TrimPrefix(value, "'"), "'")
	}
	return value
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func isControlKey(key string) bool {
	switch strings.TrimSpace(key) {
	case EnvVaultEnabled, EnvVaultFile, EnvVaultAllowedIPs, EnvVaultToken, EnvKeysToken:
		return true
	default:
		return false
	}
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
