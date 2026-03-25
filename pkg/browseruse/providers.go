package browseruse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

const (
	providerKeyBrowserUse = "browser-use"
	providerKeyBrowserbase = "browserbase"
)

type CloudSession struct {
	SessionName       string
	Provider          string
	ProviderSessionID string
	CDPURL            string
	Features          map[string]bool
	CreatedAt         time.Time
}

type ConnectResult struct {
	Status    Status
	Session   CloudSession
	Args      []string
	Output    string
	Attached  bool
	Fallback  bool
}

type CloseResult struct {
	Status      Status
	SessionName string
	Closed      []string
	Failed      []string
	Output      string
	Fallback    bool
}

type cloudProvider interface {
	Key() string
	DisplayName() string
	IsConfigured(config.BrowserUseToolConfig) bool
	CreateSession(context.Context, config.BrowserUseToolConfig, string) (*CloudSession, error)
	CloseSession(context.Context, config.BrowserUseToolConfig, string) error
}

func resolveCloudProviderKey(cfg config.BrowserUseToolConfig) string {
	switch normalizedProviderKey(cfg.CloudProvider) {
	case providerKeyBrowserUse, providerKeyBrowserbase:
		return normalizedProviderKey(cfg.CloudProvider)
	case "", "auto":
		if strings.TrimSpace(cfg.APIKey) != "" {
			return providerKeyBrowserUse
		}
		if strings.TrimSpace(cfg.BrowserbaseAPIKey) != "" && strings.TrimSpace(cfg.BrowserbaseProjectID) != "" {
			return providerKeyBrowserbase
		}
		return ""
	default:
		return ""
	}
}

func normalizedProviderKey(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "auto":
		return strings.ToLower(strings.TrimSpace(raw))
	case "browser-use", "browseruse", "browser_use":
		return providerKeyBrowserUse
	case "browserbase":
		return providerKeyBrowserbase
	case "none", "off", "disabled", "local":
		return ""
	default:
		return ""
	}
}

func providerDisplayName(key string) string {
	switch key {
	case providerKeyBrowserUse:
		return "Browser Use"
	case providerKeyBrowserbase:
		return "Browserbase"
	default:
		return "local"
	}
}

func providerConfigured(key string, cfg config.BrowserUseToolConfig) bool {
	switch key {
	case providerKeyBrowserUse:
		return strings.TrimSpace(cfg.APIKey) != ""
	case providerKeyBrowserbase:
		return strings.TrimSpace(cfg.BrowserbaseAPIKey) != "" && strings.TrimSpace(cfg.BrowserbaseProjectID) != ""
	default:
		return false
	}
}

func providerForConfig(cfg config.BrowserUseToolConfig) cloudProvider {
	switch resolveCloudProviderKey(cfg) {
	case providerKeyBrowserUse:
		return browserUseProvider{}
	case providerKeyBrowserbase:
		return browserbaseProvider{}
	default:
		return nil
	}
}

