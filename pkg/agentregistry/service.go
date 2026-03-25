package agentregistry

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/pumplaunch"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

const stateFileName = "agent-registry.json"

// retryDelays defines backoff intervals for failed sync attempts.
var retryDelays = []time.Duration{2 * time.Second, 5 * time.Second, 12 * time.Second}

// SyncInput carries per-trigger dynamic fields merged with config at sync time.
type SyncInput struct {
	Trigger       string
	Mode          string
	PetName       string
	PetStage      string
	PetMood       string
	Watchlist     []string
	HeartbeatPath string

	// Optional capability flags injected by the daemon.
	HyperliquidEnabled bool
	HyperliquidWallet  string
	HonchoEnabled      bool
	HonchoWorkspace    string
	GrokEnabled        bool
}

// SyncResult is the outcome of one sync attempt.
type SyncResult struct {
	Trigger    string
	Attempt    int
	OK         bool
	Error      string
	SyncedAt   time.Time
	DurationMs int64
}

// Service manages agent-registry syncs. All exported methods are nil-safe.
type Service struct {
	cfg    *config.Config
	wallet *solana.Wallet

	mu          sync.Mutex
	running     bool
	syncCount   int
	errorCount  int
	lastOK      *SyncResult
	lastErr     *SyncResult
	lastTrigger time.Time
}

func New(cfg *config.Config, wallet *solana.Wallet) *Service {
	if cfg == nil || wallet == nil || !cfg.Registry.Enabled {
		return nil
	}
	return &Service{cfg: cfg, wallet: wallet}
}

// Status returns a snapshot of sync activity. Safe to call on nil.
func (s *Service) Status() map[string]any {
	if s == nil {
		return map[string]any{"enabled": false}
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	m := map[string]any{
		"enabled":     s.cfg.Registry.Enabled,
		"cluster":     s.cfg.Registry.Cluster,
		"running":     s.running,
		"sync_count":  s.syncCount,
		"error_count": s.errorCount,
	}
	if s.lastOK != nil {
		m["last_ok"] = map[string]any{
			"trigger":     s.lastOK.Trigger,
			"synced_at":   s.lastOK.SyncedAt.UTC().Format(time.RFC3339),
			"duration_ms": s.lastOK.DurationMs,
		}
	}
	if s.lastErr != nil {
		m["last_error"] = map[string]any{
			"trigger":   s.lastErr.Trigger,
			"error":     s.lastErr.Error,
			"synced_at": s.lastErr.SyncedAt.UTC().Format(time.RFC3339),
		}
	}
	return m
}

// Trigger schedules a non-blocking async sync. Concurrent runs are skipped.
// Heartbeat triggers are debounced to at most once every 10 minutes.
func (s *Service) Trigger(input SyncInput) {
	if s == nil || s.wallet == nil || !s.cfg.Registry.Enabled {
		return
	}

	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		log.Printf("[REGISTRY] sync skipped (%s): previous run still active", input.Trigger)
		return
	}
	// Debounce heartbeat triggers — don't spam the registry.
	if input.Trigger == "heartbeat" {
		cooldown := 10 * time.Minute
		if !s.lastTrigger.IsZero() && time.Since(s.lastTrigger) < cooldown {
			s.mu.Unlock()
			return
		}
	}
	s.running = true
	s.lastTrigger = time.Now()
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			s.running = false
			s.mu.Unlock()
		}()

		timeout := 45 * time.Second
		if input.Trigger == "startup" {
			timeout = 90 * time.Second
		}
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		s.runWithRetry(ctx, input)
	}()
}

// TriggerSync is a synchronous variant used by Telegram commands.
// Returns the SyncResult directly so the caller can format it.
func (s *Service) TriggerSync(ctx context.Context, input SyncInput) *SyncResult {
	if s == nil || !s.cfg.Registry.Enabled {
		return &SyncResult{Trigger: input.Trigger, Error: "registry not configured"}
	}
	return s.runOnce(ctx, input, 0)
}

// ── internal ─────────────────────────────────────────────────────────

func (s *Service) runWithRetry(ctx context.Context, input SyncInput) {
	for attempt := 0; attempt <= len(retryDelays); attempt++ {
		result := s.runOnce(ctx, input, attempt)

		s.mu.Lock()
		if result.OK {
			s.syncCount++
			s.lastOK = result
			s.mu.Unlock()
			return
		}
		s.errorCount++
		s.lastErr = result
		s.mu.Unlock()

		log.Printf("[REGISTRY] attempt %d failed (%s): %s", attempt+1, input.Trigger, result.Error)

		if attempt < len(retryDelays) {
			select {
			case <-ctx.Done():
				return
			case <-time.After(retryDelays[attempt]):
			}
		}
	}
	log.Printf("[REGISTRY] all attempts exhausted for trigger=%s", input.Trigger)
}

