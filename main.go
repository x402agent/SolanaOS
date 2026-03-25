// SolanaOS — Go-native Solana operator runtime
// Built by SolanaOS Labs
//
// Copyright (c) 2026 8BIT Labs. All rights reserved.
// License: MIT

package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	solanago "github.com/gagliardetto/solana-go"

	"github.com/x402agent/Solana-Os-Go/pkg/agent"
	"github.com/x402agent/Solana-Os-Go/pkg/agentregistry"
	browserusepkg "github.com/x402agent/Solana-Os-Go/pkg/browseruse"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/daemon"
	gw "github.com/x402agent/Solana-Os-Go/pkg/gateway"
	"github.com/x402agent/Solana-Os-Go/pkg/hardware"
	"github.com/x402agent/Solana-Os-Go/pkg/llm"
	"github.com/x402agent/Solana-Os-Go/pkg/nanobot"
	"github.com/x402agent/Solana-Os-Go/pkg/skills"
	"github.com/x402agent/Solana-Os-Go/pkg/node"
	"github.com/x402agent/Solana-Os-Go/pkg/onchain"
	"github.com/x402agent/Solana-Os-Go/pkg/seeker"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
	"github.com/x402agent/Solana-Os-Go/pkg/tamagochi"
	agentwallet "github.com/x402agent/Solana-Os-Go/services/agent-wallet"
)

const (
	colorGreen  = "\033[1;38;2;20;241;149m"
	colorPurple = "\033[1;38;2;153;69;255m"
	colorTeal   = "\033[1;38;2;0;212;255m"
	colorAmber  = "\033[1;38;2;255;170;0m"
	colorRed    = "\033[1;38;2;255;64;96m"
	colorDim    = "\033[38;2;85;102;128m"
	colorReset  = "\033[0m"

	banner = "\r\n" +
		colorGreen + "    ███╗   ██╗ █████╗ ███╗   ██╗ ██████╗ " + colorPurple + "███████╗ ██████╗ ██╗      █████╗ ███╗   ██╗ █████╗ \n" +
		colorGreen + "    ████╗  ██║██╔══██╗████╗  ██║██╔═══██╗" + colorPurple + "██╔════╝██╔═══██╗██║     ██╔══██╗████╗  ██║██╔══██╗\n" +
		colorGreen + "    ██╔██╗ ██║███████║██╔██╗ ██║██║   ██║" + colorPurple + "███████╗██║   ██║██║     ███████║██╔██╗ ██║███████║\n" +
		colorGreen + "    ██║╚██╗██║██╔══██║██║╚██╗██║██║   ██║" + colorPurple + "╚════██║██║   ██║██║     ██╔══██║██║╚██╗██║██╔══██║\n" +
		colorGreen + "    ██║ ╚████║██║  ██║██║ ╚████║╚██████╔╝" + colorPurple + "███████║╚██████╔╝███████╗██║  ██║██║ ╚████║██║  ██║\n" +
		colorGreen + "    ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ " + colorPurple + "╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝\n" +
		colorReset + "\n" +
		colorDim + "    ┌──────────────────────────────────────────────────────────────────┐\n" +
		colorDim + "    │" + colorTeal + "  🖥️  SolanaOS Computer · Operator-Grade Solana Runtime" + colorDim + "          │\n" +
		colorDim + "    │" + colorAmber + "  Powered by SolanaOS · Go Runtime · x402 Protocol" + colorDim + "             │\n" +
		colorDim + "    │" + colorGreen + "  Autonomous Trading Intelligence · <10MB · Boots in <1s" + colorDim + "          │\n" +
		colorDim + "    └──────────────────────────────────────────────────────────────────┘\n" +
		colorReset + "\n"
)

type gatewaySetupCodePayload struct {
	URL      string `json:"url"`
	Token    string `json:"token,omitempty"`
	Password string `json:"password,omitempty"`
}

type gatewayConnectBundle struct {
	Version      int    `json:"version"`
	Product      string `json:"product"`
	GeneratedAt  string `json:"generatedAt"`
	Workspace    string `json:"workspace"`
	InstallDir   string `json:"installDir"`
	CLIBinary    string `json:"cliBinary"`
	CompatBinary string `json:"compatBinary"`
	Control      struct {
		APIURL string `json:"apiUrl"`
	} `json:"control"`
	Web struct {
		URL string `json:"url"`
	} `json:"web"`
	Gateway struct {
		URL      string `json:"url"`
		AuthMode string `json:"authMode"`
		Secret   string `json:"secret"`
	} `json:"gateway"`
	Android struct {
		SetupCode string `json:"setupCode"`
	} `json:"android"`
	Extension struct {
		APIURL    string `json:"apiUrl"`
		SetupCode string `json:"setupCode"`
		Secret    string `json:"secret"`
	} `json:"extension"`
	MacOS struct {
		GatewayURL string `json:"gatewayUrl"`
		Secret     string `json:"secret"`
	} `json:"macos"`
}

// skillsAdapter bridges skills.Manager to gw.SkillsProvider.
type skillsAdapter struct {
	mgr *skills.Manager
}

func (a *skillsAdapter) Count() int { return a.mgr.Count() }

func (a *skillsAdapter) All() []gw.SkillEntry {
	raw := a.mgr.All()
	out := make([]gw.SkillEntry, len(raw))
	for i, s := range raw {
		out[i] = gw.SkillEntry{Name: s.Name, Description: s.Description, Tags: s.Tags, Emoji: s.Emoji}
	}
	return out
}

func (a *skillsAdapter) Get(name string) *gw.SkillEntry {
	s := a.mgr.Get(name)
	if s == nil {
		return nil
	}
	return &gw.SkillEntry{Name: s.Name, Description: s.Description, Tags: s.Tags, Emoji: s.Emoji}
}

func (a *skillsAdapter) BuildContext() string {
	all := a.mgr.All()
	if len(all) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("Available skills:\n")
	for _, s := range all {
		emoji := s.Emoji
		if emoji == "" {
			emoji = "🔧"
		}
		b.WriteString(fmt.Sprintf("- %s %s: %s\n", emoji, s.Name, s.Description))
	}
	return b.String()
}

type gatewayConnectFiles struct {
	BundlePath    string
	SetupCodePath string
	QRPayloadPath string
	ReadmePath    string
	SetupCode     string
	GatewayURL    string
	AuthMode      string
}

func resolveGatewaySetupURL(cfg *config.Config, bridgeAddr string) string {
	host, port := node.ParseBridgeAddr(strings.TrimSpace(bridgeAddr))
	if host != "" && port > 0 {
		return fmt.Sprintf("http://%s:%d", host, port)
	}

	resolvedPort := 18790
	if cfg != nil {
		if cfg.GatewaySpawn.Port > 0 {
			resolvedPort = cfg.GatewaySpawn.Port
		} else if cfg.Gateway.Port > 0 {
			resolvedPort = cfg.Gateway.Port
		}
	}

	host = ""
	if cfg != nil {
		switch strings.TrimSpace(cfg.Gateway.Host) {
		case "", "0.0.0.0", "::", "localhost":
		default:
			host = strings.TrimSpace(cfg.Gateway.Host)
		}
	}
	if host == "" && cfg != nil && cfg.GatewaySpawn.UseTailscale {
		if tsIP, err := gw.DetectTailscaleIP(); err == nil && strings.TrimSpace(tsIP) != "" {
			host = strings.TrimSpace(tsIP)
		}
	}
	if host == "" {
		host = "127.0.0.1"
	}

	return fmt.Sprintf("http://%s:%d", host, resolvedPort)
}

func resolveGatewaySetupAuth(cfg *config.Config) (string, string, string) {
	if cfg == nil {
		return "", "", ""
	}

	mode := strings.TrimSpace(cfg.Gateway.Auth.Mode)
	token := strings.TrimSpace(cfg.Gateway.Auth.Token)
	password := strings.TrimSpace(cfg.Gateway.Auth.Password)
	legacySecret := strings.TrimSpace(os.Getenv("NANO_GATEWAY_SECRET"))

	if mode == "password" && password != "" {
		return mode, "", password
	}
	if token != "" {
		if mode == "" {
			mode = "token"
		}
		return mode, token, ""
	}
	if legacySecret != "" {
		if mode == "" {
			mode = "token"
		}
		return mode, legacySecret, ""
	}

	return mode, "", password
}

func writeGatewayConnectFiles(cfg *config.Config, gatewayURL string) (*gatewayConnectFiles, error) {
	mode, token, password := resolveGatewaySetupAuth(cfg)
	payload := gatewaySetupCodePayload{URL: gatewayURL}
	secret := ""
	if password != "" {
		payload.Password = password
		secret = password
	} else if token != "" {
		payload.Token = token
		secret = token
	}

	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal setup code payload: %w", err)
	}
	setupCode := base64.RawURLEncoding.EncodeToString(encodedPayload)

	workspace := config.DefaultHome()
	connectDir := filepath.Join(workspace, "connect")
	if err := os.MkdirAll(connectDir, 0o700); err != nil {
		return nil, fmt.Errorf("create connect dir: %w", err)
	}
	_ = os.Chmod(connectDir, 0o700)

	bundlePath := filepath.Join(connectDir, "solanaos-connect.json")
	setupCodePath := filepath.Join(connectDir, "setup-code.txt")
	qrPayloadPath := filepath.Join(connectDir, "setup-qr.json")
	readmePath := filepath.Join(connectDir, "README.txt")

	execPath, _ := os.Executable()
	execPath, _ = filepath.Abs(execPath)
	installDir := filepath.Dir(filepath.Dir(execPath))
	controlAPIURL := strings.TrimSpace(os.Getenv("SOLANAOS_CONTROL_API_URL"))
	if controlAPIURL == "" {
		controlAPIURL = "http://127.0.0.1:7777"
	}
	webURL := strings.TrimSpace(os.Getenv("SOLANAOS_WEB_URL"))
	if webURL == "" {
		webURL = "http://127.0.0.1:18800"
	}

	bundle := gatewayConnectBundle{
		Version:      1,
		Product:      "SolanaOS",
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
		Workspace:    workspace,
		InstallDir:   installDir,
		CLIBinary:    execPath,
		CompatBinary: filepath.Join(filepath.Dir(execPath), "solanaos"),
	}
	bundle.Control.APIURL = controlAPIURL
	bundle.Web.URL = webURL
	bundle.Gateway.URL = gatewayURL
	bundle.Gateway.AuthMode = mode
	bundle.Gateway.Secret = secret
	bundle.Android.SetupCode = setupCode
	bundle.Extension.APIURL = controlAPIURL
	bundle.Extension.SetupCode = setupCode
	bundle.Extension.Secret = secret
	bundle.MacOS.GatewayURL = gatewayURL
	bundle.MacOS.Secret = secret

	bundleJSON, err := json.MarshalIndent(bundle, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal connect bundle: %w", err)
	}
	if err := os.WriteFile(bundlePath, append(bundleJSON, '\n'), 0o600); err != nil {
		return nil, fmt.Errorf("write connect bundle: %w", err)
	}

	qrJSON, err := json.Marshal(map[string]string{"setupCode": setupCode})
	if err != nil {
		return nil, fmt.Errorf("marshal QR payload: %w", err)
	}
	if err := os.WriteFile(setupCodePath, []byte(setupCode+"\n"), 0o600); err != nil {
		return nil, fmt.Errorf("write setup code: %w", err)
	}
	if err := os.WriteFile(qrPayloadPath, append(qrJSON, '\n'), 0o600); err != nil {
		return nil, fmt.Errorf("write QR payload: %w", err)
	}

	readme := fmt.Sprintf(`SolanaOS Connect Bundle

Files:
- solanaos-connect.json : shared install-time handoff for macOS, Android, and the Chrome extension
- setup-code.txt        : paste this into Android or the Chrome extension
- setup-qr.json         : QR-friendly wrapper if you want to render the setup code as JSON

Defaults:
- SolanaOS Control API : %s
- Web console          : %s
- Native gateway       : %s

If you change gateway auth in .env, regenerate this bundle:
  solanaos gateway setup-code
`, controlAPIURL, webURL, gatewayURL)
	if err := os.WriteFile(readmePath, []byte(readme), 0o600); err != nil {
		return nil, fmt.Errorf("write connect readme: %w", err)
	}

	return &gatewayConnectFiles{
		BundlePath:    bundlePath,
		SetupCodePath: setupCodePath,
		QRPayloadPath: qrPayloadPath,
		ReadmePath:    readmePath,
		SetupCode:     setupCode,
		GatewayURL:    gatewayURL,
		AuthMode:      mode,
	}, nil
}

