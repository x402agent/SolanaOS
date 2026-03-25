package browseruse

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

const binaryName = "browser-use"

type Status struct {
	Enabled          bool
	Installed        bool
	APIKeyConfigured bool
	Headed           bool
	Cloud            bool
	CloudProvider    string
	ProviderReady    bool
	BinaryPath       string
	Home             string
	Session          string
	Profile          string
	Connect          bool
	CDPURL           string
	CloudProfileID   string
	CloudProxy       string
	CloudTimeoutMin  int
	BrowserbaseProjectID string
}

type ActivationResult struct {
	Status Status
	Output string
}

type RunResult struct {
	Status Status
	Args   []string
	Output string
}

func Inspect(cfg config.BrowserUseToolConfig) Status {
	providerKey := resolveCloudProviderKey(cfg)
	status := Status{
		Enabled:              cfg.Enabled,
		APIKeyConfigured:     strings.TrimSpace(cfg.APIKey) != "",
		Headed:               cfg.Headed,
		Cloud:                cfg.Cloud,
		CloudProvider:        providerDisplayName(providerKey),
		ProviderReady:        providerConfigured(providerKey, cfg),
		Home:                 toolHome(cfg),
		Session:              strings.TrimSpace(cfg.Session),
		Profile:              strings.TrimSpace(cfg.Profile),
		Connect:              cfg.Connect,
		CDPURL:               strings.TrimSpace(cfg.CDPURL),
		CloudProfileID:       strings.TrimSpace(cfg.CloudProfileID),
		CloudProxy:           strings.TrimSpace(cfg.CloudProxyCountryCode),
		CloudTimeoutMin:      cfg.CloudTimeoutMinutes,
		BrowserbaseProjectID: strings.TrimSpace(cfg.BrowserbaseProjectID),
	}
	if status.Session == "" {
		status.Session = "default"
	}
	if path, err := resolveBinary(cfg); err == nil {
		status.Installed = true
		status.BinaryPath = path
	}
	return status
}

func Activate(ctx context.Context, cfg config.BrowserUseToolConfig) (*ActivationResult, error) {
	status := Inspect(cfg)
	if resolveCloudProviderKey(cfg) == providerKeyBrowserbase {
		return &ActivationResult{
			Status: status,
			Output: "Browserbase uses API-key session provisioning. No browser-use cloud login is required; run `solanaos browseruse connect`.",
		}, nil
	}
	if !status.Installed {
		return &ActivationResult{Status: status}, fmt.Errorf("browser-use CLI is not installed")
	}
	if !status.APIKeyConfigured {
		return &ActivationResult{Status: status}, fmt.Errorf("BROWSERUSE_API_KEY is not configured")
	}

	cmd := exec.CommandContext(ctx, status.BinaryPath, "cloud", "login", cfg.APIKey)
	cmd.Env = commandEnv(cfg)
	output, err := cmd.CombinedOutput()
	result := &ActivationResult{
		Status: status,
		Output: strings.TrimSpace(string(output)),
	}
	if err != nil {
		return result, wrapCommandError("browser-use cloud login failed", err, result.Output)
	}
	return result, nil
}

func Run(ctx context.Context, cfg config.BrowserUseToolConfig, args ...string) (*RunResult, error) {
	status := Inspect(cfg)
	if !status.Installed {
		return &RunResult{Status: status, Args: args}, fmt.Errorf("browser-use CLI is not installed")
	}
	finalArgs := applyDefaults(cfg, args)
	cmd := exec.CommandContext(ctx, status.BinaryPath, finalArgs...)
	cmd.Env = commandEnv(cfg)
	output, err := cmd.CombinedOutput()
	result := &RunResult{
		Status: status,
		Args:   finalArgs,
		Output: strings.TrimSpace(string(output)),
	}
	if err != nil {
		return result, wrapCommandError("browser-use command failed", err, result.Output)
	}
	return result, nil
}

func resolveBinary(cfg config.BrowserUseToolConfig) (string, error) {
	for _, candidate := range preferredBinaryCandidates(cfg) {
		if candidate == "" {
			continue
		}
		if strings.Contains(candidate, string(os.PathSeparator)) {
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() && info.Mode()&0o111 != 0 {
				return candidate, nil
			}
			continue
		}
		if path, err := exec.LookPath(candidate); err == nil {
			return path, nil
		}
	}
	return "", exec.ErrNotFound
}

func preferredBinaryCandidates(cfg config.BrowserUseToolConfig) []string {
	configured := strings.TrimSpace(cfg.BinaryPath)
	defaults := preferredBinaryCandidatesFromHome()
	if configured == "" {
		return defaults
	}
	return append([]string{configured}, defaults...)
}

func preferredBinaryCandidatesFromHome() []string {
	home, _ := os.UserHomeDir()
	return []string{
		filepath.Join(home, ".browser-use-env", "bin", binaryName),
		binaryName,
		filepath.Join("/Library/Frameworks/Python.framework/Versions/3.13/bin", binaryName),
	}
}

func toolHome(cfg config.BrowserUseToolConfig) string {
	if home := strings.TrimSpace(cfg.Home); home != "" {
		return home
	}
	userHome, _ := os.UserHomeDir()
	return filepath.Join(userHome, ".browser-use")
}

