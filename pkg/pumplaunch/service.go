package pumplaunch

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

var errPumpLaunchHelperUnavailable = errors.New("pump launch helper unavailable")

type Service struct {
	cfg    *config.Config
	wallet *solana.Wallet
}

func New(cfg *config.Config, wallet *solana.Wallet) *Service {
	if cfg == nil || wallet == nil || !cfg.PumpLaunch.Enabled {
		return nil
	}
	return &Service{
		cfg:    cfg,
		wallet: wallet,
	}
}

func (s *Service) RunStartup(ctx context.Context) error {
	if s == nil || s.wallet == nil || !s.cfg.PumpLaunch.Enabled {
		return nil
	}

	nodeBin, err := exec.LookPath("node")
	if err != nil {
		log.Printf("[PUMP] ℹ️ Startup launch skipped: node runtime not found in PATH")
		return nil
	}

	scriptPath, err := resolveScriptPath()
	if err != nil {
		return err
	}
	if err := ensureHelperDeps(scriptPath); err != nil {
		log.Printf("[PUMP] ℹ️ Startup launch skipped: %v", err)
		return nil
	}

	rpcURL := strings.TrimSpace(s.cfg.PumpLaunch.RPCURL)
	if rpcURL == "" {
		rpcURL = strings.TrimSpace(s.cfg.Solana.HeliusRPCURL)
	}

	env := os.Environ()
	env = append(env,
		"SOLANA_PRIVATE_KEY_BASE58="+strings.TrimSpace(s.wallet.PrivateKeyBase58()),
		"PUMP_LAUNCH_STATE_PATH="+StatePath(),
		"PUMP_LAUNCH_CONFIRM="+strings.TrimSpace(s.cfg.PumpLaunch.Confirm),
		"PUMP_LAUNCH_CLUSTER="+strings.TrimSpace(s.cfg.PumpLaunch.Cluster),
		"PUMP_LAUNCH_MODE="+strings.TrimSpace(s.cfg.PumpLaunch.Mode),
		"PUMP_LAUNCH_NAME="+strings.TrimSpace(s.cfg.PumpLaunch.Name),
		"PUMP_LAUNCH_SYMBOL="+strings.TrimSpace(s.cfg.PumpLaunch.Symbol),
		"PUMP_LAUNCH_DESCRIPTION="+strings.TrimSpace(s.cfg.PumpLaunch.Description),
		"PUMP_LAUNCH_IMAGE="+strings.TrimSpace(s.cfg.PumpLaunch.Image),
		"PUMP_LAUNCH_WEBSITE="+strings.TrimSpace(s.cfg.PumpLaunch.Website),
		"PUMP_LAUNCH_X_URL="+strings.TrimSpace(s.cfg.PumpLaunch.XURL),
		"PUMP_LAUNCH_TELEGRAM_URL="+strings.TrimSpace(s.cfg.PumpLaunch.TelegramURL),
		"PUMP_LAUNCH_METADATA_URI="+strings.TrimSpace(s.cfg.PumpLaunch.MetadataURI),
		"PUMP_LAUNCH_INITIAL_BUY_SOL="+strconv.FormatFloat(s.cfg.PumpLaunch.InitialBuySOL, 'f', -1, 64),
		"PUMP_LAUNCH_SLIPPAGE_PCT="+strconv.FormatFloat(s.cfg.PumpLaunch.SlippagePct, 'f', -1, 64),
		fmt.Sprintf("PUMP_LAUNCH_MAYHEM_MODE=%t", s.cfg.PumpLaunch.MayhemMode),
		fmt.Sprintf("PUMP_LAUNCH_CASHBACK=%t", s.cfg.PumpLaunch.Cashback),
	)
	if rpcURL != "" {
		env = append(env, "PUMP_LAUNCH_RPC_URL="+rpcURL)
	}
	if walletPath := strings.TrimSpace(s.cfg.Solana.WalletKeyPath); walletPath != "" {
		env = append(env, "SOLANA_PRIVATE_KEY_PATH="+walletPath)
	}
	if s.cfg.PumpLaunch.PinataJWT != "" {
		env = append(env, "PUMP_LAUNCH_PINATA_JWT="+s.cfg.PumpLaunch.PinataJWT)
	}
	if s.cfg.Registry.PinataJWT != "" {
		env = append(env, "AGENT_REGISTRY_PINATA_JWT="+s.cfg.Registry.PinataJWT)
	}

	cmd := exec.CommandContext(ctx, nodeBin, scriptPath, "launch")
	cmd.Dir = filepath.Dir(scriptPath)
	cmd.Env = env
	output, err := cmd.CombinedOutput()
	out := strings.TrimSpace(string(output))
	if out != "" {
		log.Printf("[PUMP] %s", out)
	}
	if err != nil {
		return fmt.Errorf("node helper: %w", err)
	}
	return nil
}

func ensureHelperDeps(scriptPath string) error {
	scriptDir := filepath.Dir(scriptPath)
	required := []string{
		filepath.Join(scriptDir, "node_modules", "@solana", "web3.js"),
		filepath.Join(scriptDir, "node_modules", "@nirholas", "pump-sdk"),
	}
	for _, path := range required {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			continue
		}
		return fmt.Errorf("%w: install JS deps in %s", errPumpLaunchHelperUnavailable, scriptDir)
	}
	return nil
}

func resolveScriptPath() (string, error) {
	candidates := make([]string, 0, 6)
	if override := strings.TrimSpace(firstNonEmptyEnv("SOLANAOS_PUMP_LAUNCH_SCRIPT", "NANOSOLANA_PUMP_LAUNCH_SCRIPT")); override != "" {
		candidates = append(candidates, override)
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(cwd, "scripts", "pump-launch.mjs"))
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "scripts", "pump-launch.mjs"),
			filepath.Join(filepath.Dir(exeDir), "scripts", "pump-launch.mjs"),
		)
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("pump launch helper not found")
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}