func printGatewaySetupCode(files *gatewayConnectFiles) {
	fmt.Printf("%sSeeker setup code:%s\n", colorPurple, colorReset)
	fmt.Printf("%s%s%s\n", colorGreen, files.SetupCode, colorReset)
	fmt.Printf("%sSaved:  %s%s\n", colorDim, files.SetupCodePath, colorReset)
	fmt.Printf("%sBundle: %s%s\n", colorDim, files.BundlePath, colorReset)
	fmt.Printf("%sUse this in Solana Seeker onboarding or the Connect tab.%s\n\n", colorDim, colorReset)
}

func NewSolanaOSCommand() *cobra.Command {
	short := fmt.Sprintf("🖥️ SolanaOS Runtime v%s", config.GetVersion())

	cmd := &cobra.Command{
		Use:   "solanaos",
		Short: short,
		Long: `SolanaOS — local-first operator runtime for Solana.
Powered by the SolanaOS Go runtime with native gateway and headless nodes.

Features:
  • OODA Loop (Observe → Orient → Decide → Act)
  • ClawVault memory (known/learned/inferred)
  • SolanaOS strategy: RSI + EMA cross + ATR signal engine
  • Solana: Jupiter swaps, Solana Tracker data, Helius RPC, Aster perps
  • Native Gateway: TCP bridge with Tailscale mesh + tmux sessions
  • Headless Nodes: Connect hardware (Orin Nano, RPi) over mesh
  • <10MB RAM, boots in <1s on ARM64`,
		Example: "solanaos daemon\nsolanaos gateway start\nsolanaos node run\nsolanaos ooda --interval 60",
	}

	cmd.AddCommand(
		NewAgentCommand(),
		NewBrowserUseCommand(),
		NewGatewayCommand(),
		NewMemoryCommand(),
		NewNativeGatewayCommand(),
		NewDaemonCommand(),
		NewNodeCommand(),
		NewPetCommand(),
		NewOnboardCommand(),
		NewStatusCommand(),
		NewOODACommand(),
		NewSolanaCommand(),
		NewHardwareCommand(),
		NewSeekerCommand(),
		NewNanoBotCommand(),
		NewMenuBarCommand(),
		NewVersionCommand(),
		NewWalletAPICommand(),
	)

	return cmd
}

func NewBrowserUseCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "browseruse",
		Aliases: []string{"browser"},
		Short:   "Manage Browser Use CLI integration",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runBrowserUseStatus(cmd)
		},
	}

	closeCmd := &cobra.Command{
		Use:   "close [session]",
		Short: "Close the current Browser Use session, a named session, or all sessions",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			closeAll, _ := cmd.Flags().GetBool("all")
			if closeAll {
				return runBrowserUseClose(cmd, "", true)
			}
			if len(args) == 1 {
				return runBrowserUseClose(cmd, args[0], false)
			}
			return runBrowserUseClose(cmd, "", false)
		},
	}
	closeCmd.Flags().Bool("all", false, "Close all Browser Use sessions")

	cmd.AddCommand(
		&cobra.Command{
			Use:   "status",
			Short: "Show Browser Use CLI readiness and config",
			RunE: func(cmd *cobra.Command, args []string) error {
				return runBrowserUseStatus(cmd)
			},
		},
		&cobra.Command{
			Use:   "activate",
			Short: "Save Browser Use cloud login using BROWSERUSE_API_KEY",
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, err := config.Load()
				if err != nil {
					return fmt.Errorf("config error: %w", err)
				}
				ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
				defer cancel()

				result, err := browserusepkg.Activate(ctx, cfg.Tools.BrowserUse)
				if err != nil {
					if result != nil && !result.Status.Installed {
						return fmt.Errorf("browser-use CLI is not installed\ninstall it with: curl -fsSL https://browser-use.com/cli/install.sh | bash")
					}
					if result != nil && !result.Status.APIKeyConfigured {
						return fmt.Errorf("BROWSERUSE_API_KEY is not configured")
					}
					return err
				}

				fmt.Printf("%s🌐 Browser Use Activated%s\n\n", colorGreen, colorReset)
				fmt.Printf("CLI:       %s\n", result.Status.BinaryPath)
				fmt.Printf("Session:   %s\n", result.Status.Session)
				fmt.Printf("Cloud:     %v\n", result.Status.Cloud)
				if strings.TrimSpace(result.Output) != "" {
					fmt.Printf("\nOutput:\n%s\n", result.Output)
				}
				return nil
			},
		},
		&cobra.Command{
			Use:   "sessions",
			Short: "List active Browser Use sessions",
			RunE: func(cmd *cobra.Command, args []string) error {
				return runBrowserUseArgs(cmd, []string{"sessions"})
			},
		},
		&cobra.Command{
			Use:   "connect",
			Short: "Provision a Browser Use cloud browser and connect",
			RunE: func(cmd *cobra.Command, args []string) error {
				return runBrowserUseConnect(cmd)
			},
		},
		&cobra.Command{
			Use:   "session <name> [browser-use args...]",
			Short: "Run a Browser Use command inside a named persistent session",
			Args:  cobra.MinimumNArgs(2),
			RunE: func(cmd *cobra.Command, args []string) error {
				finalArgs := append([]string{"--session", args[0]}, args[1:]...)
				return runBrowserUseArgs(cmd, finalArgs)
			},
		},
		&cobra.Command{
			Use:   "open <url>",
			Short: "Open a page with Browser Use",
			Args:  cobra.ExactArgs(1),
			RunE: func(cmd *cobra.Command, args []string) error {
				return runBrowserUseArgs(cmd, append([]string{"open"}, args...))
			},
		},
		&cobra.Command{
			Use:   "state",
			Short: "Inspect the current Browser Use page and clickable indices",
			RunE: func(cmd *cobra.Command, args []string) error {
				return runBrowserUseArgs(cmd, []string{"state"})
			},
		},
		&cobra.Command{
			Use:   "screenshot [path]",
			Short: "Take a Browser Use screenshot",
			Args:  cobra.MaximumNArgs(1),
			RunE: func(cmd *cobra.Command, args []string) error {
				return runBrowserUseArgs(cmd, append([]string{"screenshot"}, args...))
			},
		},
		&cobra.Command{
			Use:   "profile [profile-use args...]",
			Short: "Pass profile management commands through to Browser Use",
			Args:  cobra.ArbitraryArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				finalArgs := []string{"profile"}
				if len(args) == 0 {
					finalArgs = append(finalArgs, "list")
				} else {
					finalArgs = append(finalArgs, args...)
				}
				return runBrowserUseArgs(cmd, finalArgs)
			},
		},
		&cobra.Command{
			Use:   "cloud [args...]",
			Short: "Pass cloud commands through to Browser Use",
			Args:  cobra.ArbitraryArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				finalArgs := []string{"cloud"}
				if len(args) == 0 {
					finalArgs = append(finalArgs, "connect")
				} else {
					finalArgs = append(finalArgs, args...)
				}
				return runBrowserUseArgs(cmd, finalArgs)
			},
		},
		&cobra.Command{
			Use:   "tunnel [args...]",
			Short: "Pass tunnel commands through to Browser Use",
			Args:  cobra.ArbitraryArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				finalArgs := []string{"tunnel"}
				if len(args) == 0 {
					finalArgs = append(finalArgs, "list")
				} else {
					finalArgs = append(finalArgs, args...)
				}
				return runBrowserUseArgs(cmd, finalArgs)
			},
		},
		closeCmd,
		&cobra.Command{
			Use:   "run [browser-use args...]",
			Short: "Pass arbitrary commands through to the Browser Use CLI",
			Args:  cobra.ArbitraryArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				if len(args) == 0 {
					return fmt.Errorf("usage: solanaos browseruse run [browser-use args...]")
				}
				return runBrowserUseArgs(cmd, args)
			},
		},
	)

	return cmd
}

// ── Agent Command ────────────────────────────────────────────────────

func NewAgentCommand() *cobra.Command {
	var message string

	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Chat with the SolanaOS agent",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			if message != "" {
				reply, err := chatAgentOnce(cfg, "cli-once", message)
				if err != nil {
					return err
				}
				fmt.Printf("%s[SOLANAOS]%s %s\n", colorGreen, colorReset, reply)
				return nil
			}

			fmt.Printf("%s🖥️ SolanaOS Console%s\n", colorGreen, colorReset)
			fmt.Printf("%sModel: %s | Workspace: %s%s\n", colorDim,
				cfg.Agents.Defaults.ModelName, cfg.Agents.Defaults.Workspace, colorReset)
			fmt.Printf("%sMemory commands: !remember, !recall, !trades, !lessons, !status%s\n\n",
				colorDim, colorReset)

			return runInteractiveAgent(cfg)
		},
	}

	cmd.Flags().StringVarP(&message, "message", "m", "", "Single message to send")
	return cmd
}

// ── OODA Command — fully wired ────────────────────────────────────────

func NewOODACommand() *cobra.Command {
	var (
		interval int
		hwBus    int
		noHW     bool
		simMode  bool
	)

	cmd := &cobra.Command{
		Use:   "ooda",
		Short: "Start autonomous OODA trading loop",
		Long: `Start the Observe-Orient-Decide-Act autonomous trading cycle.

  OBSERVE  : Helius slot + SOL price + Solana Tracker OHLCV + Aster funding
  ORIENT   : RSI/EMA/ATR strategy evaluation + ClawVault recall
  DECIDE   : Signal scoring (strength × confidence threshold)
  ACT      : Open/close positions, store vault entries, adjust params

Hardware integration (when --hw-bus is set):
  Pixels  → live status (idle/signal/trade/win/loss)
  Buzzer  → audio alerts
  Button A → trigger immediate cycle
  Button B → toggle simulated/live mode
  Button C → emergency stop
  Knob    → real-time RSI threshold tuning`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			if interval > 0 {
				cfg.OODA.IntervalSeconds = interval
			}
			if simMode {
				cfg.OODA.Mode = "simulated"
			}

			fmt.Printf("%s🔄 SolanaOS OODA Loop%s\n", colorGreen, colorReset)
			fmt.Printf("%sMode: %s | Interval: %ds | Watchlist: %d tokens%s\n",
				colorDim, cfg.OODA.Mode, cfg.OODA.IntervalSeconds,
				len(cfg.OODA.Watchlist), colorReset)
			fmt.Printf("%sStrategy: RSI(%d/%d) EMA(%d/%d) SL=%.0f%% TP=%.0f%%%s\n",
				colorDim,
				cfg.Strategy.RSIOversold, cfg.Strategy.RSIOverbought,
				cfg.Strategy.EMAFastPeriod, cfg.Strategy.EMASlowPeriod,
				cfg.Strategy.StopLossPct*100, cfg.Strategy.TakeProfitPct*100,
				colorReset)

			// ── Build hooks: hardware adapter + console logger ───────────
			var hooks agent.AgentHooks = &consoleHooks{}
			var hwAdapter *hardware.HardwareAdapter
			var ooda *agent.OODAAgent

			if !noHW {
				hwCfg := hardware.DefaultAdapterConfig()
				hwCfg.I2CBusNum = hwBus
				controls := hardware.AgentControls{
					TriggerCycle: func() {
						if ooda != nil {
							ooda.TriggerCycle()
						}
					},
					SetMode: func(mode string) {
						if ooda != nil {
							ooda.SetMode(mode)
						}
					},
					EmergencyStop: func() {
						if ooda != nil {
							ooda.Stop()
						}
					},
					AdjustRSI: func(delta int) {
						if ooda != nil {
							ooda.AdjustRSI(delta)
						}
					},
				}

				hwAdapter = hardware.NewHardwareAdapter(hwCfg, controls)

				if hwAdapter.IsConnected() {
					sensors := hwAdapter.ConnectedSensors()
					fmt.Printf("%s🎛  Hardware: %v%s\n", colorTeal, sensors, colorReset)
					hooks = agent.NewMultiHooks(&consoleHooks{}, hwAdapter)
				} else {
					fmt.Printf("%s🎛  Hardware: not connected (stub mode)%s\n", colorDim, colorReset)
				}
			}

			fmt.Println()

			// ── Create agent ──────────────────────────────────────────────
			ooda = agent.NewOODAAgent(cfg, hooks)

			if hwAdapter != nil && hwAdapter.IsConnected() {
				hwAdapter.Start()
				defer hwAdapter.Stop()
			}

			// ── Start agent ───────────────────────────────────────────────
			if err := ooda.Start(); err != nil {
				return fmt.Errorf("agent start: %w", err)
			}

			// ── Wait for SIGINT/SIGTERM ────────────────────────────────────
			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			sig := <-sigCh

			fmt.Printf("\n%s[OODA] Received %s — shutting down gracefully...%s\n",
				colorAmber, sig, colorReset)
			ooda.Stop()

			// Print final stats
			stats := ooda.GetStats()
			fmt.Printf("\n%s📊 Final Stats:%s\n", colorGreen, colorReset)
			fmt.Printf("  Cycles:     %v\n", stats["cycles"])
			fmt.Printf("  Closed:     %v trades\n", stats["closed_trades"])
			fmt.Printf("  Win Rate:   %.1f%%\n", stats["win_rate"])
			fmt.Printf("  Avg PnL:    %.2f%%\n", stats["avg_pnl_pct"])

			return nil
		},
	}

	cmd.Flags().IntVar(&interval, "interval", 0, "Cycle interval in seconds (overrides config)")
	cmd.Flags().IntVar(&hwBus, "hw-bus", 1, "I2C bus number for Modulino® hardware")
	cmd.Flags().BoolVar(&noHW, "no-hw", false, "Disable hardware integration")
	cmd.Flags().BoolVar(&simMode, "sim", false, "Force simulated mode (no live trades)")
	return cmd
}