func Connect(ctx context.Context, cfg config.BrowserUseToolConfig) (*ConnectResult, error) {
	status := Inspect(cfg)
	if !status.Installed {
		return &ConnectResult{Status: status}, fmt.Errorf("browser-use CLI is not installed")
	}

	provider := providerForConfig(cfg)
	if provider == nil {
		runResult, err := Run(ctx, cfg, "cloud", "connect")
		result := &ConnectResult{
			Status:   runResult.Status,
			Args:     runResult.Args,
			Output:   runResult.Output,
			Fallback: true,
		}
		if err != nil {
			return result, err
		}
		return result, nil
	}
	if !provider.IsConfigured(cfg) {
		return &ConnectResult{Status: status}, fmt.Errorf("%s is not configured", provider.DisplayName())
	}

	sessionName := strings.TrimSpace(cfg.Session)
	if sessionName == "" {
		sessionName = "default"
	}
	session, err := provider.CreateSession(ctx, cfg, sessionName)
	if err != nil {
		return &ConnectResult{Status: status}, fmt.Errorf("%s connect failed: %w", provider.DisplayName(), err)
	}

	attachCfg := cfg
	attachCfg.Session = sessionName
	attachCfg.Connect = false
	attachCfg.Profile = ""
	attachCfg.CDPURL = session.CDPURL

	runResult, runErr := Run(ctx, attachCfg, "open", "about:blank")
	if runErr != nil {
		_ = provider.CloseSession(ctx, cfg, session.ProviderSessionID)
		return &ConnectResult{
			Status:  status,
			Session: *session,
			Args:    runResult.Args,
			Output:  runResult.Output,
		}, runErr
	}

	if err := upsertManagedSession(cfg, managedSession{
		SessionName:       session.SessionName,
		Provider:          session.Provider,
		ProviderSessionID: session.ProviderSessionID,
		CDPURL:            session.CDPURL,
		CreatedAt:         session.CreatedAt,
	}); err != nil {
		return &ConnectResult{
			Status:   runResult.Status,
			Session:  *session,
			Args:     runResult.Args,
			Output:   runResult.Output,
			Attached: true,
		}, fmt.Errorf("connected but failed to persist session metadata: %w", err)
	}

	return &ConnectResult{
		Status:   runResult.Status,
		Session:  *session,
		Args:     runResult.Args,
		Output:   runResult.Output,
		Attached: true,
	}, nil
}

func Close(ctx context.Context, cfg config.BrowserUseToolConfig, sessionName string, all bool) (*CloseResult, error) {
	status := Inspect(cfg)
	result := &CloseResult{Status: status}

	if all {
		sessions, err := listManagedSessions(cfg)
		if err == nil {
			for _, entry := range sessions {
				if err := closeManagedSession(ctx, cfg, entry); err != nil {
					result.Failed = append(result.Failed, entry.SessionName)
				} else {
					result.Closed = append(result.Closed, entry.SessionName)
					_ = deleteManagedSession(cfg, entry.SessionName)
				}
			}
		}
		if status.Installed {
			runResult, err := Run(ctx, cfg, "close", "--all")
			result.Output = runResult.Output
			result.Fallback = true
			if err != nil && len(result.Closed) == 0 {
				return result, err
			}
		}
		return result, nil
	}

	if strings.TrimSpace(sessionName) == "" {
		sessionName = status.Session
	}
	result.SessionName = sessionName

	entry, found, err := getManagedSession(cfg, sessionName)
	if err == nil && found {
		if closeErr := closeManagedSession(ctx, cfg, entry); closeErr != nil {
			result.Failed = append(result.Failed, sessionName)
			return result, closeErr
		}
		result.Closed = append(result.Closed, sessionName)
		_ = deleteManagedSession(cfg, sessionName)
	}

	if status.Installed {
		runResult, err := Run(ctx, cfg, "--session", sessionName, "close")
		result.Output = runResult.Output
		result.Fallback = true
		if err != nil && len(result.Closed) == 0 {
			return result, err
		}
	}

	return result, nil
}

func closeManagedSession(ctx context.Context, cfg config.BrowserUseToolConfig, session managedSession) error {
	provider := providerForKey(session.Provider)
	if provider == nil {
		return fmt.Errorf("unknown cloud provider %q", session.Provider)
	}
	if strings.TrimSpace(session.ProviderSessionID) == "" {
		return nil
	}
	return provider.CloseSession(ctx, cfg, session.ProviderSessionID)
}

func providerForKey(key string) cloudProvider {
	switch normalizedProviderKey(key) {
	case providerKeyBrowserUse:
		return browserUseProvider{}
	case providerKeyBrowserbase:
		return browserbaseProvider{}
	default:
		return nil
	}
}

type browserUseProvider struct{}