func (s *Service) runOnce(ctx context.Context, input SyncInput, attempt int) *SyncResult {
	start := time.Now()
	result := &SyncResult{Trigger: input.Trigger, Attempt: attempt, SyncedAt: start}

	err := s.runSync(ctx, input)
	result.DurationMs = time.Since(start).Milliseconds()
	if err != nil {
		result.Error = err.Error()
	} else {
		result.OK = true
	}
	return result
}

func StatePath() string {
	return filepath.Join(config.DefaultHome(), "registry", stateFileName)
}

func registryDomains(cfg *config.Config) []string {
	combined := make([]string, 0, len(cfg.Registry.Domains)+2)
	seen := make(map[string]struct{})
	for _, domain := range append(append([]string{}, cfg.Registry.Domains...), config.PublicRegistryDomains()...) {
		trimmed := strings.TrimSpace(domain)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		combined = append(combined, trimmed)
	}
	return combined
}

func (s *Service) runSync(ctx context.Context, input SyncInput) error {
	nodeBin, err := exec.LookPath("node")
	if err != nil {
		return fmt.Errorf("node runtime not found in PATH")
	}

	scriptPath, err := resolveScriptPath()
	if err != nil {
		return err
	}

	privateKeyJSON, err := json.Marshal([]byte(s.wallet.GetPrivateKey()))
	if err != nil {
		return fmt.Errorf("encode signer: %w", err)
	}

	registryRPC := strings.TrimSpace(s.cfg.Registry.RPCURL)
	if registryRPC == "" {
		registryRPC = strings.TrimSpace(s.cfg.Solana.HeliusRPCURL)
	}

	env := os.Environ()
	env = append(env,
		"SOLANA_PRIVATE_KEY="+string(privateKeyJSON),
		"AGENT_REGISTRY_TRIGGER="+strings.TrimSpace(input.Trigger),
		"AGENT_REGISTRY_AGENT_PUBKEY="+s.wallet.PublicKeyStr(),
		"AGENT_REGISTRY_AGENT_MODE="+strings.TrimSpace(input.Mode),
		"AGENT_REGISTRY_PET_NAME="+strings.TrimSpace(input.PetName),
		"AGENT_REGISTRY_PET_STAGE="+strings.TrimSpace(input.PetStage),
		"AGENT_REGISTRY_PET_MOOD="+strings.TrimSpace(input.PetMood),
		"AGENT_REGISTRY_HEARTBEAT_PATH="+strings.TrimSpace(input.HeartbeatPath),
		"AGENT_REGISTRY_STATE_PATH="+StatePath(),
		"AGENT_REGISTRY_WATCHLIST="+strings.Join(input.Watchlist, ","),
		"SOLANAOS_VERSION="+config.GetVersion(),
		"NANOSOLANA_VERSION="+config.GetVersion(),
		"AGENT_REGISTRY_SITE_URL="+config.PublicHubURL(),
		"AGENT_REGISTRY_DASHBOARD_URL="+config.PublicDashboardURL(),
		"AGENT_REGISTRY_PAIR_URL="+config.PublicPairURL(),
		"AGENT_REGISTRY_SYNC_URL="+strings.TrimRight(config.PublicHubURL(), "/")+"/nanosolana/agents/sync",
	)
	if syncKey := strings.TrimSpace(firstNonEmptyEnv("NANOSOLANA_AGENT_SYNC_KEY", "CONVEX_NANOSOLANA_AGENT_SYNC_KEY", s.cfg.Convex.DeployKey)); syncKey != "" {
		env = append(env, "AGENT_REGISTRY_SYNC_KEY="+syncKey)
	}

	// ── Capability metadata ──────────────────────────────────────
	env = appendCapabilityEnv(env, input)

	if registryRPC != "" {
		env = append(env, "AGENT_REGISTRY_RPC_URL="+registryRPC)
	}

	// ── Registry config fields ───────────────────────────────────
	cfg := s.cfg.Registry
	domains := registryDomains(s.cfg)
	for _, pair := range []struct{ key, val string }{
		{"AGENT_REGISTRY_NAME", cfg.Name},
		{"AGENT_REGISTRY_DESCRIPTION", cfg.Description},
		{"AGENT_REGISTRY_CLUSTER", cfg.Cluster},
		{"AGENT_REGISTRY_TOKEN_URI", cfg.TokenURI},
		{"AGENT_REGISTRY_IMAGE", cfg.Image},
		{"AGENT_REGISTRY_MCP_URL", cfg.MCPURL},
		{"AGENT_REGISTRY_A2A_URL", cfg.A2AURL},
		{"AGENT_REGISTRY_SNS", cfg.SNS},
		{"AGENT_REGISTRY_ENS", cfg.ENS},
		{"AGENT_REGISTRY_DID", cfg.DID},
		{"AGENT_REGISTRY_HEARTBEAT_KEY", cfg.HeartbeatKey},
		{"AGENT_REGISTRY_INDEXER_API_KEY", cfg.IndexerAPIKey},
		{"AGENT_REGISTRY_PINATA_JWT", cfg.PinataJWT},
		{"PUMP_FUN_ENVIRONMENT", cfg.PumpEnvironment},
		{"PUMP_FUN_AGENT_MINT_ADDRESS", cfg.PumpAgentMint},
		{"PUMP_FUN_CURRENCY_MINT", cfg.PumpCurrencyMint},
		{"PUMP_FUN_PAYMENT_AMOUNT", cfg.PumpPriceAmount},
	} {
		if pair.val != "" {
			env = append(env, pair.key+"="+pair.val)
		}
	}
	if len(cfg.Skills) > 0 {
		env = append(env, "AGENT_REGISTRY_SKILLS="+strings.Join(cfg.Skills, ","))
	}
	if len(domains) > 0 {
		env = append(env, "AGENT_REGISTRY_DOMAINS="+strings.Join(domains, ","))
	}
	env = append(env,
		fmt.Sprintf("AGENT_REGISTRY_X402_SUPPORT=%t", cfg.X402Support || s.cfg.X402.Enabled),
		fmt.Sprintf("AGENT_REGISTRY_WRITE_HEARTBEAT=%t", cfg.WriteHeartbeat),
		fmt.Sprintf("AGENT_REGISTRY_ENABLE_ATOM=%t", cfg.EnableAtom),
	)
	if cfg.PumpEnabled {
		env = append(env, "PUMP_FUN_ENABLED=true")
	}
	// Fall back to pump launch state if no explicit mint is configured.
	if cfg.PumpAgentMint == "" {
		if launchState, err := pumplaunch.LoadState(); err == nil && launchState != nil &&
			launchState.Status == "ok" && launchState.Mint != "" {
			env = append(env, "PUMP_FUN_AGENT_MINT_ADDRESS="+launchState.Mint)
		}
	}

	cmd := exec.CommandContext(ctx, nodeBin, scriptPath, "sync")
	cmd.Dir = filepath.Dir(scriptPath)
	cmd.Env = env
	output, err := cmd.CombinedOutput()
	if out := strings.TrimSpace(string(output)); out != "" {
		log.Printf("[REGISTRY] %s", out)
	}
	if err != nil {
		return fmt.Errorf("node helper: %w", err)
	}
	return nil
}