// ── Gateway Command (legacy — channels) ──────────────────────────────

func NewGatewayCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "channels",
		Short: "Start the SolanaOS channel gateway (Telegram, Discord)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			fmt.Printf("%s🖥️ SolanaOS Channel Gateway starting...%s\n", colorGreen, colorReset)
			fmt.Printf("%sHost: %s:%d%s\n", colorDim, cfg.Gateway.Host, cfg.Gateway.Port, colorReset)

			if cfg.Channels.Telegram.Enabled {
				fmt.Printf("  %s✓%s Telegram\n", colorGreen, colorReset)
			}
			if cfg.Channels.Discord.Enabled {
				fmt.Printf("  %s✓%s Discord\n", colorGreen, colorReset)
			}

			fmt.Printf("\n%sSolana:%s\n", colorAmber, colorReset)
			fmt.Printf("  Helius:  %s\n", boolIcon(cfg.Solana.HeliusAPIKey != ""))
			fmt.Printf("  Solana Tracker: %s\n", boolIcon(cfg.Solana.SolanaTrackerAPIKey != ""))
			fmt.Printf("  Jupiter: %s\n", boolIcon(cfg.Solana.JupiterEndpoint != ""))

			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			<-sigCh
			return nil
		},
	}
}

// ── Native Gateway Command (TCP bridge) ──────────────────────────────

func NewNativeGatewayCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "gateway",
		Short: "SolanaOS native TCP bridge gateway",
		Long: `The SolanaOS native gateway — a Go TCP bridge server that connects
headless hardware nodes to the daemon over Tailscale mesh networking.
No external dependencies required.`,
	}

	var (
		port     int
		bindAddr string
		noTS     bool
	)

	startCmd := &cobra.Command{
		Use:   "start",
		Short: "Start the native gateway bridge server",
		Example: `  solanaos gateway start
  solanaos gateway start --port 19001
  solanaos gateway start --bind 100.88.46.29`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()

			bridgeCfg := gw.BridgeConfig{
				Port:         port,
				BindAddr:     bindAddr,
				UseTailscale: !noTS,
			}
			if bridgeCfg.Port == 0 {
				bridgeCfg.Port = cfg.GatewaySpawn.Port
			}

			fmt.Printf("%s🖥️ SolanaOS Gateway%s\n\n", colorGreen, colorReset)

			bridge := gw.NewBridge(bridgeCfg, nil)

			// Attach LLM provider for chat inference.
			applyConfigEnv := func() {
				// Read config file and set env vars so llm.New() picks them up.
				_, _, parsed, _ := bridge.LoadConfigFilePublic()
				if llmCfg, ok := parsed["llm"].(map[string]any); ok {
					envMap := map[string]string{
						"openrouter_key":  "OPENROUTER_API_KEY",
						"anthropic_key":   "ANTHROPIC_API_KEY",
						"xai_key":         "XAI_API_KEY",
						"openai_key":      "OPENAI_API_KEY",
						"ollama_model":    "OLLAMA_MODEL",
						"ollama_base_url": "OLLAMA_BASE_URL",
						"provider":        "LLM_PROVIDER",
					}
					for cfgKey, envKey := range envMap {
						if v, ok := llmCfg[cfgKey].(string); ok && v != "" {
							os.Setenv(envKey, v)
						}
					}
				}
				if solanaCfg, ok := parsed["solana"].(map[string]any); ok {
					if v, ok := solanaCfg["birdeye_api_key"].(string); ok && v != "" {
						os.Setenv("BIRDEYE_API_KEY", v)
					}
				}
			}
			applyConfigEnv()

			llmClient := llm.New()
			if llmClient.IsConfigured() {
				bridge.SetLLM(llmClient)
				fmt.Printf("%s🤖 LLM attached: %s / %s%s\n", colorGreen, llmClient.Provider(), llmClient.Model(), colorReset)
			} else {
				fmt.Printf("%s⚠️  No LLM configured — chat will be view-only. Set OPENROUTER_API_KEY or similar in .env%s\n", colorAmber, colorReset)
			}

			// Register reload callback so config.apply can hot-swap the LLM.
			bridge.SetReloadLLM(func() gw.LLMProvider {
				applyConfigEnv()
				client := llm.New()
				if client.IsConfigured() {
					log.Printf("[GATEWAY] 🤖 LLM reloaded: %s / %s", client.Provider(), client.Model())
				} else {
					log.Printf("[GATEWAY] ⚠️ LLM reload: no provider configured")
				}
				return client
			})

			// Attach skills provider.
			skillsDir := skills.ResolveSkillsDir()
			if skillsDir != "" {
				if mgr, err := skills.NewManager(skillsDir); err == nil && mgr.Count() > 0 {
					bridge.SetSkills(&skillsAdapter{mgr: mgr})
					fmt.Printf("%s📚 Skills loaded: %d from %s%s\n", colorGreen, mgr.Count(), skillsDir, colorReset)
				}
			}

			ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer cancel()

			if err := bridge.Start(ctx); err != nil {
				return err
			}

			files, err := writeGatewayConnectFiles(cfg, resolveGatewaySetupURL(cfg, bridge.BridgeAddr()))
			if err != nil {
				return err
			}

			fmt.Printf("\n%sBridge: %s%s\n", colorTeal, bridge.BridgeAddr(), colorReset)
			fmt.Printf("%sPair:   solanaos node pair --bridge %s%s\n", colorDim, bridge.BridgeAddr(), colorReset)
			fmt.Printf("%sRun:    solanaos node run  --bridge %s%s\n\n", colorDim, bridge.BridgeAddr(), colorReset)
			printGatewaySetupCode(files)

			fmt.Printf("\n%s🖥️  SolanaOS Office: http://%s%s\n", colorTeal, "office.solanaos.net", colorReset)
			fmt.Printf("%s   Local dev: cd Claw3D-main && npm run dev%s\n\n", colorDim, colorReset)

			<-ctx.Done()
			bridge.Stop()
			return nil
		},
	}

	startCmd.Flags().IntVar(&port, "port", 18790, "Bridge port")
	startCmd.Flags().StringVar(&bindAddr, "bind", "", "Bind address (default: Tailscale IP or 0.0.0.0)")
	startCmd.Flags().BoolVar(&noTS, "no-tailscale", false, "Don't use Tailscale IP")

	stopCmd := &cobra.Command{
		Use:   "stop",
		Short: "Stop the gateway tmux session",
		RunE: func(cmd *cobra.Command, args []string) error {
			session := "solanaos-gw"
			if err := gw.KillGateway(session); err != nil {
				return err
			}
			fmt.Printf("  %s✔%s Gateway session '%s' killed\n", colorGreen, colorReset, session)
			return nil
		},
	}

	var (
		setupBridge string
		setupHost   string
		setupPort   int
	)

	setupCodeCmd := &cobra.Command{
		Use:   "setup-code",
		Short: "Print and persist the Solana Seeker gateway setup code",
		Example: `  solanaos gateway setup-code
  solanaos gateway setup-code --bridge 100.88.46.29:18790
  solanaos gateway setup-code --host 127.0.0.1 --port 18790`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			gatewayURL := ""
			switch {
			case strings.TrimSpace(setupBridge) != "":
				gatewayURL = resolveGatewaySetupURL(cfg, strings.TrimSpace(setupBridge))
			case strings.TrimSpace(setupHost) != "":
				resolvedPort := setupPort
				if resolvedPort <= 0 {
					resolvedPort = 18790
				}
				gatewayURL = fmt.Sprintf("http://%s:%d", strings.TrimSpace(setupHost), resolvedPort)
			default:
				gatewayURL = resolveGatewaySetupURL(cfg, "")
			}

			files, err := writeGatewayConnectFiles(cfg, gatewayURL)
			if err != nil {
				return err
			}

			fmt.Printf("%s🖥️ SolanaOS Gateway Setup%s\n\n", colorGreen, colorReset)
			fmt.Printf("%sGateway: %s%s\n", colorTeal, files.GatewayURL, colorReset)
			if files.AuthMode != "" {
				fmt.Printf("%sAuth:    %s%s\n\n", colorDim, files.AuthMode, colorReset)
			} else {
				fmt.Printf("%sAuth:    none%s\n\n", colorDim, colorReset)
			}
			printGatewaySetupCode(files)
			return nil
		},
	}
	setupCodeCmd.Flags().StringVar(&setupBridge, "bridge", "", "Existing bridge address to encode (host:port)")
	setupCodeCmd.Flags().StringVar(&setupHost, "host", "", "Gateway host override")
	setupCodeCmd.Flags().IntVar(&setupPort, "port", 18790, "Gateway port override")

	cmd.AddCommand(startCmd, stopCmd, setupCodeCmd)
	return cmd
}

// ── Onboard ──────────────────────────────────────────────────────────

func NewOnboardCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "onboard",
		Short: "Set up SolanaOS with your LLM provider, Solana keys, and Telegram",
		Long: `Interactive onboarding wizard for SolanaOS.

Sets up your LLM provider (Ollama, OpenRouter, Anthropic, xAI, OpenAI),
Solana RPC keys, Birdeye API, and Telegram bot. Writes config to
~/.nanosolana/solanaos.json.`,
		Example: `  solanaos onboard
  solanaos onboard --provider ollama`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s🖥️ Welcome to SolanaOS%s\n\n", colorGreen, colorReset)

			if err := config.EnsureDefaults(); err != nil {
				return fmt.Errorf("onboard: %w", err)
			}

			cfgPath := config.DefaultConfigPath()
			fmt.Printf("Config: %s%s%s\n\n", colorTeal, cfgPath, colorReset)

			reader := bufio.NewReader(os.Stdin)
			cfg := make(map[string]any)

			// Load existing config
			if data, err := os.ReadFile(cfgPath); err == nil {
				_ = json.Unmarshal(data, &cfg)
			}

			// ── LLM Provider ────────────────────────────────────
			fmt.Printf("%s── LLM Provider ──────────────────────────────────%s\n", colorPurple, colorReset)
			fmt.Printf("  1) %sOllama%s (local, free — minimax-m2.7:cloud)\n", colorGreen, colorReset)
			fmt.Printf("  2) %sOpenRouter%s (multi-model, API key)\n", colorTeal, colorReset)
			fmt.Printf("  3) %sAnthropic%s (Claude, API key)\n", colorPurple, colorReset)
			fmt.Printf("  4) %sxAI%s (Grok, API key)\n", colorAmber, colorReset)
			fmt.Printf("  5) %sOpenAI%s (GPT, API key)\n", colorGreen, colorReset)
			fmt.Printf("  6) Skip\n")
			fmt.Printf("\n%sChoose [1-6]:%s ", colorTeal, colorReset)

			choice, _ := reader.ReadString('\n')
			choice = strings.TrimSpace(choice)

			llmCfg := make(map[string]any)
			switch choice {
			case "1":
				llmCfg["provider"] = "ollama"
				fmt.Printf("%sOllama model%s [minimax-m2.7:cloud]: ", colorDim, colorReset)
				model, _ := reader.ReadString('\n')
				model = strings.TrimSpace(model)
				if model == "" {
					model = "minimax-m2.7:cloud"
				}
				llmCfg["ollama_model"] = model
				llmCfg["ollama_base_url"] = "http://127.0.0.1:11434"
				fmt.Printf("  %s✓ Ollama / %s%s\n\n", colorGreen, model, colorReset)
			case "2":
				llmCfg["provider"] = "openrouter"
				fmt.Printf("%sOpenRouter API Key:%s ", colorDim, colorReset)
				key, _ := reader.ReadString('\n')
				key = strings.TrimSpace(key)
				if key != "" {
					llmCfg["openrouter_key"] = key
				}
				fmt.Printf("%sModel%s [minimax/minimax-m2.7]: ", colorDim, colorReset)
				model, _ := reader.ReadString('\n')
				model = strings.TrimSpace(model)
				if model == "" {
					model = "minimax/minimax-m2.7"
				}
				llmCfg["openrouter_model"] = model
				fmt.Printf("  %s✓ OpenRouter / %s%s\n\n", colorGreen, model, colorReset)
			case "3":
				llmCfg["provider"] = "anthropic"
				fmt.Printf("%sAnthropic API Key:%s ", colorDim, colorReset)
				key, _ := reader.ReadString('\n')
				key = strings.TrimSpace(key)
				if key != "" {
					llmCfg["anthropic_key"] = key
				}
				fmt.Printf("%sModel%s [claude-sonnet-4-6]: ", colorDim, colorReset)
				model, _ := reader.ReadString('\n')
				model = strings.TrimSpace(model)
				if model == "" {
					model = "claude-sonnet-4-6"
				}
				llmCfg["anthropic_model"] = model
				fmt.Printf("  %s✓ Anthropic / %s%s\n\n", colorGreen, model, colorReset)
			case "4":
				llmCfg["provider"] = "xai"
				fmt.Printf("%sxAI API Key:%s ", colorDim, colorReset)
				key, _ := reader.ReadString('\n')
				key = strings.TrimSpace(key)
				if key != "" {
					llmCfg["xai_key"] = key
				}
				fmt.Printf("  %s✓ xAI / Grok%s\n\n", colorGreen, colorReset)
			case "5":
				llmCfg["provider"] = "openai"
				fmt.Printf("%sOpenAI API Key:%s ", colorDim, colorReset)
				key, _ := reader.ReadString('\n')
				key = strings.TrimSpace(key)
				if key != "" {
					llmCfg["openai_key"] = key
				}
				fmt.Printf("  %s✓ OpenAI / GPT%s\n\n", colorGreen, colorReset)
			default:
				fmt.Printf("  %sSkipped LLM setup%s\n\n", colorDim, colorReset)
			}
			if len(llmCfg) > 0 {
				cfg["llm"] = llmCfg
			}

			// ── Solana ──────────────────────────────────────────
			fmt.Printf("%s── Solana ────────────────────────────────────────%s\n", colorAmber, colorReset)
			fmt.Printf("%sSolanaTracker API Key%s (enter to skip): ", colorDim, colorReset)
			stKey, _ := reader.ReadString('\n')
			stKey = strings.TrimSpace(stKey)

			fmt.Printf("%sBirdeye API Key%s (enter to skip): ", colorDim, colorReset)
			beKey, _ := reader.ReadString('\n')
			beKey = strings.TrimSpace(beKey)

			solanaCfg := make(map[string]any)
			if stKey != "" {
				solanaCfg["solana_tracker_api_key"] = stKey
			}
			if beKey != "" {
				solanaCfg["birdeye_api_key"] = beKey
			}
			if len(solanaCfg) > 0 {
				cfg["solana"] = solanaCfg
				fmt.Printf("  %s✓ Solana keys configured%s\n\n", colorGreen, colorReset)
			} else {
				fmt.Printf("  %sSkipped Solana setup%s\n\n", colorDim, colorReset)
			}

			// ── Telegram ────────────────────────────────────────
			fmt.Printf("%s── Telegram ──────────────────────────────────────%s\n", colorTeal, colorReset)
			fmt.Printf("%sBot Token%s (enter to skip): ", colorDim, colorReset)
			botToken, _ := reader.ReadString('\n')
			botToken = strings.TrimSpace(botToken)

			if botToken != "" {
				fmt.Printf("%sYour Telegram Chat ID%s: ", colorDim, colorReset)
				chatID, _ := reader.ReadString('\n')
				chatID = strings.TrimSpace(chatID)
				tgCfg := map[string]any{"bot_token": botToken}
				if chatID != "" {
					tgCfg["chat_id"] = chatID
				}
				cfg["telegram"] = tgCfg
				fmt.Printf("  %s✓ Telegram configured%s\n\n", colorGreen, colorReset)
			} else {
				fmt.Printf("  %sSkipped Telegram setup%s\n\n", colorDim, colorReset)
			}

			// ── Write config ────────────────────────────────────
			data, err := json.MarshalIndent(cfg, "", "  ")
			if err != nil {
				return fmt.Errorf("marshal config: %w", err)
			}
			if err := os.WriteFile(cfgPath, data, 0o644); err != nil {
				return fmt.Errorf("write config: %w", err)
			}

			fmt.Printf("%s✓ Config saved to %s%s\n\n", colorGreen, cfgPath, colorReset)
			fmt.Printf("Next steps:\n")
			fmt.Printf("  %ssolanaos gateway start --bind 0.0.0.0%s   # start gateway\n", colorGreen, colorReset)
			fmt.Printf("  %ssolanaos server%s                          # start Control UI\n", colorGreen, colorReset)
			fmt.Printf("  %scd Claw3D-main && npm run dev%s            # start Office 3D\n", colorGreen, colorReset)
			fmt.Printf("\n  %sControl UI:%s  http://127.0.0.1:7777\n", colorTeal, colorReset)
			fmt.Printf("  %sOffice 3D:%s   http://localhost:3000\n", colorTeal, colorReset)
			fmt.Printf("  %sHub:%s         https://seeker.solanaos.net\n\n", colorTeal, colorReset)
			return nil
		},
	}
}

// ── Status ───────────────────────────────────────────────────────────

func NewStatusCommand() *cobra.Command {
	var hwBus int

	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show SolanaOS system status",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			fmt.Printf("%s🖥️ SolanaOS Status%s\n\n", colorGreen, colorReset)
			fmt.Printf("Version:    %s\n", config.FormatVersion())
			buildTime, goVer := config.FormatBuildInfo()
			fmt.Printf("Go:         %s\n", goVer)
			if buildTime != "" {
				fmt.Printf("Built:      %s\n", buildTime)
			}

			fmt.Printf("\n%sOODA:%s\n", colorTeal, colorReset)
			fmt.Printf("  Mode:     %s\n", cfg.OODA.Mode)
			fmt.Printf("  Interval: %ds\n", cfg.OODA.IntervalSeconds)
			fmt.Printf("  Watchlist:%d tokens\n", len(cfg.OODA.Watchlist))
			fmt.Printf("  AutoOpt:  %v\n", cfg.OODA.AutoOptimize)

			fmt.Printf("\n%sStrategy:%s\n", colorPurple, colorReset)
			fmt.Printf("  RSI:      oversold=%d overbought=%d\n",
				cfg.Strategy.RSIOversold, cfg.Strategy.RSIOverbought)
			fmt.Printf("  EMA:      fast=%d slow=%d\n",
				cfg.Strategy.EMAFastPeriod, cfg.Strategy.EMASlowPeriod)
			fmt.Printf("  SL/TP:    %.0f%% / %.0f%%\n",
				cfg.Strategy.StopLossPct*100, cfg.Strategy.TakeProfitPct*100)

			fmt.Printf("\n%sSolana:%s\n", colorAmber, colorReset)
			fmt.Printf("  Helius:   %s\n", boolIcon(cfg.Solana.HeliusAPIKey != ""))
			fmt.Printf("  Solana Tracker: %s\n", boolIcon(cfg.Solana.SolanaTrackerAPIKey != ""))
			fmt.Printf("  Jupiter:  %s\n", boolIcon(cfg.Solana.JupiterEndpoint != ""))
			fmt.Printf("  Aster:    %s\n", boolIcon(cfg.Solana.AsterAPIKey != ""))
			fmt.Printf("  Wallet:   %s\n", truncate(cfg.Solana.WalletPubkey, 24))

			fmt.Printf("\n%sHardware (I2C bus %d):%s\n", colorTeal, hwBus, colorReset)
			hwCfg := hardware.DefaultAdapterConfig()
			hwCfg.I2CBusNum = hwBus
			hw := hardware.NewHardwareAdapter(hwCfg, hardware.AgentControls{})
			if hw.IsConnected() {
				hw.PrintStatus()
			} else {
				fmt.Printf("  %s✗ No hardware detected%s\n", colorRed, colorReset)
			}

			return nil
		},
	}

	cmd.Flags().IntVar(&hwBus, "hw-bus", 1, "I2C bus number to check")
	return cmd
}

func runBrowserUseStatus(cmd *cobra.Command) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config error: %w", err)
	}

	status := browserusepkg.Inspect(cfg.Tools.BrowserUse)

	fmt.Printf("%s🌐 Browser Use%s\n\n", colorGreen, colorReset)
	fmt.Printf("Enabled:   %s\n", boolIcon(status.Enabled))
	if status.Installed {
		fmt.Printf("CLI:       %s %s\n", boolIcon(true), status.BinaryPath)
	} else {
		fmt.Printf("CLI:       %s not installed\n", boolIcon(false))
	}
	if status.APIKeyConfigured {
		fmt.Printf("API key:   %s configured\n", boolIcon(true))
	} else {
		fmt.Printf("API key:   %s missing\n", boolIcon(false))
	}
	fmt.Printf("Provider:  %s", status.CloudProvider)
	if status.ProviderReady {
		fmt.Printf(" %s configured\n", boolIcon(true))
	} else {
		fmt.Printf(" %s not configured\n", boolIcon(false))
	}
	fmt.Printf("Session:   %s\n", status.Session)
	if strings.TrimSpace(status.Profile) != "" {
		fmt.Printf("Profile:   %s\n", status.Profile)
	}
	if status.Connect {
		fmt.Printf("Connect:   %v\n", status.Connect)
	}
	if strings.TrimSpace(status.CDPURL) != "" {
		fmt.Printf("CDP URL:   %s\n", status.CDPURL)
	}
	if strings.TrimSpace(status.BrowserbaseProjectID) != "" {
		fmt.Printf("BB Proj:   %s\n", status.BrowserbaseProjectID)
	}
	fmt.Printf("Headed:    %v\n", status.Headed)
	fmt.Printf("Cloud:     %v\n", status.Cloud)
	if strings.TrimSpace(status.CloudProfileID) != "" {
		fmt.Printf("Cloud profile: %s\n", status.CloudProfileID)
	}
	if strings.TrimSpace(status.CloudProxy) != "" {
		fmt.Printf("Cloud proxy:   %s\n", status.CloudProxy)
	}
	if status.CloudTimeoutMin > 0 {
		fmt.Printf("Cloud timeout: %d min\n", status.CloudTimeoutMin)
	}
	if strings.TrimSpace(status.Home) != "" {
		fmt.Printf("Home:      %s\n", status.Home)
	}

	if !status.Installed {
		fmt.Printf("\nInstall:\n  curl -fsSL https://browser-use.com/cli/install.sh | bash\n")
	}
	if !status.APIKeyConfigured {
		fmt.Printf("\nSet BROWSERUSE_API_KEY or BROWSER_USE_API_KEY in your .env to use Browser Use cloud login.\n")
	}
	if !status.ProviderReady {
		fmt.Printf("Set BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID or configure BROWSERUSE_API_KEY, then run:\n  solanaos browseruse connect\n")
	}
	return nil
}

func runBrowserUseConnect(cmd *cobra.Command) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config error: %w", err)
	}

	ctx, cancel := context.WithTimeout(cmd.Context(), 90*time.Second)
	defer cancel()

	result, err := browserusepkg.Connect(ctx, cfg.Tools.BrowserUse)
	if err != nil {
		if result != nil && !result.Status.Installed {
			return fmt.Errorf("browser-use CLI is not installed\ninstall it with: curl -fsSL https://browser-use.com/cli/install.sh | bash")
		}
		return err
	}

	fmt.Printf("%s🌐 Browser Use Connected%s\n\n", colorGreen, colorReset)
	fmt.Printf("Provider:  %s\n", result.Status.CloudProvider)
	if result.Session.SessionName != "" {
		fmt.Printf("Session:   %s\n", result.Session.SessionName)
	}
	if result.Session.ProviderSessionID != "" {
		fmt.Printf("Cloud ID:  %s\n", truncate(result.Session.ProviderSessionID, 24))
	}
	if result.Session.CDPURL != "" {
		fmt.Printf("CDP URL:   %s\n", result.Session.CDPURL)
	}
	if len(result.Args) > 0 {
		fmt.Printf("Command:   %s\n", strings.Join(result.Args, " "))
	}
	if strings.TrimSpace(result.Output) != "" {
		fmt.Printf("\n%s\n", result.Output)
	}
	return nil
}