func (browserUseProvider) Key() string { return providerKeyBrowserUse }
func (browserUseProvider) DisplayName() string { return "Browser Use" }
func (browserUseProvider) IsConfigured(cfg config.BrowserUseToolConfig) bool {
	return strings.TrimSpace(cfg.APIKey) != ""
}
func (browserUseProvider) CreateSession(ctx context.Context, cfg config.BrowserUseToolConfig, sessionName string) (*CloudSession, error) {
	payload, err := doJSON(ctx, http.MethodPost, "https://api.browser-use.com/api/v2/browsers", map[string]string{
		"Content-Type":           "application/json",
		"X-Browser-Use-API-Key": strings.TrimSpace(cfg.APIKey),
	}, map[string]any{}, 30*time.Second)
	if err != nil {
		return nil, err
	}
	var body struct {
		ID     string `json:"id"`
		CDPURL string `json:"cdpUrl"`
	}
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, fmt.Errorf("decode Browser Use response: %w", err)
	}
	return &CloudSession{
		SessionName:       sessionName,
		Provider:          providerKeyBrowserUse,
		ProviderSessionID: body.ID,
		CDPURL:            body.CDPURL,
		Features:          map[string]bool{"browser_use": true},
		CreatedAt:         time.Now().UTC(),
	}, nil
}
func (browserUseProvider) CloseSession(ctx context.Context, cfg config.BrowserUseToolConfig, sessionID string) error {
	_, err := doJSON(ctx, http.MethodPatch, "https://api.browser-use.com/api/v2/browsers/"+sessionID, map[string]string{
		"Content-Type":           "application/json",
		"X-Browser-Use-API-Key": strings.TrimSpace(cfg.APIKey),
	}, map[string]any{"action": "stop"}, 10*time.Second)
	return err
}

type browserbaseProvider struct{}

func (browserbaseProvider) Key() string { return providerKeyBrowserbase }
func (browserbaseProvider) DisplayName() string { return "Browserbase" }
func (browserbaseProvider) IsConfigured(cfg config.BrowserUseToolConfig) bool {
	return strings.TrimSpace(cfg.BrowserbaseAPIKey) != "" && strings.TrimSpace(cfg.BrowserbaseProjectID) != ""
}
func (browserbaseProvider) CreateSession(ctx context.Context, cfg config.BrowserUseToolConfig, sessionName string) (*CloudSession, error) {
	headers := map[string]string{
		"Content-Type": "application/json",
		"X-BB-API-Key": strings.TrimSpace(cfg.BrowserbaseAPIKey),
	}

	requestBody := map[string]any{
		"projectId": strings.TrimSpace(cfg.BrowserbaseProjectID),
	}
	if cfg.BrowserbaseKeepAlive {
		requestBody["keepAlive"] = true
	}
	if cfg.BrowserbaseTimeoutMS > 0 {
		requestBody["timeout"] = cfg.BrowserbaseTimeoutMS
	}
	if cfg.BrowserbaseProxies {
		requestBody["proxies"] = true
	}
	if cfg.BrowserbaseStealth {
		requestBody["browserSettings"] = map[string]bool{"advancedStealth": true}
	}

	payload, statusCode, err := doJSONWithStatus(ctx, http.MethodPost, "https://api.browserbase.com/v1/sessions", headers, requestBody, 30*time.Second)
	if err != nil && statusCode == http.StatusPaymentRequired {
		if cfg.BrowserbaseKeepAlive {
			delete(requestBody, "keepAlive")
			payload, statusCode, err = doJSONWithStatus(ctx, http.MethodPost, "https://api.browserbase.com/v1/sessions", headers, requestBody, 30*time.Second)
		}
		if err != nil && statusCode == http.StatusPaymentRequired && cfg.BrowserbaseProxies {
			delete(requestBody, "proxies")
			payload, _, err = doJSONWithStatus(ctx, http.MethodPost, "https://api.browserbase.com/v1/sessions", headers, requestBody, 30*time.Second)
		}
	}
	if err != nil {
		return nil, err
	}

	var body struct {
		ID         string `json:"id"`
		ConnectURL string `json:"connectUrl"`
	}
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, fmt.Errorf("decode Browserbase response: %w", err)
	}
	return &CloudSession{
		SessionName:       sessionName,
		Provider:          providerKeyBrowserbase,
		ProviderSessionID: body.ID,
		CDPURL:            body.ConnectURL,
		Features: map[string]bool{
			"browserbase":        true,
			"proxies":            cfg.BrowserbaseProxies,
			"advanced_stealth":   cfg.BrowserbaseStealth,
			"keep_alive":         cfg.BrowserbaseKeepAlive,
			"custom_timeout_ms":  cfg.BrowserbaseTimeoutMS > 0,
		},
		CreatedAt: time.Now().UTC(),
	}, nil
}
func (browserbaseProvider) CloseSession(ctx context.Context, cfg config.BrowserUseToolConfig, sessionID string) error {
	_, err := doJSON(ctx, http.MethodPost, "https://api.browserbase.com/v1/sessions/"+sessionID, map[string]string{
		"Content-Type": "application/json",
		"X-BB-API-Key": strings.TrimSpace(cfg.BrowserbaseAPIKey),
	}, map[string]any{
		"projectId": strings.TrimSpace(cfg.BrowserbaseProjectID),
		"status":    "REQUEST_RELEASE",
	}, 10*time.Second)
	return err
}

