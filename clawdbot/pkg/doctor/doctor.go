// Package doctor provides local runtime diagnostics for ClawdBot.
package doctor

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/config"
	dnaPkg "github.com/x402agent/SolanaOS/clawdbot/pkg/dna"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/laws"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/trading"
)

type Status string

const (
	StatusPass Status = "pass"
	StatusWarn Status = "warn"
	StatusFail Status = "fail"
)

type Check struct {
	ID      string         `json:"id"`
	Label   string         `json:"label"`
	Status  Status         `json:"status"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type Report struct {
	GeneratedAt string  `json:"generatedAt"`
	OK          bool    `json:"ok"`
	Checks      []Check `json:"checks"`
}

type Options struct {
	Now           func() time.Time
	Config        *config.Config
	ConfigPath    string
	WorkspacePath string
	ProjectRoot   string
}

func Run(options Options) Report {
	now := options.Now
	if now == nil {
		now = time.Now
	}
	cfg := options.Config
	if cfg == nil {
		cfg = config.DefaultConfig()
	}
	checks := []Check{
		runtimeCheck(),
		lawsCheck(),
		configCheck(options.ConfigPath),
		workspaceCheck(options.WorkspacePath),
		dnaCheck(options.WorkspacePath),
		tradingCheck(cfg),
		connectorsCheck(cfg),
		vulcanCheck(cfg),
		zkCheck(options.ProjectRoot),
	}
	report := Report{
		GeneratedAt: now().UTC().Format(time.RFC3339),
		OK:          true,
		Checks:      checks,
	}
	for _, check := range checks {
		if check.Status == StatusFail {
			report.OK = false
			break
		}
	}
	return report
}

func Format(report Report) string {
	var b strings.Builder
	fmt.Fprintf(&b, "ClawdBot doctor report (%s)\n", report.GeneratedAt)
	if report.OK {
		b.WriteString("overall: pass\n")
	} else {
		b.WriteString("overall: fail\n")
	}
	for _, check := range report.Checks {
		fmt.Fprintf(&b, "[%s] %s - %s\n", check.Status, check.ID, check.Message)
	}
	return strings.TrimRight(b.String(), "\n")
}

func WriteJSON(report Report) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(report)
}

func runtimeCheck() Check {
	return Check{
		ID:      "runtime.go",
		Label:   "Go runtime",
		Status:  StatusPass,
		Message: fmt.Sprintf("%s %s/%s", runtime.Version(), runtime.GOOS, runtime.GOARCH),
	}
}

func lawsCheck() Check {
	if err := laws.Validate(); err != nil {
		return Check{ID: "laws.six", Label: "Six-law harness", Status: StatusFail, Message: err.Error()}
	}
	return Check{ID: "laws.six", Label: "Six-law harness", Status: StatusPass, Message: "six laws loaded: 3 on-chain + 3 off-chain"}
}

func configCheck(path string) Check {
	if strings.TrimSpace(path) == "" {
		path = config.DefaultConfigPath()
	}
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return Check{ID: "config.file", Label: "Config file", Status: StatusWarn, Message: "config file missing; runtime will use defaults", Details: map[string]any{"path": path}}
		}
		return Check{ID: "config.file", Label: "Config file", Status: StatusFail, Message: err.Error(), Details: map[string]any{"path": path}}
	}
	return Check{ID: "config.file", Label: "Config file", Status: StatusPass, Message: "config file exists", Details: map[string]any{"path": path}}
}

func workspaceCheck(path string) Check {
	if strings.TrimSpace(path) == "" {
		path = config.DefaultWorkspacePath()
	}
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return Check{ID: "workspace", Label: "Workspace", Status: StatusWarn, Message: "workspace missing; run `clawdbot onboard` to create it", Details: map[string]any{"path": path}}
		}
		return Check{ID: "workspace", Label: "Workspace", Status: StatusFail, Message: err.Error(), Details: map[string]any{"path": path}}
	}
	return Check{ID: "workspace", Label: "Workspace", Status: StatusPass, Message: "workspace exists", Details: map[string]any{"path": path}}
}

func dnaCheck(workspacePath string) Check {
	if strings.TrimSpace(workspacePath) == "" {
		workspacePath = config.DefaultWorkspacePath()
	}
	path := dnaPkg.DefaultPath(workspacePath)
	value, err := dnaPkg.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Check{ID: "agent.dna", Label: "Agent DNA", Status: StatusWarn, Message: "agent DNA missing; run `clawdbot dna generate`", Details: map[string]any{"path": path}}
		}
		return Check{ID: "agent.dna", Label: "Agent DNA", Status: StatusFail, Message: err.Error(), Details: map[string]any{"path": path}}
	}
	return Check{
		ID:      "agent.dna",
		Label:   "Agent DNA",
		Status:  StatusPass,
		Message: fmt.Sprintf("%s utility=%d/100", value.Proof.DNAID, value.Metrics.UtilityScore),
		Details: map[string]any{
			"path":        path,
			"sequence":    value.Sequence.Length,
			"gcContent":   value.Metrics.GCContent,
			"attestation": value.Attestation.Status,
		},
	}
}

func tradingCheck(cfg *config.Config) Check {
	cockpit := trading.BuildCockpitReport(cfg, time.Now())
	status := StatusPass
	if cockpit.Readiness.Status == "blocked" {
		status = StatusFail
	} else if cockpit.Readiness.Status == "needs_attention" {
		status = StatusWarn
	}
	return Check{
		ID:      "trading.readiness",
		Label:   "Trading readiness",
		Status:  status,
		Message: fmt.Sprintf("%s (%d/100)", cockpit.Readiness.Status, cockpit.Readiness.Score),
		Details: map[string]any{
			"mode":      cockpit.Mode,
			"watchlist": len(cockpit.Watchlist),
			"reasons":   cockpit.Readiness.Reasons,
		},
	}
}

func connectorsCheck(cfg *config.Config) Check {
	missing := []string{}
	if strings.TrimSpace(cfg.Solana.BirdeyeAPIKey) == "" {
		missing = append(missing, "BIRDEYE_API_KEY")
	}
	if strings.TrimSpace(cfg.Solana.HeliusAPIKey) == "" && strings.TrimSpace(cfg.Solana.HeliusRPCURL) == "" {
		missing = append(missing, "HELIUS_API_KEY or HELIUS_RPC_URL")
	}
	status := StatusPass
	message := "market data connectors are configured"
	if len(missing) > 0 {
		status = StatusWarn
		message = "some market data connectors are missing"
	}
	return Check{ID: "connectors.market_data", Label: "Market data connectors", Status: status, Message: message, Details: map[string]any{"missing": missing}}
}

func vulcanCheck(cfg *config.Config) Check {
	bin := strings.TrimSpace(cfg.Vulcan.Binary)
	if bin == "" {
		bin = "vulcan"
	}
	path, err := exec.LookPath(bin)
	if err != nil {
		return Check{
			ID:      "perps.vulcan",
			Label:   "Vulcan perps CLI",
			Status:  StatusWarn,
			Message: "vulcan binary is not on PATH; paper perps quickstart cannot run yet",
			Details: map[string]any{
				"binary":  bin,
				"install": "curl -fsSL https://github.com/Ellipsis-Labs/vulcan-cli/releases/latest/download/install.sh | sh",
			},
		}
	}
	return Check{
		ID:      "perps.vulcan",
		Label:   "Vulcan perps CLI",
		Status:  StatusPass,
		Message: "vulcan binary is available",
		Details: map[string]any{
			"binary": path,
			"mode":   cfg.Vulcan.DefaultMode,
		},
	}
}

func zkCheck(projectRoot string) Check {
	if strings.TrimSpace(projectRoot) == "" {
		projectRoot = "."
	}
	root := filepath.Join(projectRoot, "zk-primitives")
	required := []string{"MANIFEST.json", "agent", "client", "programs"}
	missing := []string{}
	for _, name := range required {
		if _, err := os.Stat(filepath.Join(root, name)); err != nil {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return Check{ID: "zk.surface", Label: "ZK surface", Status: StatusWarn, Message: "zk-primitives surface is incomplete", Details: map[string]any{"root": root, "missing": missing}}
	}
	return Check{ID: "zk.surface", Label: "ZK surface", Status: StatusPass, Message: "zk-primitives surface is present", Details: map[string]any{"root": root}}
}