func runBrowserUseArgs(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config error: %w", err)
	}

	ctx, cancel := context.WithTimeout(cmd.Context(), 90*time.Second)
	defer cancel()

	result, err := browserusepkg.Run(ctx, cfg.Tools.BrowserUse, args...)
	if err != nil {
		if result != nil && !result.Status.Installed {
			return fmt.Errorf("browser-use CLI is not installed\ninstall it with: curl -fsSL https://browser-use.com/cli/install.sh | bash")
		}
		return err
	}

	fmt.Printf("%s🌐 Browser Use Result%s\n\n", colorGreen, colorReset)
	fmt.Printf("Command:   %s\n", strings.Join(result.Args, " "))
	fmt.Printf("CLI:       %s\n", result.Status.BinaryPath)
	fmt.Printf("Session:   %s\n", result.Status.Session)
	if strings.TrimSpace(result.Status.Profile) != "" {
		fmt.Printf("Profile:   %s\n", result.Status.Profile)
	}
	if result.Status.Connect {
		fmt.Printf("Connect:   %v\n", result.Status.Connect)
	}
	if strings.TrimSpace(result.Status.CDPURL) != "" {
		fmt.Printf("CDP URL:   %s\n", result.Status.CDPURL)
	}
	if strings.TrimSpace(result.Output) != "" {
		fmt.Printf("\n%s\n", result.Output)
	}
	return nil
}

func runBrowserUseClose(cmd *cobra.Command, sessionName string, all bool) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config error: %w", err)
	}

	ctx, cancel := context.WithTimeout(cmd.Context(), 90*time.Second)
	defer cancel()

	result, err := browserusepkg.Close(ctx, cfg.Tools.BrowserUse, sessionName, all)
	if err != nil {
		return err
	}

	fmt.Printf("%s🌐 Browser Use Close%s\n\n", colorGreen, colorReset)
	fmt.Printf("Provider:  %s\n", result.Status.CloudProvider)
	if all {
		fmt.Printf("Scope:     all sessions\n")
	} else if result.SessionName != "" {
		fmt.Printf("Session:   %s\n", result.SessionName)
	}
	if len(result.Closed) > 0 {
		fmt.Printf("Closed:    %s\n", strings.Join(result.Closed, ", "))
	}
	if len(result.Failed) > 0 {
		fmt.Printf("Failed:    %s\n", strings.Join(result.Failed, ", "))
	}
	if strings.TrimSpace(result.Output) != "" {
		fmt.Printf("\n%s\n", result.Output)
	}
	return nil
}

// ── Solana ───────────────────────────────────────────────────────────

func NewSolanaCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "solana",
		Short: "Solana on-chain tools (wallet, balance, portfolio, research, trending)",
	}

	cmd.AddCommand(
		&cobra.Command{
			Use:   "wallet",
			Short: "Show wallet info and balance",
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, _ := config.Load()
				fmt.Printf("%s💰 SolanaOS Wallet%s\n", colorGreen, colorReset)
				fmt.Printf("Pubkey:  %s\n", cfg.Solana.WalletPubkey)
				fmt.Printf("RPC:     %s\n", truncate(cfg.Solana.HeliusRPCURL, 50))
				fmt.Printf("MaxPos:  %.4f SOL\n", cfg.Solana.MaxPositionSOL)
				return nil
			},
		},
		&cobra.Command{
			Use:   "health",
			Short: "Check Helius RPC health and Solana network status",
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, _ := config.Load()
				oCfg := onchain.Config{
					HeliusRPCURL: cfg.Solana.HeliusRPCURL,
					HeliusAPIKey: cfg.Solana.HeliusAPIKey,
					HeliusWSSURL: cfg.Solana.HeliusWSSURL,
				}
				engine, err := onchain.NewEngine(oCfg)
				if err != nil {
					return fmt.Errorf("on-chain engine: %w", err)
				}
				defer engine.Close()

				ctx := cmd.Context()
				health, err := engine.CheckHealth(ctx)
				if err != nil {
					fmt.Printf("  %s✗%s Helius RPC: %v\n", colorRed, colorReset, err)
					return nil
				}

				fmt.Printf("%s⛓️  Solana Network Status%s\n\n", colorGreen, colorReset)
				fmt.Printf("  %sHealthy:%s  %s\n", colorDim, colorReset, boolIcon(health.Healthy))
				fmt.Printf("  %sVersion:%s  %s\n", colorDim, colorReset, health.Version)
				fmt.Printf("  %sSlot:%s     %d\n", colorDim, colorReset, health.Slot)
				fmt.Printf("  %sHeight:%s   %d\n", colorDim, colorReset, health.BlockHeight)
				fmt.Printf("  %sLatency:%s  %s\n", colorDim, colorReset, health.Latency.Round(time.Millisecond))

				// Priority fees
				fees, err := engine.GetPriorityFees(ctx)
				if err == nil {
					fmt.Printf("\n%s⚡ Priority Fees (µL)%s\n", colorAmber, colorReset)
					fmt.Printf("  Min:    %d\n", fees.Min)
					fmt.Printf("  Low:    %d\n", fees.Low)
					fmt.Printf("  Medium: %d\n", fees.Medium)
					fmt.Printf("  High:   %d\n", fees.High)
				}
				return nil
			},
		},
		&cobra.Command{
			Use:   "balance [pubkey]",
			Short: "Check SOL + token balances for a wallet",
			Args:  cobra.MaximumNArgs(1),
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, _ := config.Load()
				oCfg := onchain.Config{
					HeliusRPCURL: cfg.Solana.HeliusRPCURL,
					HeliusAPIKey: cfg.Solana.HeliusAPIKey,
					HeliusWSSURL: cfg.Solana.HeliusWSSURL,
				}
				engine, err := onchain.NewEngine(oCfg)
				if err != nil {
					return fmt.Errorf("on-chain engine: %w", err)
				}
				defer engine.Close()

				pubkeyStr := cfg.Solana.WalletPubkey
				if len(args) > 0 {
					pubkeyStr = args[0]
				}
				if pubkeyStr == "" {
					return fmt.Errorf("no pubkey — set SOLANA_WALLET_PUBKEY or pass as argument")
				}

				pubkey, err := solanago.PublicKeyFromBase58(pubkeyStr)
				if err != nil {
					return fmt.Errorf("invalid public key %q: %w", pubkeyStr, err)
				}
				ctx := cmd.Context()

				// SOL balance
				bal, err := engine.GetSOLBalance(ctx, pubkey)
				if err != nil {
					return fmt.Errorf("get balance: %w", err)
				}

				fmt.Printf("%s💰 Wallet: %s%s\n\n", colorGreen, pubkey.Short(6), colorReset)
				fmt.Printf("  %sSOL:%s    %.9f SOL (%d lamports)\n", colorAmber, colorReset, bal.SOL, bal.Lamports)

				// SPL tokens
				tokens, err := engine.GetTokenBalances(ctx, pubkey)
				if err != nil {
					fmt.Printf("  %s⚠️  Token fetch failed: %v%s\n", colorDim, err, colorReset)
					return nil
				}

				if len(tokens) > 0 {
					fmt.Printf("\n  %sSPL Tokens:%s\n", colorTeal, colorReset)
					for _, t := range tokens {
						mintShort := t.Mint
						if len(mintShort) > 12 {
							mintShort = t.Mint[:6] + "..." + t.Mint[len(t.Mint)-4:]
						}
						fmt.Printf("    %s  %.6f\n", mintShort, t.UIAmount)
					}
				} else {
					fmt.Printf("\n  %sNo SPL tokens%s\n", colorDim, colorReset)
				}

				return nil
			},
		},
		newSolanaPortfolioCommand(),
		newSolanaStatsCommand(),
		newSolanaPriceCommand(),
		&cobra.Command{
			Use:   "research [mint]",
			Short: "Deep research a Solana token",
			Args:  cobra.ExactArgs(1),
			RunE: func(cmd *cobra.Command, args []string) error {
				return runSolanaResearch(cmd.Context(), args[0])
			},
		},
		&cobra.Command{
			Use:   "trending",
			Short: "Show trending Solana tokens (Solana Tracker)",
			RunE: func(cmd *cobra.Command, args []string) error {
				return runSolanaTrending(cmd.Context())
			},
		},
		&cobra.Command{
			Use:   "register",
			Short: "Register this agent on-chain (devnet Metaplex NFT)",
			Long: `Mint a gasless NFT on Solana devnet to register this agent on-chain.
The NFT contains your agent's pubkey, version, skills, and a unique fingerprint.
This serves as the agent's verifiable on-chain identity.

Devnet SOL is auto-airdropped if needed (zero cost).`,
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, _ := config.Load()
				fmt.Printf("\n%s⛓️  SolanaOS Agent Registration%s\n\n", colorGreen, colorReset)

				// Load agent wallet
				wallet, err := solana.EnsureAgentWallet(cfg.Solana.WalletKeyPath)
				if err != nil {
					return fmt.Errorf("wallet required: %w", err)
				}
				fmt.Printf("  %sAgent:%s   %s\n", colorDim, colorReset, wallet.PublicKeyStr())

				// Check for existing registration
				if reg, err := onchain.LoadRegistration(); err == nil {
					fmt.Printf("  %sStatus:%s  Already registered!\n", colorDim, colorReset)
					fmt.Printf("  %sMint:%s    %s\n", colorDim, colorReset, reg.Result.MintAddress)
					fmt.Printf("  %sTx:%s      %s\n", colorDim, colorReset, reg.Result.TxSignature[:16]+"...")
					fmt.Printf("  %sNetwork:%s %s\n", colorDim, colorReset, reg.Result.Network)
					fmt.Printf("\n  %sExplorer: https://explorer.solana.com/address/%s?cluster=devnet%s\n\n",
						colorDim, reg.Result.MintAddress, colorReset)
					return nil
				}

				// Skills from config
				skills := []string{"ooda-trading", "solana-rpc", "jupiter-swaps"}
				if cfg.Solana.SolanaTrackerAPIKey != "" {
					skills = append(skills, "solana-tracker-data")
				}
				if cfg.Solana.AsterAPIKey != "" {
					skills = append(skills, "aster-perps")
				}

				fmt.Printf("  %sSkills:%s  %v\n", colorDim, colorReset, skills)
				fmt.Printf("  %sNetwork:%s devnet (gasless)\n\n", colorDim, colorReset)

				ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
				defer cancel()

				result, err := onchain.RegisterAgent(ctx, wallet.GetPrivateKey(), config.FormatVersion(), skills)
				if err != nil {
					return fmt.Errorf("registration failed: %w", err)
				}

				fmt.Printf("\n  %s✅ Agent registered on-chain!%s\n\n", colorGreen, colorReset)
				fmt.Printf("  %sMint:%s    %s\n", colorDim, colorReset, result.MintAddress)
				fmt.Printf("  %sTx:%s      %s\n", colorDim, colorReset, result.TxSignature[:16]+"...")
				fmt.Printf("  %sNetwork:%s %s\n", colorDim, colorReset, result.Network)
				fmt.Printf("  %sSaved:%s   ~/.nanosolana/registry/registration.json\n\n", colorDim, colorReset)
				fmt.Printf("  %sExplorer: https://explorer.solana.com/tx/%s?cluster=devnet%s\n\n",
					colorAmber, result.TxSignature, colorReset)
				return nil
			},
		},
		newSwapCommand(),
		&cobra.Command{
			Use:   "registry",
			Short: "Show on-chain agent registration status",
			RunE: func(cmd *cobra.Command, args []string) error {
				if state, err := agentregistry.LoadState(); err == nil {
					fmt.Printf("\n%s🔗  Solana Agent Registry (8004)%s\n\n", colorGreen, colorReset)
					fmt.Printf("  %sStatus:%s  %s\n", colorDim, colorReset, state.Status)
					if state.Action != "" {
						fmt.Printf("  %sAction:%s  %s\n", colorDim, colorReset, state.Action)
					}
					if state.Cluster != "" {
						fmt.Printf("  %sCluster:%s %s\n", colorDim, colorReset, state.Cluster)
					}
					if state.Wallet != "" {
						fmt.Printf("  %sWallet:%s  %s\n", colorDim, colorReset, state.Wallet)
					}
					if state.Asset != "" {
						fmt.Printf("  %sAsset:%s   %s\n", colorDim, colorReset, state.Asset)
					}
					if state.TokenURI != "" {
						fmt.Printf("  %sURI:%s     %s\n", colorDim, colorReset, state.TokenURI)
					}
					if state.Trigger != "" {
						fmt.Printf("  %sTrigger:%s %s\n", colorDim, colorReset, state.Trigger)
					}
					if state.SyncedAt != "" {
						fmt.Printf("  %sSynced:%s  %s\n", colorDim, colorReset, state.SyncedAt)
					}
					if state.Reason != "" {
						fmt.Printf("  %sReason:%s  %s\n", colorDim, colorReset, state.Reason)
					}
					if state.Error != "" {
						fmt.Printf("  %sError:%s   %s\n", colorDim, colorReset, state.Error)
					}
					if state.Pump != nil {
						if mint, ok := state.Pump["agentMint"].(string); ok && mint != "" {
							fmt.Printf("  %sPump:%s    %s\n", colorDim, colorReset, mint)
						}
					}
					fmt.Printf("  %sState:%s   %s\n\n", colorDim, colorReset, agentregistry.StatePath())
					return nil
				}

				reg, err := onchain.LoadRegistration()
				if err != nil {
					fmt.Printf("%s⚠️  No registration found. Run: solanaos solana register%s\n", colorAmber, colorReset)
					return nil
				}
				fmt.Printf("\n%s⛓️  Agent Registration%s\n\n", colorGreen, colorReset)
				fmt.Printf("  %sAgent:%s   %s\n", colorDim, colorReset, reg.Result.AgentPubkey)
				fmt.Printf("  %sMint:%s    %s\n", colorDim, colorReset, reg.Result.MintAddress)
				fmt.Printf("  %sTx:%s      %s\n", colorDim, colorReset, reg.Result.TxSignature[:16]+"...")
				fmt.Printf("  %sNetwork:%s %s\n", colorDim, colorReset, reg.Result.Network)
				fmt.Printf("  %sSaved:%s   %s\n\n", colorDim, colorReset, reg.SavedAt)
				fmt.Printf("  %sExplorer:%s https://explorer.solana.com/address/%s?cluster=devnet%s\n\n",
					colorDim, colorReset, reg.Result.MintAddress, colorReset)
				return nil
			},
		},
	)

	return cmd
}