func doJSON(ctx context.Context, method, url string, headers map[string]string, body any, timeout time.Duration) ([]byte, error) {
	payload, _, err := doJSONWithStatus(ctx, method, url, headers, body, timeout)
	return payload, err
}

func doJSONWithStatus(ctx context.Context, method, url string, headers map[string]string, body any, timeout time.Duration) ([]byte, int, error) {
	var raw io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		raw = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, raw)
	if err != nil {
		return nil, 0, err
	}
	for k, v := range headers {
		if strings.TrimSpace(v) != "" {
			req.Header.Set(k, v)
		}
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, resp.StatusCode, fmt.Errorf("http %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return data, resp.StatusCode, nil
}

type managedSession struct {
	SessionName       string    `json:"session_name"`
	Provider          string    `json:"provider"`
	ProviderSessionID string    `json:"provider_session_id"`
	CDPURL            string    `json:"cdp_url"`
	CreatedAt         time.Time `json:"created_at"`
}

type managedSessionFile struct {
	Sessions []managedSession `json:"sessions"`
}

func managedSessionsPath(cfg config.BrowserUseToolConfig) string {
	return filepath.Join(toolHome(cfg), "cloud-sessions.json")
}

func listManagedSessions(cfg config.BrowserUseToolConfig) ([]managedSession, error) {
	store, err := loadManagedSessionFile(cfg)
	if err != nil {
		return nil, err
	}
	return store.Sessions, nil
}

func getManagedSession(cfg config.BrowserUseToolConfig, sessionName string) (managedSession, bool, error) {
	store, err := loadManagedSessionFile(cfg)
	if err != nil {
		return managedSession{}, false, err
	}
	for _, session := range store.Sessions {
		if session.SessionName == sessionName {
			return session, true, nil
		}
	}
	return managedSession{}, false, nil
}

func upsertManagedSession(cfg config.BrowserUseToolConfig, session managedSession) error {
	store, err := loadManagedSessionFile(cfg)
	if err != nil {
		return err
	}
	replaced := false
	for i := range store.Sessions {
		if store.Sessions[i].SessionName == session.SessionName {
			store.Sessions[i] = session
			replaced = true
			break
		}
	}
	if !replaced {
		store.Sessions = append(store.Sessions, session)
	}
	return writeManagedSessionFile(cfg, store)
}

func deleteManagedSession(cfg config.BrowserUseToolConfig, sessionName string) error {
	store, err := loadManagedSessionFile(cfg)
	if err != nil {
		return err
	}
	filtered := store.Sessions[:0]
	for _, session := range store.Sessions {
		if session.SessionName != sessionName {
			filtered = append(filtered, session)
		}
	}
	store.Sessions = filtered
	return writeManagedSessionFile(cfg, store)
}

func loadManagedSessionFile(cfg config.BrowserUseToolConfig) (*managedSessionFile, error) {
	path := managedSessionsPath(cfg)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &managedSessionFile{}, nil
		}
		return nil, err
	}
	var store managedSessionFile
	if len(data) == 0 {
		return &managedSessionFile{}, nil
	}
	if err := json.Unmarshal(data, &store); err != nil {
		return nil, err
	}
	return &store, nil
}

func writeManagedSessionFile(cfg config.BrowserUseToolConfig, store *managedSessionFile) error {
	dir := toolHome(cfg)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	path := managedSessionsPath(cfg)
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