func commandEnv(cfg config.BrowserUseToolConfig) []string {
	env := os.Environ()
	pathValue := os.Getenv("PATH")
	pathParts := []string{}

	if home, err := os.UserHomeDir(); err == nil {
		pathParts = append(pathParts,
			filepath.Join(home, ".browser-use-env", "bin"),
			filepath.Join(toolHome(cfg), "bin"),
		)
	}
	if strings.TrimSpace(pathValue) != "" {
		pathParts = append(pathParts, pathValue)
	}

	env = append(env, "PATH="+strings.Join(pathParts, string(os.PathListSeparator)))
	if apiKey := strings.TrimSpace(cfg.APIKey); apiKey != "" {
		env = append(env,
			"BROWSER_USE_API_KEY="+apiKey,
			"BROWSERUSE_API_KEY="+apiKey,
		)
	}
	if home := strings.TrimSpace(toolHome(cfg)); home != "" {
		env = append(env,
			"BROWSER_USE_HOME="+home,
			"BROWSERUSE_HOME="+home,
		)
	}
	if apiKey := strings.TrimSpace(cfg.BrowserbaseAPIKey); apiKey != "" {
		env = append(env, "BROWSERBASE_API_KEY="+apiKey)
	}
	if projectID := strings.TrimSpace(cfg.BrowserbaseProjectID); projectID != "" {
		env = append(env, "BROWSERBASE_PROJECT_ID="+projectID)
	}
	return env
}

func applyDefaults(cfg config.BrowserUseToolConfig, args []string) []string {
	finalArgs := make([]string, 0, len(args)+10)
	commandArgs := leadingCommandArgs(args)

	if cfg.Headed && shouldApplyBrowserMode(commandArgs) && !containsFlag(args, "--headed") {
		finalArgs = append(finalArgs, "--headed")
	}
	if shouldApplySession(commandArgs) {
		if session := strings.TrimSpace(cfg.Session); session != "" && !containsFlag(args, "--session") {
			finalArgs = append(finalArgs, "--session", session)
		}
	}
	if shouldApplyBrowserMode(commandArgs) && !hasBrowserModeOverride(args) {
		switch {
		case strings.TrimSpace(cfg.CDPURL) != "":
			finalArgs = append(finalArgs, "--cdp-url", strings.TrimSpace(cfg.CDPURL))
		case cfg.Connect:
			finalArgs = append(finalArgs, "--connect")
		case strings.TrimSpace(cfg.Profile) != "":
			finalArgs = append(finalArgs, "--profile", strings.TrimSpace(cfg.Profile))
		}
	}
	finalArgs = append(finalArgs, applyCloudConnectDefaults(cfg, args)...)
	return finalArgs
}

func applyCloudConnectDefaults(cfg config.BrowserUseToolConfig, args []string) []string {
	if !isCloudConnectCommand(leadingCommandArgs(args)) {
		return append([]string{}, args...)
	}

	finalArgs := append([]string{}, args...)
	if profileID := strings.TrimSpace(cfg.CloudProfileID); profileID != "" && !containsFlag(finalArgs, "--profile-id") {
		finalArgs = append(finalArgs, "--profile-id", profileID)
	}
	if proxyCountry := strings.TrimSpace(cfg.CloudProxyCountryCode); proxyCountry != "" && !containsFlag(finalArgs, "--proxy-country") {
		finalArgs = append(finalArgs, "--proxy-country", proxyCountry)
	}
	if cfg.CloudTimeoutMinutes > 0 && !containsFlag(finalArgs, "--timeout") {
		finalArgs = append(finalArgs, "--timeout", strconv.Itoa(cfg.CloudTimeoutMinutes))
	}
	return finalArgs
}

func containsFlag(args []string, flag string) bool {
	for i := 0; i < len(args); i++ {
		arg := strings.TrimSpace(args[i])
		if arg == flag || strings.HasPrefix(arg, flag+"=") {
			return true
		}
	}
	return false
}

func hasBrowserModeOverride(args []string) bool {
	return containsFlag(args, "--profile") || containsFlag(args, "--connect") || containsFlag(args, "--cdp-url")
}

func leadingCommandArgs(args []string) []string {
	i := 0
	for i < len(args) {
		arg := strings.TrimSpace(args[i])
		if arg == "" {
			i++
			continue
		}
		if !strings.HasPrefix(arg, "-") {
			break
		}
		if strings.HasPrefix(arg, "--profile=") || strings.HasPrefix(arg, "--session=") || strings.HasPrefix(arg, "--cdp-url=") {
			i++
			continue
		}
		switch arg {
		case "--headed", "--json", "--mcp", "--connect":
			i++
		case "--profile", "--session", "--cdp-url":
			if i+1 < len(args) {
				i += 2
			} else {
				i++
			}
		default:
			i++
		}
	}
	return args[i:]
}

func shouldApplyBrowserMode(args []string) bool {
	if len(args) == 0 {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(args[0])) {
	case "sessions", "profile", "tunnel", "close":
		return false
	case "cloud":
		return false
	default:
		return true
	}
}

func shouldApplySession(args []string) bool {
	if len(args) == 0 {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(args[0])) {
	case "sessions", "profile", "tunnel":
		return false
	case "cloud":
		return isCloudConnectCommand(args)
	case "close":
		return !containsFlag(args, "--all")
	default:
		return true
	}
}

func isCloudConnectCommand(args []string) bool {
	return len(args) >= 2 &&
		strings.EqualFold(strings.TrimSpace(args[0]), "cloud") &&
		strings.EqualFold(strings.TrimSpace(args[1]), "connect")
}

func wrapCommandError(prefix string, err error, output string) error {
	if strings.Contains(output, "ModuleNotFoundError: No module named 'browser_use'") {
		return fmt.Errorf("%s: broken browser-use install detected; your shell is likely resolving a stale binary. Prefer ~/.browser-use-env/bin/browser-use or reinstall with the official installer", prefix)
	}
	if strings.TrimSpace(output) == "" {
		return fmt.Errorf("%s: %w", prefix, err)
	}
	return fmt.Errorf("%s: %w: %s", prefix, err, output)
}