// newSwapCommand implements `solanaos solana swap`.
func newSwapCommand() *cobra.Command {
	var outputMint string
	var amountSOL float64
	var slippageBps int
	var simulate bool

	cmd := &cobra.Command{
		Use:   "swap",
		Short: "Swap SOL for a token via Jupiter",
		Example: `  solanaos solana swap --out 5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump --amount 0.01
  solanaos solana swap --out 5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump --amount 0.01 --sim`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if outputMint == "" {
				return fmt.Errorf("--out <token-mint> is required")
			}
			if amountSOL <= 0 {
				return fmt.Errorf("--amount must be > 0")
			}

			cfg, _ := config.Load()
			oCfg := onchain.Config{
				HeliusRPCURL: cfg.Solana.HeliusRPCURL,
				HeliusAPIKey: cfg.Solana.HeliusAPIKey,
				HeliusWSSURL: cfg.Solana.HeliusWSSURL,
			}
			engine, err := onchain.NewEngine(oCfg)
			if err != nil {
				return fmt.Errorf("on-chain engine: %w", err)
			}
			defer engine.Close()

			wallet, err := solana.EnsureAgentWallet(cfg.Solana.WalletKeyPath)
			if err != nil {
				return fmt.Errorf("wallet: %w", err)
			}

			lamports := uint64(amountSOL * 1e9)
			inputMint := onchain.SOLMint

			fmt.Printf("%s🔄 Swap%s  %.6f SOL → %s\n", colorGreen, colorReset, amountSOL, outputMint)
			fmt.Printf("  %sWallet:%s  %s\n", colorDim, colorReset, wallet.PublicKeyStr())
			fmt.Printf("  %sSlippage:%s %d bps\n\n", colorDim, colorReset, slippageBps)

			if simulate {
				// Quote only — no submission
				quote, err := engine.GetSwapQuote(cmd.Context(), inputMint, outputMint, lamports, slippageBps)
				if err != nil {
					return fmt.Errorf("jupiter quote: %w", err)
				}
				fmt.Printf("  %s[SIM] Quote:%s in=%s out=%s impact=%.4f%%\n",
					colorAmber, colorReset, quote.InAmount, quote.OutAmount, quote.PriceImpact)
				return nil
			}

			result, err := engine.ExecuteSwap(cmd.Context(), inputMint, outputMint, lamports, wallet.GetPrivateKey(), slippageBps)
			if err != nil {
				return fmt.Errorf("swap failed: %w", err)
			}

			fmt.Printf("  %s✅ Swap confirmed!%s\n", colorGreen, colorReset)
			fmt.Printf("  %sSig:%s     %s\n", colorDim, colorReset, result.TxSignature)
			fmt.Printf("  %sIn:%s      %s lamports\n", colorDim, colorReset, result.InAmount)
			fmt.Printf("  %sOut:%s     %s raw units\n", colorDim, colorReset, result.OutAmount)
			fmt.Printf("  %sExplorer:%s https://solscan.io/tx/%s\n", colorDim, colorReset, result.TxSignature)
			return nil
		},
	}

	cmd.Flags().StringVar(&outputMint, "out", "", "Output token mint address")
	cmd.Flags().Float64Var(&amountSOL, "amount", 0, "Amount of SOL to swap")
	cmd.Flags().IntVar(&slippageBps, "slippage", 100, "Slippage tolerance in basis points (default 100 = 1%)")
	cmd.Flags().BoolVar(&simulate, "sim", false, "Simulate only — show quote without executing")

	return cmd
}

// ── Seeker ───────────────────────────────────────────────────────────

func NewSeekerCommand() *cobra.Command {
	var bridgePort int

	cmd := &cobra.Command{
		Use:   "seeker",
		Short: "SolanaOS agent for the Solana Seeker phone",
		Long: `Start the SolanaOS agent on the Solana Seeker phone.

Replaces the Node.js + OpenClaw stack with a native Go binary (~10MB).
Connects to the Android Bridge for device capabilities (battery, GPS,
clipboard, TTS) and runs the full OODA trading loop with Helius RPC,
Jupiter swaps, and companion runtime state.

Architecture:
  Android App (Kotlin/Compose)
   └─ Foreground Service
       └─ SolanaOS binary (ARM64, ~10MB)
           ├─ OODA trading loop
           ├─ Solana on-chain engine (Helius)
           ├─ Jupiter swap execution
           ├─ Companion runtime
           ├─ Telegram bot
           └─ Android Bridge client (localhost:8765)`,
		Example: `  solanaos seeker
  solanaos seeker --bridge-port 8765`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := seeker.DefaultSeekerConfig()
			if bridgePort > 0 {
				cfg.BridgePort = bridgePort
			}

			agent := seeker.NewAgent(cfg)
			return agent.Run(cmd.Context())
		},
	}

	cmd.Flags().IntVar(&bridgePort, "bridge-port", 8765, "Android Bridge HTTP port")

	return cmd
}

// ── SolanaOS Control ─────────────────────────────────────────────────

func NewNanoBotCommand() *cobra.Command {
	var port int
	var local bool
	var noBrowser bool

	cmd := &cobra.Command{
		Use:     "server",
		Aliases: []string{"nanobot", "control"},
		Short:   "Start the SolanaOS Control UI server",
		Long: `Start SolanaOS Server — the Control UI with built-in gateway proxy.

Binds to 0.0.0.0 by default so the UI is accessible over Tailscale and LAN.
Use --local to restrict to localhost only.

Features:
  💬 Chat interface with gateway WebSocket proxy
  📊 Real-time system status, wallet, and trading data
  🔐 Wallet info and on-chain registry
  ⚡ Daemon health monitoring`,
		Example: `  solanaos server
  solanaos server --port 7777
  solanaos server --local --no-browser`,
		RunE: func(cmd *cobra.Command, args []string) error {
			binary, _ := os.Executable()
			if binary == "" {
				binary = "solanaos"
			}

			// Railway / cloud deployments inject $PORT and expect 0.0.0.0
			if envPort := os.Getenv("PORT"); envPort != "" {
				if p, err := strconv.Atoi(envPort); err == nil && p > 0 {
					port = p
					noBrowser = true
				}
			}

			host := "0.0.0.0"
			if local {
				host = "127.0.0.1"
			}

			displayHost := host
			if displayHost == "0.0.0.0" {
				displayHost = "127.0.0.1"
			}

			fmt.Fprintf(os.Stderr, "%s🖥️  SolanaOS Server starting on http://%s:%d%s\n", colorGreen, displayHost, port, colorReset)
			fmt.Fprintf(os.Stderr, "%s🖥️  SolanaOS Office: http://%s%s\n", colorTeal, "office.solanaos.net", colorReset)
			fmt.Fprintf(os.Stderr, "%s   Local dev: cd Claw3D-main && npm run dev%s\n\n", colorDim, colorReset)

			srv := nanobot.NewServerWithOptions(port, binary, host, !noBrowser)
			return srv.Start(cmd.Context())
		},
	}

	cmd.Flags().IntVar(&port, "port", 7777, "SolanaOS Server port")
	cmd.Flags().BoolVar(&local, "local", false, "Listen on localhost only (default: 0.0.0.0)")
	cmd.Flags().BoolVar(&noBrowser, "no-browser", false, "Do not open a browser window on startup")

	return cmd
}

// ── Menu Bar ─────────────────────────────────────────────────────────

func NewMenuBarCommand() *cobra.Command {
	var port int

	cmd := &cobra.Command{
		Use:   "menubar",
		Short: "Start SolanaOS Control as a macOS menu bar app",
		Long: `Launches a persistent 🤖 icon in your macOS menu bar.

The menu bar agent provides:
  🤖 Always-visible status icon
  📊 Quick access to SolanaOS Control
  💰 One-click wallet access
  🔧 Daemon start/stop
  ⌨️  Open terminal with solanaos

Works alongside Docker, Tailscale, and other menu bar apps.
Requires macOS.`,
		Example: "  solanaos menubar",
		RunE: func(cmd *cobra.Command, args []string) error {
			if runtime.GOOS != "darwin" {
				return fmt.Errorf("menu bar is only available on macOS")
			}

			binary, _ := os.Executable()
			if binary == "" {
				binary = "solanaos"
			}

			fmt.Fprintf(os.Stderr, "%s🤖 Starting SolanaOS Control menu bar agent...%s\n", colorGreen, colorReset)

			binaryDir := filepath.Dir(binary)
			wd, _ := os.Getwd()

			// Prefer the repo-local AppleScript menu bar agent when available.
			// The packaged .app currently wraps the SolanaOS Control web launcher; the
			// actual always-on menu bar behavior lives in scripts/menubar.sh.
			scriptCandidates := []string{
				filepath.Join(wd, "scripts", "menubar.sh"),
				filepath.Join(binaryDir, "..", "scripts", "menubar.sh"),
				filepath.Join(binaryDir, "scripts", "menubar.sh"),
			}
			for _, candidate := range scriptCandidates {
				if _, err := os.Stat(candidate); err == nil {
					fmt.Fprintf(os.Stderr, "%s🍎 Launching menu bar agent script: %s%s\n", colorTeal, candidate, colorReset)
					c := exec.CommandContext(cmd.Context(), "/bin/bash", candidate)
					c.Env = append(os.Environ(), fmt.Sprintf("NANOBOT_PORT=%d", port))
					c.Stdout = os.Stdout
					c.Stderr = os.Stderr
					return c.Run()
				}
			}

			appCandidates := []string{
				filepath.Join(wd, "dist", "SolanaOS.app"),
				filepath.Join(binaryDir, "..", "dist", "SolanaOS.app"),
				filepath.Join(binaryDir, "SolanaOS.app"),
				filepath.Join("dist", "SolanaOS.app"),
				"/Applications/SolanaOS.app",
			}

			for _, candidate := range appCandidates {
				if _, err := os.Stat(candidate); err == nil {
					fmt.Fprintf(os.Stderr, "%s🍎 Opening native macOS app: %s%s\n", colorTeal, candidate, colorReset)
					c := exec.CommandContext(cmd.Context(), "open", candidate)
					c.Stdout = os.Stdout
					c.Stderr = os.Stderr
					return c.Run()
				}
			}

			fmt.Fprintf(os.Stderr, "%s⚠️  Native menu bar app not found; starting SolanaOS Control web UI instead.%s\n", colorAmber, colorReset)
			fmt.Fprintf(os.Stderr, "%s   Build the app with scripts/package-macos.sh to get a real menu bar icon.%s\n", colorDim, colorReset)

			srv := nanobot.NewServerWithOptions(port, binary, "127.0.0.1", true)
			return srv.Start(cmd.Context())
		},
	}

	cmd.Flags().IntVar(&port, "port", 7777, "SolanaOS Control UI port used when falling back to the web UI")
	return cmd
}