// appendCapabilityEnv injects optional integration metadata so the registry
// entry reflects what this instance actually supports.
func appendCapabilityEnv(env []string, input SyncInput) []string {
	var caps []string

	if input.HyperliquidEnabled {
		caps = append(caps, "hyperliquid-perps")
		if input.HyperliquidWallet != "" {
			env = append(env, "AGENT_CAPABILITY_HL_WALLET="+input.HyperliquidWallet)
		}
	}
	if input.HonchoEnabled {
		caps = append(caps, "honcho-memory")
		if input.HonchoWorkspace != "" {
			env = append(env, "AGENT_CAPABILITY_HONCHO_WORKSPACE="+input.HonchoWorkspace)
		}
	}
	if input.GrokEnabled {
		caps = append(caps, "grok-vision,grok-web,grok-image,grok-video")
	}
	// Core capabilities always present.
	caps = append(caps,
		"solana-trading",
		"ooda-loop",
		"jupiter-swaps",
		"telegram-bot",
		"tamagobot",
	)

	if len(caps) > 0 {
		env = append(env, "AGENT_CAPABILITIES="+strings.Join(caps, ","))
	}
	return env
}

func resolveScriptPath() (string, error) {
	candidates := make([]string, 0, 8)

	if override := strings.TrimSpace(firstNonEmptyEnv("SOLANAOS_AGENT_REGISTRY_SCRIPT", "NANOSOLANA_AGENT_REGISTRY_SCRIPT")); override != "" {
		candidates = append(candidates, override)
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(cwd, "scripts", "agent-registry.mjs"))
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "scripts", "agent-registry.mjs"),
			filepath.Join(filepath.Dir(exeDir), "scripts", "agent-registry.mjs"),
		)
	}
	// Railway / Docker common paths
	for _, base := range []string{"/app", "/workspace", "/srv"} {
		candidates = append(candidates, filepath.Join(base, "scripts", "agent-registry.mjs"))
	}

	for _, c := range candidates {
		if c == "" {
			continue
		}
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c, nil
		}
	}
	return "", fmt.Errorf("agent registry helper not found (set SOLANAOS_AGENT_REGISTRY_SCRIPT or NANOSOLANA_AGENT_REGISTRY_SCRIPT to override)")
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}