// ── Version ──────────────────────────────────────────────────────────

func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show version info",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("%s⚡ solanaos%s %s%s%s\n",
				colorGreen, colorReset,
				colorPurple, config.FormatVersion(), colorReset)
			buildTime, goVer := config.FormatBuildInfo()
			if buildTime != "" {
				fmt.Printf("%s  built:%s  %s\n", colorDim, colorReset, buildTime)
			}
			fmt.Printf("%s  go:   %s  %s\n", colorDim, colorReset, goVer)
			fmt.Printf("%s  arch: %s  %s/%s%s\n",
				colorDim, colorReset,
				colorTeal, runtime.GOOS+"/"+runtime.GOARCH, colorReset)
		},
	}
}

// ── Console hooks (AgentHooks implementation for terminal output) ─────

type consoleHooks struct{ agent.NoopHooks }

func (c *consoleHooks) OnAgentStart(mode string, wl []string) {
	fmt.Printf("%s[OODA]%s Agent started (mode=%s watchlist=%v)\n",
		colorGreen, colorReset, mode, wl)
}
func (c *consoleHooks) OnCycleStart(n int, sol float64) {
	if sol > 0 {
		fmt.Printf("%s[OODA]%s Cycle #%d | SOL=$%.2f\n", colorTeal, colorReset, n, sol)
	} else {
		fmt.Printf("%s[OODA]%s Cycle #%d\n", colorTeal, colorReset, n)
	}
}
func (c *consoleHooks) OnSignalDetected(sym, dir string, str, conf float64) {
	fmt.Printf("%s[OODA]%s 📡 SIGNAL %s %s (strength=%.2f conf=%.2f)\n",
		colorPurple, colorReset, dir, sym, str, conf)
}
func (c *consoleHooks) OnTradeOpen(sym, dir string, price, sol float64) {
	fmt.Printf("%s[OODA]%s 📈 OPEN %s %s at $%.6f (%.4f SOL)\n",
		colorGreen, colorReset, dir, sym, price, sol)
}
func (c *consoleHooks) OnTradeClose(sym, dir string, pnl float64, outcome, reason string) {
	col := colorGreen
	if outcome == "loss" {
		col = colorRed
	}
	fmt.Printf("%s[OODA]%s 📉 CLOSE %s %s PnL=%s%.2f%%%s (%s)\n",
		col, colorReset, dir, sym, col, pnl, colorReset, reason)
}
func (c *consoleHooks) OnLearningCycle(wr, pnl float64, count int) {
	fmt.Printf("%s[OODA]%s 🧠 Learning: wr=%.1f%% pnl=%.2f%% trades=%d\n",
		colorPurple, colorReset, wr*100, pnl, count)
}
func (c *consoleHooks) OnParamsUpdated(reason string) {
	fmt.Printf("%s[OODA]%s ⚡ Params: %s\n", colorAmber, colorReset, reason)
}
func (c *consoleHooks) OnError(ctx string, err error) {
	fmt.Printf("%s[OODA]%s ❌ %s: %v\n", colorRed, colorReset, ctx, err)
}

// ── Daemon Command ───────────────────────────────────────────────────

func NewDaemonCommand() *cobra.Command {
	var (
		seekerMode      bool
		petName         string
		disableTelegram bool
		disableOODA     bool
	)

	cmd := &cobra.Command{
		Use:   "daemon",
		Short: "Start the SolanaOS daemon (OODA + companion runtime + Telegram)",
		Long: `Launch the full SolanaOS daemon — a long-running process that:
  • Generates/loads the agentic Solana wallet
  • Connects to Helius RPC (or fallback)
  • Starts the companion runtime state engine
  • Starts the Telegram bot (if configured)
  • Optionally spawns a SolanaOS Gateway (tmux + Tailscale)
  • Runs the heartbeat loop
  • Waits for SIGINT/SIGTERM to shutdown`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			// Optionally auto-spawn gateway
			if cfg.GatewaySpawn.AutoSpawn {
				spawnCfg := gw.SpawnConfig{
					Port:         cfg.GatewaySpawn.Port,
					TMUXSession:  cfg.GatewaySpawn.TMUXSession,
					UseTailscale: cfg.GatewaySpawn.UseTailscale,
					ForceBind:    cfg.GatewaySpawn.Force,
				}
				result, err := gw.SpawnGateway(spawnCfg)
				if err != nil {
					log.Printf("[DAEMON] ⚠️ Gateway spawn failed (non-fatal): %v", err)
				} else if result.AlreadyExists {
					log.Printf("[DAEMON] 🌐 Gateway already running: %s", result.BridgeAddr)
				} else {
					log.Printf("[DAEMON] 🌐 Gateway spawned: %s (tmux: %s)", result.BridgeAddr, result.TMUXSession)
				}
			}

			opts := daemon.DefaultOptions()
			opts.SeekerMode = seekerMode
			opts.PetName = petName
			opts.DisableTelegram = disableTelegram
			opts.AutoStartOODA = !disableOODA

			d, err := daemon.NewWithOptions(cfg, opts)
			if err != nil {
				return fmt.Errorf("daemon init: %w", err)
			}

			return d.Run()
		},
	}

	cmd.Flags().BoolVar(&seekerMode, "seeker", false, "Run the daemon in Seeker-branded mode")
	cmd.Flags().StringVar(&petName, "pet-name", "", "Override the companion runtime name")
	cmd.Flags().BoolVar(&disableTelegram, "no-telegram", false, "Disable Telegram channel startup")
	cmd.Flags().BoolVar(&disableOODA, "no-ooda", false, "Keep daemon online without starting the OODA runtime")
	return cmd
}

// ── Node Command (Headless Bridge Client) ────────────────────────────

func NewNodeCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "node",
		Short: "Headless node client for hardware ↔ gateway communication",
		Long: `Connect SolanaOS hardware (Orin Nano, RPi, workstation) to the
native gateway over TCP. Supports pairing, voice transcript forwarding, chat
subscription with TTS, and mDNS advertising.

The gateway can be started via 'solanaos gateway start'.`,
	}

	cmd.AddCommand(
		newNodePairCommand(),
		newNodeRunCommand(),
		newNodeGatewaySpawnCommand(),
		newNodeGatewayKillCommand(),
	)

	return cmd
}

func newNodePairCommand() *cobra.Command {
	var (
		bridge       string
		displayName  string
		deviceFamily string
		statePath    string
	)

	cmd := &cobra.Command{
		Use:   "pair",
		Short: "Pair this node with a gateway",
		Example: `  solanaos node pair --bridge 100.88.46.29:18790 --display-name "Orin Nano"
  solanaos node pair --bridge 127.0.0.1:18790`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()

			ncfg := node.DefaultNodeConfig()
			if bridge != "" {
				ncfg.BridgeAddr = bridge
			} else if cfg.Node.BridgeAddr != "" {
				ncfg.BridgeAddr = cfg.Node.BridgeAddr
			}
			if statePath != "" {
				ncfg.StatePath = statePath
			}
			if displayName != "" {
				ncfg.DisplayName = displayName
			} else if cfg.Node.DisplayName != "" {
				ncfg.DisplayName = cfg.Node.DisplayName
			}
			if deviceFamily != "" {
				ncfg.DeviceFamily = deviceFamily
			} else if cfg.Node.DeviceFamily != "" {
				ncfg.DeviceFamily = cfg.Node.DeviceFamily
			}

			fmt.Printf("%s🖥️ SolanaOS Node Pairing%s\n", colorGreen, colorReset)
			fmt.Printf("%sBridge: %s%s\n\n", colorDim, ncfg.BridgeAddr, colorReset)

			state, err := node.LoadOrInitState(ncfg.StatePath)
			if err != nil {
				return err
			}
			if ncfg.DisplayName != "" {
				state.DisplayName = ncfg.DisplayName
			}

			client, err := node.ConnectBridge(ncfg.BridgeAddr)
			if err != nil {
				return fmt.Errorf("bridge connect: %w", err)
			}
			defer client.Close()

			fmt.Printf("  %s✔%s Connected to bridge\n", colorGreen, colorReset)

			if err := node.SendPairRequest(client, ncfg, state); err != nil {
				return err
			}
			fmt.Printf("  %s⏳%s Waiting for approval...\n", colorTeal, colorReset)
			fmt.Printf("  %sApprove via: solanaos nodes approve <requestId>%s\n\n", colorDim, colorReset)

			token, err := node.WaitForPair(client)
			if err != nil {
				return err
			}
			state.Token = token
			if err := node.SaveState(ncfg.StatePath, state); err != nil {
				return err
			}

			fmt.Printf("  %s✔%s Paired! Token saved to %s\n", colorGreen, colorReset, ncfg.StatePath)
			fmt.Printf("     %sNode ID: %s%s\n", colorDim, state.NodeID, colorReset)
			return nil
		},
	}

	cmd.Flags().StringVar(&bridge, "bridge", "", "Bridge host:port (default from config)")
	cmd.Flags().StringVar(&displayName, "display-name", "", "Friendly display name")
	cmd.Flags().StringVar(&deviceFamily, "device-family", "", "Device family (raspi, orin, workstation)")
	cmd.Flags().StringVar(&statePath, "state", "", "Path to node state JSON")
	return cmd
}

func newNodeRunCommand() *cobra.Command {
	var (
		bridge      string
		displayName string
		sessionKey  string
		ttsEngine   string
		noMDNS      bool
	)

	cmd := &cobra.Command{
		Use:   "run",
		Short: "Run the headless node (connects to gateway bridge)",
		Long: `Start the headless node client. Connects to the gateway bridge,
authenticates, and maintains a persistent connection with automatic
reconnection. Events from hardware can be forwarded as voice.transcript
or agent.request messages.`,
		Example: `  solanaos node run --bridge 100.88.46.29:18790
  solanaos node run --bridge 100.88.46.29:18790 --tts-engine system`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()

			ncfg := node.DefaultNodeConfig()
			if bridge != "" {
				ncfg.BridgeAddr = bridge
			} else if cfg.Node.BridgeAddr != "" {
				ncfg.BridgeAddr = cfg.Node.BridgeAddr
			}
			if displayName != "" {
				ncfg.DisplayName = displayName
			} else if cfg.Node.DisplayName != "" {
				ncfg.DisplayName = cfg.Node.DisplayName
			}
			if sessionKey != "" {
				ncfg.SessionKey = sessionKey
			} else if cfg.Node.SessionKey != "" {
				ncfg.SessionKey = cfg.Node.SessionKey
			}
			if ttsEngine != "" {
				ncfg.TTSEngine = ttsEngine
			} else if cfg.Node.TTSEngine != "" {
				ncfg.TTSEngine = cfg.Node.TTSEngine
			}
			ncfg.MDNSEnabled = !noMDNS
			if cfg.Node.MDNSService != "" {
				ncfg.MDNSService = cfg.Node.MDNSService
			}

			fmt.Printf("%s🖥️ SolanaOS Headless Node%s\n", colorGreen, colorReset)
			fmt.Printf("%sBridge: %s | Session: %s%s\n\n", colorDim, ncfg.BridgeAddr, ncfg.SessionKey, colorReset)

			return node.RunNode(context.Background(), ncfg)
		},
	}

	cmd.Flags().StringVar(&bridge, "bridge", "", "Bridge host:port")
	cmd.Flags().StringVar(&displayName, "display-name", "", "Friendly display name")
	cmd.Flags().StringVar(&sessionKey, "session-key", "", "Session key for events")
	cmd.Flags().StringVar(&ttsEngine, "tts-engine", "", "TTS engine (system, none)")
	cmd.Flags().BoolVar(&noMDNS, "no-mdns", false, "Disable mDNS advertising")
	return cmd
}

func newNodeGatewaySpawnCommand() *cobra.Command {
	var (
		port    int
		session string
		noTS    bool
		force   bool
	)

	cmd := &cobra.Command{
		Use:   "gateway-spawn",
		Short: "Spawn a SolanaOS Gateway in tmux (Tailscale-aware)",
		Long: `Launch the SolanaOS native gateway in a detached tmux session, bound to
your Tailscale IP for secure mesh networking. The gateway serves as the
bridge between headless hardware nodes and the SolanaOS daemon.

Perfect for SSH sessions via Termius — gateway runs in the background.`,
		Example: `  solanaos node gateway-spawn
  solanaos node gateway-spawn --port 19001
  solanaos node gateway-spawn --no-tailscale`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()

			spawnCfg := gw.SpawnConfig{
				Port:         port,
				TMUXSession:  session,
				UseTailscale: !noTS,
				ForceBind:    force,
			}
			if spawnCfg.Port == 0 {
				spawnCfg.Port = cfg.GatewaySpawn.Port
			}
			if spawnCfg.TMUXSession == "" {
				spawnCfg.TMUXSession = cfg.GatewaySpawn.TMUXSession
			}

			fmt.Printf("%s🖥️ SolanaOS Gateway Spawn%s\n\n", colorGreen, colorReset)

			result, err := gw.SpawnGateway(spawnCfg)
			if err != nil {
				return err
			}

			if result.AlreadyExists {
				fmt.Printf("  %s⚠%s Gateway already running in tmux '%s'\n", colorAmber, colorReset, result.TMUXSession)
			} else {
				fmt.Printf("  %s✔%s Gateway spawned\n", colorGreen, colorReset)
			}

			fmt.Printf("\n%s  Bridge:%s  %s\n", colorTeal, colorReset, result.BridgeAddr)
			if result.TailscaleIP != "" {
				fmt.Printf("%s  Tailscale:%s %s\n", colorTeal, colorReset, result.TailscaleIP)
			}
			fmt.Printf("%s  tmux:%s    %s\n", colorDim, colorReset, result.TMUXSession)
			fmt.Printf("\n%s  Connect from node:%s\n", colorDim, colorReset)
			fmt.Printf("  %ssolanaos node run --bridge %s%s\n", colorAmber, result.BridgeAddr, colorReset)
			fmt.Printf("\n%s  Pair new node:%s\n", colorDim, colorReset)
			fmt.Printf("  %ssolanaos node pair --bridge %s%s\n", colorAmber, result.BridgeAddr, colorReset)
			fmt.Printf("\n%s  Attach to tmux:%s\n", colorDim, colorReset)
			fmt.Printf("  %stmux attach -t %s%s\n\n", colorAmber, result.TMUXSession, colorReset)

			return nil
		},
	}

	cmd.Flags().IntVar(&port, "port", 18790, "Gateway bridge port")
	cmd.Flags().StringVar(&session, "session", "solanaos-gw", "tmux session name")
	cmd.Flags().BoolVar(&noTS, "no-tailscale", false, "Don't bind to Tailscale IP")
	cmd.Flags().BoolVar(&force, "force", false, "Kill existing port listeners")
	return cmd
}

func newNodeGatewayKillCommand() *cobra.Command {
	var session string

	cmd := &cobra.Command{
		Use:   "gateway-kill",
		Short: "Stop the SolanaOS Gateway tmux session",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := gw.KillGateway(session); err != nil {
				return err
			}
			fmt.Printf("  %s✔%s Gateway session '%s' killed\n", colorGreen, colorReset, session)
			return nil
		},
	}

	cmd.Flags().StringVar(&session, "session", "solanaos-gw", "tmux session name")
	return cmd
}

// ── Pet Command (Companion Runtime) ──────────────────────────────────

func NewPetCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "pet",
		Short: "Show companion runtime status",
		Long:  "Display the SolanaOS companion runtime state whose evolution is driven by on-chain performance.",
		Run: func(cmd *cobra.Command, args []string) {
			pet := tamagochi.New("SolanaOS")
			fmt.Println()
			fmt.Println(pet.StatusString())
			fmt.Println()
		},
	}
	return cmd
}

// ── Interactive REPL ─────────────────────────────────────────────────

func runInteractiveAgent(cfg *config.Config) error {
	client := llm.New()
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 4096), 1024*1024)
	sessionID := fmt.Sprintf("cli-%d", time.Now().Unix())

	for {
		fmt.Printf("%s🖥️ > %s", colorGreen, colorReset)
		if !scanner.Scan() {
			return nil
		}
		input := scanner.Text()

		switch {
		case input == "exit" || input == "quit":
			fmt.Printf("%s💤 Vault saved. Goodbye.%s\n", colorDim, colorReset)
			return nil
		case input == "!trades":
			fmt.Printf("%s📊 Trade history: use `solanaos ooda` to start trading%s\n", colorDim, colorReset)
		case input == "!lessons":
			fmt.Printf("%s🧠 Learned patterns: stored in ~/.nanosolana/workspace/vault/lessons/%s\n", colorDim, colorReset)
		case input == "!status":
			fmt.Printf("%sModel: %s | Mode: %s%s\n", colorDim, cfg.Agents.Defaults.ModelName, cfg.OODA.Mode, colorReset)
		case len(input) > 10 && input[:10] == "!remember ":
			fmt.Printf("%s💾 Stored to ClawVault%s\n", colorGreen, colorReset)
		case len(input) > 8 && input[:8] == "!recall ":
			fmt.Printf("%s🔍 Searching: %s%s\n", colorTeal, input[8:], colorReset)
		default:
			reply, err := chatAgent(cfg, client, sessionID, input)
			if err != nil {
				fmt.Printf("%s[SOLANAOS]%s %v\n", colorRed, colorReset, err)
				continue
			}
			fmt.Printf("%s[SOLANAOS]%s %s\n", colorGreen, colorReset, reply)
		}
	}
}

func chatAgentOnce(cfg *config.Config, sessionID, input string) (string, error) {
	return chatAgent(cfg, llm.New(), sessionID, input)
}

func chatAgent(cfg *config.Config, client *llm.Client, sessionID, input string) (string, error) {
	if !client.IsConfigured() {
		return "", fmt.Errorf("OPENROUTER_API_KEY not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	liveContext := agent.BuildLiveContext(ctx, cfg)
	return client.Chat(ctx, sessionID, input, liveContext)
}

// ── Helpers ──────────────────────────────────────────────────────────

func boolIcon(b bool) string {
	if b {
		return colorGreen + "✓" + colorReset
	}
	return colorRed + "✗" + colorReset
}

func truncate(s string, maxLen int) string {
	if s == "" {
		return colorDim + "(not set)" + colorReset
	}
	if len(s) > maxLen {
		return s[:maxLen] + "…"
	}
	return s
}

// ── Wallet API Command — one-shot agent wallet bootstrap ──────────────

func NewWalletAPICommand() *cobra.Command {
	var (
		port      string
		label     string
		chain     string
		skipSetup bool
	)

	cmd := &cobra.Command{
		Use:   "wallet-api",
		Short: "Start the agent wallet API with one-shot setup",
		Long: `Bootstraps the agent wallet vault, creates a default wallet if none
exist, registers the ACP agent.json, and starts the wallet API server.

One command to go from zero to a running agent wallet:
  solanaos wallet-api

The server exposes REST endpoints for wallet CRUD, balance checks,
transfers, signing, EVM support, Privy managed wallets, and E2B
sandbox deployment.`,
		Example: "solanaos wallet-api\nsolanaos wallet-api --port 8421 --chain solana --label primary",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Override port via flag
			if port != "" {
				os.Setenv("WALLET_API_PORT", port)
			}

			cfg := agentwallet.DefaultServerConfig()

			fmt.Printf("%s┌─────────────────────────────────────────────────────┐%s\n", colorDim, colorReset)
			fmt.Printf("%s│%s  🔐 SolanaOS Agent Wallet · One-Shot Bootstrap      %s│%s\n", colorDim, colorTeal, colorDim, colorReset)
			fmt.Printf("%s└─────────────────────────────────────────────────────┘%s\n\n", colorDim, colorReset)

			// 1. Initialize the server (vault + RPC connections)
			srv, err := agentwallet.NewServer(cfg)
			if err != nil {
				return fmt.Errorf("init wallet server: %w", err)
			}

			// 2. Auto-create a default wallet if vault is empty
			if !skipSetup {
				wallets := srv.ListWallets()
				if len(wallets) == 0 {
					fmt.Printf("  %sNo wallets found — creating default %s wallet...%s\n", colorAmber, chain, colorReset)

					chainType := agentwallet.ChainType(chain)
					if chainType == "" {
						chainType = agentwallet.ChainSolana
					}

					var chainID int
					var address string

					switch chainType {
					case agentwallet.ChainSolana:
						chainID = 900
						wallet := solanago.NewWallet()
						pk := wallet.PrivateKey
						address = wallet.PublicKey().String()
						id := agentwallet.GenerateID()
						if label == "" {
							label = "default"
						}
						if err := srv.AddWallet(id, label, agentwallet.ChainSolana, chainID, address, []byte(pk)); err != nil {
							return fmt.Errorf("create wallet: %w", err)
						}
						fmt.Printf("  %s✓%s Solana wallet created\n", colorGreen, colorReset)
						fmt.Printf("    %sID:%s      %s\n", colorDim, colorReset, id)
						fmt.Printf("    %sAddress:%s %s\n", colorDim, colorReset, address)
						fmt.Printf("    %sLabel:%s   %s\n", colorDim, colorReset, label)

					case agentwallet.ChainEVM:
						chainID = 8453 // Default to Base
						privKey, addr, err := agentwallet.GenerateEVMKeypair()
						if err != nil {
							return fmt.Errorf("generate EVM keypair: %w", err)
						}
						address = addr
						id := agentwallet.GenerateID()
						if label == "" {
							label = "default"
						}
						privBytes := privKey.D.Bytes()
						if err := srv.AddWallet(id, label, agentwallet.ChainEVM, chainID, address, privBytes); err != nil {
							return fmt.Errorf("create wallet: %w", err)
						}
						fmt.Printf("  %s✓%s EVM wallet created (Base)\n", colorGreen, colorReset)
						fmt.Printf("    %sID:%s      %s\n", colorDim, colorReset, id)
						fmt.Printf("    %sAddress:%s %s\n", colorDim, colorReset, address)
						fmt.Printf("    %sLabel:%s   %s\n", colorDim, colorReset, label)
					}

					fmt.Printf("\n  %s⚠ Fund this wallet before transacting.%s\n", colorAmber, colorReset)
				} else {
					fmt.Printf("  %s✓%s Vault loaded: %d wallet(s)\n", colorGreen, colorReset, len(wallets))
					for _, w := range wallets {
						fmt.Printf("    %s•%s %s (%s) %s\n", colorDim, colorReset, w.Address, w.ChainType, w.Label)
					}
				}
			}

			// 3. Print API info
			fmt.Printf("\n  %sAPI:%s       http://localhost:%s/v1\n", colorDim, colorReset, cfg.Port)
			fmt.Printf("  %sHealth:%s    http://localhost:%s/v1/health\n", colorDim, colorReset, cfg.Port)
			fmt.Printf("  %sWallets:%s   http://localhost:%s/v1/wallets\n", colorDim, colorReset, cfg.Port)
			if os.Getenv("WALLET_API_KEY") != "" {
				fmt.Printf("  %sAuth:%s      Bearer token required\n", colorDim, colorReset)
			} else {
				fmt.Printf("  %sAuth:%s      %sNone (set WALLET_API_KEY to secure)%s\n", colorDim, colorReset, colorAmber, colorReset)
			}
			fmt.Println()

			// 4. Graceful shutdown
			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

			go func() {
				if err := srv.Start(); err != nil {
					log.Printf("[WALLET-API] Server stopped: %v", err)
				}
			}()

			<-sigCh
			fmt.Printf("\n  %sShutting down wallet API...%s\n", colorDim, colorReset)

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			return srv.Stop(ctx)
		},
	}

	cmd.Flags().StringVar(&port, "port", "", "API port (default: $WALLET_API_PORT or 8421)")
	cmd.Flags().StringVar(&label, "label", "", "Label for the auto-created wallet (default: 'default')")
	cmd.Flags().StringVar(&chain, "chain", "solana", "Chain for auto-created wallet: solana or evm")
	cmd.Flags().BoolVar(&skipSetup, "skip-setup", false, "Skip auto-wallet creation, just start the API")

	return cmd
}

func main() {
	config.BootstrapEnv()
	fmt.Print(banner)
	if err := NewSolanaOSCommand().Execute(); err != nil {
		os.Exit(1)
	}
}
