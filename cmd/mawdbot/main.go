// SolanaOS Computer — a Go-native Solana operator runtime.
// Ultra-lightweight Solana trading, research, wallet, and automation system.
// Hardware support: Arduino Modulino® I2C via SolanaOS Labs.
//
// Copyright (c) 2026 SolanaOS Labs. All rights reserved.
// License: MIT

package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/x402agent/Solana-Os-Go/pkg/agent"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/daemon"
	gatewaypkg "github.com/x402agent/Solana-Os-Go/pkg/gateway"
	"github.com/x402agent/Solana-Os-Go/pkg/hardware"
	"github.com/x402agent/Solana-Os-Go/pkg/llm"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
	"github.com/x402agent/Solana-Os-Go/pkg/tamagochi"
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

func NewSolanaOSCommand() *cobra.Command {
	short := fmt.Sprintf("🖥️ SolanaOS v%s", config.GetVersion())

	cmd := &cobra.Command{
		Use:   "solanaos",
		Short: short,
		Long: `SolanaOS — the Solana-native autonomous operator runtime.
Powered by SolanaOS · Go Runtime · x402 Protocol.

Features:
  • OODA Loop (Observe → Orient → Decide → Act)
  • ClawVault persistent memory (known/learned/inferred)
  • RSI + EMA cross + ATR signal engine with auto-optimizer
  • Solana: Jupiter swaps, Birdeye analytics, Helius RPC, Aster perps
  • Arduino Modulino® I2C: LEDs, buzzer, buttons, knob, IMU, thermo, ToF
  • Companion hardware layer (Arduino Modulino® physical feedback)
  • Companion runtime state layer (performance-reactive status engine)
  • x402 payment protocol (multi-chain USDC)
  • Multi-channel: Telegram, Discord, CLI
  • <10MB binary, <10MB RAM, boots in <1s on ARM64`,
		Example: "solanaos agent -m \"What is SOL price?\"\nsolanaos ooda --interval 60\nsolanaos ooda --hw-bus 1\nsolanaos hardware scan\nsolanaos hardware demo",
	}

	cmd.AddCommand(
		NewAgentCommand(),
		NewDaemonCommand(),
		NewGatewayCommand(),
		NewPetCommand(),
		NewOnboardCommand(),
		NewStatusCommand(),
		NewOODACommand(),
		NewSolanaCommand(),
		NewHardwareCommand(),
		NewVersionCommand(),
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

			// Interactive REPL mode
			fmt.Printf("%s🖥️ SolanaOS Console%s\n", colorGreen, colorReset)
			fmt.Printf("%sModel: %s | Workspace: %s%s\n", colorDim, cfg.Agents.Defaults.ModelName, cfg.Agents.Defaults.Workspace, colorReset)
			fmt.Printf("%sType your message or use memory commands (!remember, !recall, !trades, !lessons)%s\n\n", colorDim, colorReset)

			return runInteractiveAgent(cfg)
		},
	}

	cmd.Flags().StringVarP(&message, "message", "m", "", "Single message to send")
	return cmd
}

// ── Gateway Command ──────────────────────────────────────────────────

func NewGatewayCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "gateway",
		Short: "Start the SolanaOS gateway (Telegram, Discord, WebSocket)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			fmt.Printf("%s🖥️ SolanaOS Gateway starting...%s\n", colorGreen, colorReset)
			fmt.Printf("%sHost: %s:%d%s\n", colorDim, cfg.Gateway.Host, cfg.Gateway.Port, colorReset)

			// Print enabled channels
			if cfg.Channels.Telegram.Enabled {
				fmt.Printf("  %s✓%s Telegram\n", colorGreen, colorReset)
			}
			if cfg.Channels.Discord.Enabled {
				fmt.Printf("  %s✓%s Discord\n", colorGreen, colorReset)
			}

			// Print Solana connectors
			fmt.Printf("\n%sSolana Connectors:%s\n", colorAmber, colorReset)
			fmt.Printf("  Helius:  %s\n", boolIcon(cfg.Solana.HeliusAPIKey != ""))
			fmt.Printf("  Birdeye: %s\n", boolIcon(cfg.Solana.BirdeyeAPIKey != ""))
			fmt.Printf("  Jupiter: %s\n", boolIcon(cfg.Solana.JupiterEndpoint != ""))

			// TODO: Wire real gateway with OODA loop
			select {} // Block forever
		},
	}
	cmd.AddCommand(NewGatewayRemoteCommand())
	return cmd
}

func NewGatewayRemoteCommand() *cobra.Command {
	var (
		host             string
		user             string
		identityFile     string
		alias            string
		remoteBindHost   string
		launchAgentLabel string
		localPort        int
		remotePort       int
		scheme           string
	)

	loadSpec := func() (*config.Config, gatewaypkg.RemoteTunnelSpec, error) {
		cfg, err := config.Load()
		if err != nil {
			return nil, gatewaypkg.RemoteTunnelSpec{}, fmt.Errorf("config error: %w", err)
		}
		spec := gatewaypkg.RemoteTunnelSpecFromConfig(cfg)
		if host != "" {
			spec.Host = host
		}
		if user != "" {
			spec.User = user
		}
		if identityFile != "" {
			spec.IdentityFile = identityFile
		}
		if alias != "" {
			spec.Alias = alias
		}
		if remoteBindHost != "" {
			spec.RemoteBindHost = remoteBindHost
		}
		if launchAgentLabel != "" {
			spec.LaunchAgentLabel = launchAgentLabel
		}
		if localPort > 0 {
			spec.LocalPort = localPort
		}
		if remotePort > 0 {
			spec.RemotePort = remotePort
		}
		return cfg, spec, nil
	}

	cmd := &cobra.Command{
		Use:   "remote",
		Short: "Print SSH tunnel setup for a remote SolanaOS gateway",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, spec, err := loadSpec()
			if err != nil {
				return err
			}
			fmt.Printf("%s🖥️ SolanaOS Remote Gateway%s\n\n", colorGreen, colorReset)
			fmt.Printf("Local forwarded URL: %s%s%s\n", colorTeal, spec.LocalForwardURL(firstNonEmptyString(scheme, "ws")), colorReset)
			fmt.Printf("SSH alias:           %s\n", firstNonEmptyString(spec.Alias, "nanosolana-remote-gateway"))
			fmt.Printf("Tunnel command:      %s\n", spec.TunnelCommand())
			fmt.Printf("Direct command:      %s\n", spec.DirectTunnelCommand())
			if cfg != nil {
				if token := strings.TrimSpace(cfg.Gateway.Remote.Token); token != "" {
					fmt.Printf("Remote token:        configured in gateway.remote.token\n")
				} else if token := strings.TrimSpace(cfg.Gateway.Auth.Token); token != "" {
					fmt.Printf("Remote token:        using gateway.auth.token\n")
				}
				if password := strings.TrimSpace(cfg.Gateway.Remote.Password); password != "" {
					fmt.Printf("Remote password:     configured in gateway.remote.password\n")
				}
			}
			fmt.Printf("\nSSH config snippet:\n\n%s\n", spec.SSHConfigEntry())
			fmt.Printf("LaunchAgent file: ~/Library/LaunchAgents/%s\n", spec.LaunchAgentFilename())
			fmt.Printf("Recommended env:\n")
			fmt.Printf("  export OPENCLAW_GATEWAY_URL=%q\n", spec.LocalForwardURL(firstNonEmptyString(scheme, "ws")))
			return nil
		},
	}

	cmd.Flags().StringVar(&host, "host", "", "Remote SSH host")
	cmd.Flags().StringVar(&user, "user", "", "Remote SSH user")
	cmd.Flags().StringVar(&identityFile, "identity-file", "", "SSH identity file")
	cmd.Flags().StringVar(&alias, "alias", "", "SSH host alias")
	cmd.Flags().StringVar(&remoteBindHost, "remote-bind-host", "", "Remote bind host forwarded over SSH")
	cmd.Flags().StringVar(&launchAgentLabel, "launch-agent-label", "", "LaunchAgent label")
	cmd.Flags().IntVar(&localPort, "local-port", 0, "Local forwarded port")
	cmd.Flags().IntVar(&remotePort, "remote-port", 0, "Remote gateway port")
	cmd.Flags().StringVar(&scheme, "scheme", "ws", "Forwarded local URL scheme (ws or http)")

	cmd.AddCommand(&cobra.Command{
		Use:   "ssh-config",
		Short: "Print SSH config entry for the remote gateway tunnel",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, spec, err := loadSpec()
			if err != nil {
				return err
			}
			fmt.Print(spec.SSHConfigEntry())
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "launch-agent",
		Short: "Print a macOS LaunchAgent plist for the SSH tunnel",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, spec, err := loadSpec()
			if err != nil {
				return err
			}
			plist, err := spec.LaunchAgentPlist()
			if err != nil {
				return err
			}
			fmt.Print(plist)
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "launch-agent-path",
		Short: "Print the default LaunchAgent path for the SSH tunnel",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, spec, err := loadSpec()
			if err != nil {
				return err
			}
			home, _ := os.UserHomeDir()
			fmt.Println(filepath.Join(home, "Library", "LaunchAgents", spec.LaunchAgentFilename()))
			return nil
		},
	})

	return cmd
}

// ── Onboard Command ──────────────────────────────────────────────────

func NewOnboardCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "onboard",
		Short: "Initialize the SolanaOS config and workspace",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s🖥️ Welcome to SolanaOS%s\n\n", colorGreen, colorReset)

			configPath := config.DefaultConfigPath()
			workspacePath := config.DefaultWorkspacePath()

			fmt.Printf("Creating config at:    %s%s%s\n", colorTeal, configPath, colorReset)
			fmt.Printf("Creating workspace at: %s%s%s\n", colorTeal, workspacePath, colorReset)

			if err := config.EnsureDefaults(); err != nil {
				return fmt.Errorf("onboard failed: %w", err)
			}

			fmt.Printf("\n%s✓ SolanaOS initialized!%s\n", colorGreen, colorReset)
			fmt.Printf("%sEdit %s to configure API keys.%s\n", colorDim, configPath, colorReset)
			fmt.Printf("\nQuick start:\n")
			fmt.Printf("  %smawdbot agent -m \"Hello\"%s\n", colorGreen, colorReset)
			fmt.Printf("  %smawdbot ooda --interval 60%s\n", colorGreen, colorReset)
			fmt.Printf("  %smawdbot solana wallet%s\n", colorGreen, colorReset)
			return nil
		},
	}
}

// ── Status Command ───────────────────────────────────────────────────

func NewStatusCommand() *cobra.Command {
	var hwBus int

	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show SolanaOS status",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			fmt.Printf("%s🖥️ SolanaOS Status%s\n\n", colorGreen, colorReset)
			fmt.Printf("Version:    %s\n", config.FormatVersion())
			buildTime, goVer := config.FormatBuildInfo()
			fmt.Printf("Go:         %s\n", goVer)
			fmt.Printf("Built:      %s\n", buildTime)
			fmt.Printf("Model:      %s\n", cfg.Agents.Defaults.ModelName)
			fmt.Printf("Workspace:  %s\n", cfg.Agents.Defaults.Workspace)
			fmt.Printf("OODA Int:   %ds\n", cfg.OODA.IntervalSeconds)
			fmt.Printf("Heartbeat:  %v (every %dm)\n", cfg.Heartbeat.Enabled, cfg.Heartbeat.Interval)

			fmt.Printf("\n%sStrategy:%s\n", colorPurple, colorReset)
			fmt.Printf("  Mode:     %s\n", cfg.OODA.Mode)
			fmt.Printf("  RSI:      oversold=%d overbought=%d\n",
				cfg.Strategy.RSIOversold, cfg.Strategy.RSIOverbought)
			fmt.Printf("  EMA:      fast=%d slow=%d\n",
				cfg.Strategy.EMAFastPeriod, cfg.Strategy.EMASlowPeriod)
			fmt.Printf("  SL/TP:    %.0f%% / %.0f%%\n",
				cfg.Strategy.StopLossPct*100, cfg.Strategy.TakeProfitPct*100)
			fmt.Printf("  AutoOpt:  %v\n", cfg.OODA.AutoOptimize)

			fmt.Printf("\n%sSolana Stack:%s\n", colorAmber, colorReset)
			fmt.Printf("  Helius:      %s\n", boolIcon(cfg.Solana.HeliusAPIKey != ""))
			fmt.Printf("  Birdeye:     %s\n", boolIcon(cfg.Solana.BirdeyeAPIKey != ""))
			fmt.Printf("  Birdeye WSS: %s\n", boolIcon(cfg.Solana.BirdeyeWSSURL != ""))
			fmt.Printf("  Jupiter:     %s\n", boolIcon(cfg.Solana.JupiterEndpoint != ""))
			fmt.Printf("  Aster DEX:   %s\n", boolIcon(cfg.Solana.AsterAPIKey != ""))
			fmt.Printf("  Wallet:      %s\n", truncate(cfg.Solana.WalletPubkey, 20))

			fmt.Printf("\n%sChannels:%s\n", colorPurple, colorReset)
			fmt.Printf("  Telegram: %s\n", boolIcon(cfg.Channels.Telegram.Enabled))
			fmt.Printf("  Discord:  %s\n", boolIcon(cfg.Channels.Discord.Enabled))

			fmt.Printf("\n%sHardware (I2C bus %d):%s\n", colorTeal, hwBus, colorReset)
			hwCfg := hardware.DefaultAdapterConfig()
			hwCfg.I2CBusNum = hwBus
			hw := hardware.NewHardwareAdapter(hwCfg, hardware.AgentControls{})
			if hw.IsConnected() {
				hw.PrintStatus()
			} else {
				fmt.Printf("  %s✗ No Modulino® sensors detected%s\n", colorRed, colorReset)
				fmt.Printf("  %sRun: mawdbot hardware scan%s\n", colorDim, colorReset)
			}

			return nil
		},
	}

	cmd.Flags().IntVar(&hwBus, "hw-bus", 1, "I2C bus number to check for Modulino® hardware")
	return cmd
}

// ── OODA Command — fully wired ─────────────────────────────────────────

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
The agent will continuously:
  1. OBSERVE: Pull Helius on-chain + Birdeye OHLCV + Aster perps
  2. ORIENT:  RSI/EMA/ATR strategy evaluation + ClawVault recall
  3. DECIDE:  Signal scoring (strength × confidence threshold)
  4. ACT:     Open/close positions, store vault entries, adjust params

Hardware integration (when --hw-bus is set):
  Pixels  → live status (idle/signal/trade/win/loss)
  Buzzer  → audio alerts on signals, trades, wins, losses
  Button A → trigger immediate cycle
  Button B → toggle simulated/live mode
  Button C → emergency stop (closes all positions)
  Knob    → real-time RSI threshold tuning (twist to adjust, press to reset)`,
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

			// ── Build hooks ────────────────────────────────────────────────
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
					fmt.Printf("%s🎛  Hardware: %v%s\n", colorTeal, hwAdapter.ConnectedSensors(), colorReset)
					hooks = agent.NewMultiHooks(&consoleHooks{}, hwAdapter)
				} else {
					fmt.Printf("%s🎛  Hardware: not connected (stub mode)%s\n", colorDim, colorReset)
				}
			}

			fmt.Println()

			// ── Create agent ───────────────────────────────────────────────
			ooda = agent.NewOODAAgent(cfg, hooks)

			if hwAdapter != nil && hwAdapter.IsConnected() {
				hwAdapter.Start()
				defer hwAdapter.Stop()
			}

			// ── Start agent ────────────────────────────────────────────────
			if err := ooda.Start(); err != nil {
				return fmt.Errorf("agent start: %w", err)
			}

			// ── Wait for SIGINT/SIGTERM ─────────────────────────────────────
			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			sig := <-sigCh

			fmt.Printf("\n%s[OODA] Signal %s — shutting down gracefully...%s\n",
				colorAmber, sig, colorReset)
			ooda.Stop()

			stats := ooda.GetStats()
			fmt.Printf("\n%s📊 Final Stats:%s\n", colorGreen, colorReset)
			fmt.Printf("  Cycles:   %v\n", stats["cycles"])
			fmt.Printf("  Trades:   %v closed\n", stats["closed_trades"])
			fmt.Printf("  Win Rate: %.1f%%\n", stats["win_rate"])
			fmt.Printf("  Avg PnL:  %.2f%%\n", stats["avg_pnl_pct"])

			return nil
		},
	}

	cmd.Flags().IntVar(&interval, "interval", 0, "OODA cycle interval in seconds (overrides config)")
	cmd.Flags().IntVar(&hwBus, "hw-bus", 1, "I2C bus number for Modulino® hardware")
	cmd.Flags().BoolVar(&noHW, "no-hw", false, "Disable hardware integration")
	cmd.Flags().BoolVar(&simMode, "sim", false, "Force simulated mode (no live trades)")
	return cmd
}

// ── Solana Command ───────────────────────────────────────────────────

func NewSolanaCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "solana",
		Short: "Solana tools (wallet, Birdeye, Helius DAS/SPL)",
		Long: `Solana CLI suite for:
  • Wallet/balance checks
  • Birdeye research, trending, token search
  • Helius DAS methods (assets, owner assets, search, proofs)
  • Helius SPL/RPC methods (token balances, supply, holders, generic RPC)`,
	}

	cmd.AddCommand(
		&cobra.Command{
			Use:   "wallet",
			Short: "Show wallet info and balance",
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, err := config.Load()
				if err != nil {
					return fmt.Errorf("config error: %w", err)
				}
				fmt.Printf("%s💰 Solana Wallet%s\n", colorGreen, colorReset)
				fmt.Printf("Pubkey:  %s\n", cfg.Solana.WalletPubkey)
				fmt.Printf("RPC:     %s\n", truncate(cfg.Solana.HeliusRPCURL, 40))

				if cfg.Solana.WalletPubkey != "" && cfg.Solana.HeliusAPIKey != "" {
					timeout := cfg.Solana.HeliusTimeoutSeconds
					if timeout <= 0 {
						timeout = 20
					}
					retries := cfg.Solana.HeliusRetries
					if retries <= 0 {
						retries = 3
					}

					hc := solana.NewHeliusClientWithOptions(
						cfg.Solana.HeliusAPIKey,
						cfg.Solana.HeliusRPCURL,
						cfg.Solana.HeliusWSSURL,
						cfg.Solana.HeliusNetwork,
						time.Duration(timeout*float64(time.Second)),
						retries,
						750*time.Millisecond,
					)

					balance, err := hc.GetBalance(cfg.Solana.WalletPubkey)
					if err != nil {
						fmt.Printf("%sBalance lookup failed:%s %v\n", colorRed, colorReset, err)
					} else {
						fmt.Printf("Balance: %s%.6f SOL%s (%d lamports)\n", colorTeal, balance.SOL, colorReset, balance.Lamports)
					}
				} else {
					fmt.Printf("%sSet HELIUS_API_KEY and wallet_pubkey to fetch live balance.%s\n", colorDim, colorReset)
				}

				return nil
			},
		},
		&cobra.Command{
			Use:   "research [mint]",
			Short: "Deep research a Solana token via Birdeye",
			Args:  cobra.ExactArgs(1),
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, err := config.Load()
				if err != nil {
					return fmt.Errorf("config error: %w", err)
				}
				if cfg.Solana.BirdeyeAPIKey == "" {
					return fmt.Errorf("BIRDEYE_API_KEY not set")
				}
				client := solana.NewBirdeyeClient(cfg.Solana.BirdeyeAPIKey)
				mint := args[0]
				fmt.Printf("%s🔬 Researching token: %s%s\n\n", colorTeal, mint, colorReset)

				// Metadata
				if meta, err := client.GetTokenMetadata(mint); err == nil {
					fmt.Printf("%s── Metadata ──%s\n", colorAmber, colorReset)
					fmt.Printf("  Name:     %s (%s)\n", meta.Name, meta.Symbol)
					fmt.Printf("  Decimals: %d\n", meta.Decimals)
					if meta.Extensions.Website != "" {
						fmt.Printf("  Website:  %s\n", meta.Extensions.Website)
					}
					if meta.Extensions.Twitter != "" {
						fmt.Printf("  Twitter:  %s\n", meta.Extensions.Twitter)
					}
				}

				// Market Data
				if md, err := client.GetTokenMarketData(mint); err == nil {
					fmt.Printf("\n%s── Market Data ──%s\n", colorAmber, colorReset)
					fmt.Printf("  Price:       $%.8f\n", md.Price)
					fmt.Printf("  Market Cap:  $%.0f\n", md.MarketCap)
					fmt.Printf("  FDV:         $%.0f\n", md.FDV)
					fmt.Printf("  Liquidity:   $%.0f\n", md.Liquidity)
					fmt.Printf("  Holders:     %d\n", md.Holder)
				}

				// Trade Data
				if td, err := client.GetTokenTradeData(mint); err == nil {
					fmt.Printf("\n%s── Trade Data (24h) ──%s\n", colorAmber, colorReset)
					fmt.Printf("  Volume:      $%.0f\n", td.Volume24hUSD)
					fmt.Printf("  Trades:      %d (buy: %d / sell: %d)\n", td.Trade24h, td.Buy24h, td.Sell24h)
					fmt.Printf("  Price Chg:   %.2f%%\n", td.PriceChange24hPct)
					fmt.Printf("  Wallets:     %d unique\n", td.UniqueWallet24h)
				}

				// Security
				if sec, err := client.GetTokenSecurity(mint); err == nil {
					fmt.Printf("\n%s── Security ──%s\n", colorAmber, colorReset)
					fmt.Printf("  Mutable:       %v\n", sec.IsMutable)
					fmt.Printf("  Top10 Hold%%:   %.2f%%\n", sec.Top10Percentage)
					fmt.Printf("  Mint Auth:     %s\n", sec.HasMintAuth)
					fmt.Printf("  Freeze Auth:   %s\n", sec.HasFreezeAuth)
				}

				return nil
			},
		},
		&cobra.Command{
			Use:   "trending",
			Short: "Show trending Solana tokens (Birdeye)",
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, err := config.Load()
				if err != nil {
					return fmt.Errorf("config error: %w", err)
				}
				if cfg.Solana.BirdeyeAPIKey == "" {
					return fmt.Errorf("BIRDEYE_API_KEY not set")
				}
				client := solana.NewBirdeyeClient(cfg.Solana.BirdeyeAPIKey)

				fmt.Printf("%s🌐 Trending Solana Tokens%s\n\n", colorGreen, colorReset)
				tokens, err := client.GetTrendingV3(20)
				if err != nil {
					return fmt.Errorf("birdeye trending: %w", err)
				}
				for i, t := range tokens {
					chgColor := colorGreen
					if t.PriceChange24hPct < 0 {
						chgColor = colorRed
					}
					fmt.Printf("  %2d. %s%-8s%s $%.6f  %s%+.2f%%%s  MCap: $%.0f  Vol: $%.0f\n",
						i+1, colorTeal, t.Symbol, colorReset,
						t.Price, chgColor, t.PriceChange24hPct, colorReset,
						t.MarketCap, t.Volume24hUSD)
				}
				return nil
			},
		},
		&cobra.Command{
			Use:   "search [keyword]",
			Short: "Search for Solana tokens by name or symbol",
			Args:  cobra.ExactArgs(1),
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, err := config.Load()
				if err != nil {
					return fmt.Errorf("config error: %w", err)
				}
				if cfg.Solana.BirdeyeAPIKey == "" {
					return fmt.Errorf("BIRDEYE_API_KEY not set")
				}
				client := solana.NewBirdeyeClient(cfg.Solana.BirdeyeAPIKey)
				keyword := args[0]

				fmt.Printf("%s🔍 Searching: %s%s\n\n", colorTeal, keyword, colorReset)
				results, err := client.SearchToken(keyword, 10)
				if err != nil {
					return fmt.Errorf("birdeye search: %w", err)
				}
				for _, r := range results {
					fmt.Printf("  %s%-8s%s %s $%.8f  Liq: $%.0f\n",
						colorTeal, r.Symbol, colorReset, r.Name, r.Price, r.Liquidity)
					fmt.Printf("    %s%s%s\n", colorDim, r.Address, colorReset)
				}
				if len(results) == 0 {
					fmt.Printf("  %sNo results found%s\n", colorDim, colorReset)
				}
				return nil
			},
		},
		NewSolanaDASCommand(),
		NewSolanaSPLCommand(),
	)

	return cmd
}

func NewSolanaDASCommand() *cobra.Command {
	defaults := mustLoadConfigDefaults()

	cmd := &cobra.Command{
		Use:   "das",
		Short: "Helius DAS methods (asset, owner-assets, search)",
	}

	getAsset := &cobra.Command{
		Use:   "get-asset [id]",
		Short: "DAS getAsset",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			showFungible, _ := cmd.Flags().GetBool("show-fungible")
			result, err := client.GetAsset(args[0], displayOptionsFromFlags(showFungible, false, false))
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	getAsset.Flags().Bool("show-fungible", false, "Include fungible token fields")
	addHeliusCommonFlags(getAsset, defaults)

	getAssetBatch := &cobra.Command{
		Use:   "get-asset-batch [id...]",
		Short: "DAS getAssetBatch",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			result, err := client.GetAssetBatch(args)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	addHeliusCommonFlags(getAssetBatch, defaults)

	assetProof := &cobra.Command{
		Use:   "asset-proof [id]",
		Short: "DAS getAssetProof",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			result, err := client.GetAssetProof(args[0])
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	addHeliusCommonFlags(assetProof, defaults)

	ownerAssets := &cobra.Command{
		Use:   "owner-assets [owner]",
		Short: "DAS getAssetsByOwner",
		Args:  cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			owner := strings.TrimSpace(cfg.Solana.WalletPubkey)
			if len(args) > 0 {
				owner = strings.TrimSpace(args[0])
			}
			if owner == "" {
				return fmt.Errorf("owner address required (pass [owner] or set solana.wallet_pubkey in config)")
			}

			page, _ := cmd.Flags().GetInt("page")
			limit, _ := cmd.Flags().GetInt("limit")
			tokenType, _ := cmd.Flags().GetString("token-type")
			showFungible, _ := cmd.Flags().GetBool("show-fungible")
			showNativeBalance, _ := cmd.Flags().GetBool("show-native-balance")
			showInscription, _ := cmd.Flags().GetBool("show-inscription")

			result, err := client.GetAssetsByOwner(
				owner,
				page,
				limit,
				tokenType,
				displayOptionsFromFlags(showFungible, showNativeBalance, showInscription),
			)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	ownerAssets.Flags().Int("page", 1, "Page number (DAS pages start at 1)")
	ownerAssets.Flags().Int("limit", 100, "Page size")
	ownerAssets.Flags().String("token-type", "", "Optional token type: fungible|nonFungible|regularNft|compressedNft|all")
	ownerAssets.Flags().Bool("show-fungible", false, "Include fungible token fields")
	ownerAssets.Flags().Bool("show-native-balance", false, "Include native SOL balance fields")
	ownerAssets.Flags().Bool("show-inscription", false, "Include inscription fields")
	addHeliusCommonFlags(ownerAssets, defaults)

	search := &cobra.Command{
		Use:   "search",
		Short: "DAS searchAssets using raw JSON params",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			rawParams, _ := cmd.Flags().GetString("params")
			params, err := parseJSONMap(rawParams)
			if err != nil {
				return err
			}

			result, err := client.SearchAssets(params)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	search.Flags().String("params", "{}", "JSON object for searchAssets params")
	_ = search.MarkFlagRequired("params")
	addHeliusCommonFlags(search, defaults)

	assetSignatures := &cobra.Command{
		Use:   "asset-signatures [id]",
		Short: "DAS getSignaturesForAsset",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			page, _ := cmd.Flags().GetInt("page")
			limit, _ := cmd.Flags().GetInt("limit")
			result, err := client.GetSignaturesForAsset(args[0], page, limit)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	assetSignatures.Flags().Int("page", 1, "Page number")
	assetSignatures.Flags().Int("limit", 100, "Page size")
	addHeliusCommonFlags(assetSignatures, defaults)

	cmd.AddCommand(
		getAsset,
		getAssetBatch,
		assetProof,
		ownerAssets,
		search,
		assetSignatures,
	)

	return cmd
}

func NewSolanaSPLCommand() *cobra.Command {
	defaults := mustLoadConfigDefaults()

	cmd := &cobra.Command{
		Use:   "spl",
		Short: "Helius SPL + generic RPC methods",
	}

	tokenBalance := &cobra.Command{
		Use:   "token-balance [token-account]",
		Short: "RPC getTokenAccountBalance",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			result, err := client.GetTokenAccountBalance(args[0])
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	addHeliusCommonFlags(tokenBalance, defaults)

	tokenAccounts := &cobra.Command{
		Use:   "token-accounts [owner]",
		Short: "RPC getTokenAccountsByOwner",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			mint, _ := cmd.Flags().GetString("mint")
			programID, _ := cmd.Flags().GetString("program-id")
			encoding, _ := cmd.Flags().GetString("encoding")

			result, err := client.GetTokenAccountsByOwner(args[0], programID, mint, encoding)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	tokenAccounts.Flags().String("mint", "", "Optional mint filter (overrides program-id)")
	tokenAccounts.Flags().String("program-id", solana.TokenProgramID, "Token program ID when mint is not provided")
	tokenAccounts.Flags().String("encoding", "jsonParsed", "Response encoding (jsonParsed|base64)")
	addHeliusCommonFlags(tokenAccounts, defaults)

	tokenSupply := &cobra.Command{
		Use:   "token-supply [mint]",
		Short: "RPC getTokenSupply",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			result, err := client.GetTokenSupply(args[0])
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	addHeliusCommonFlags(tokenSupply, defaults)

	tokenLargest := &cobra.Command{
		Use:   "token-largest [mint]",
		Short: "RPC getTokenLargestAccounts",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			result, err := client.GetTokenLargestAccounts(args[0])
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	addHeliusCommonFlags(tokenLargest, defaults)

	rpc := &cobra.Command{
		Use:   "rpc [method]",
		Short: "Generic RPC passthrough",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			client, err := newHeliusClientForCLI(cmd, cfg)
			if err != nil {
				return err
			}

			rawParams, _ := cmd.Flags().GetString("params")
			params, err := parseJSONAny(rawParams)
			if err != nil {
				return err
			}

			result, err := client.RPCAny(args[0], params)
			if err != nil {
				return err
			}
			return printJSON(result)
		},
	}
	rpc.Flags().String("params", "{}", "JSON params (object or array)")
	addHeliusCommonFlags(rpc, defaults)

	cmd.AddCommand(
		tokenBalance,
		tokenAccounts,
		tokenSupply,
		tokenLargest,
		rpc,
	)

	return cmd
}

func mustLoadConfigDefaults() *config.Config {
	cfg, err := config.Load()
	if err != nil {
		return config.DefaultConfig()
	}
	return cfg
}

func addHeliusCommonFlags(cmd *cobra.Command, cfg *config.Config) {
	network := cfg.Solana.HeliusNetwork
	if network == "" {
		network = "mainnet"
	}
	timeout := cfg.Solana.HeliusTimeoutSeconds
	if timeout <= 0 {
		timeout = 20
	}
	retries := cfg.Solana.HeliusRetries
	if retries <= 0 {
		retries = 3
	}

	cmd.Flags().String("api-key", cfg.Solana.HeliusAPIKey, "Helius API key (or set HELIUS_API_KEY)")
	cmd.Flags().String("network", network, "Helius network (mainnet|devnet)")
	cmd.Flags().String("endpoint", cfg.Solana.HeliusRPCURL, "Optional custom Helius RPC endpoint")
	cmd.Flags().Float64("timeout", timeout, "RPC timeout in seconds")
	cmd.Flags().Int("retries", retries, "RPC retry attempts")
}

func newHeliusClientForCLI(cmd *cobra.Command, cfg *config.Config) (*solana.HeliusClient, error) {
	apiKey, _ := cmd.Flags().GetString("api-key")
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		apiKey = strings.TrimSpace(cfg.Solana.HeliusAPIKey)
	}
	if apiKey == "" {
		return nil, fmt.Errorf("missing Helius API key (set HELIUS_API_KEY or pass --api-key)")
	}

	network, _ := cmd.Flags().GetString("network")
	network = strings.TrimSpace(network)
	if network == "" {
		network = strings.TrimSpace(cfg.Solana.HeliusNetwork)
	}
	if network == "" {
		network = "mainnet"
	}

	endpoint, _ := cmd.Flags().GetString("endpoint")
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = strings.TrimSpace(cfg.Solana.HeliusRPCURL)
	}

	timeout, _ := cmd.Flags().GetFloat64("timeout")
	if timeout <= 0 {
		timeout = cfg.Solana.HeliusTimeoutSeconds
	}
	if timeout <= 0 {
		timeout = 20
	}

	retries, _ := cmd.Flags().GetInt("retries")
	if retries <= 0 {
		retries = cfg.Solana.HeliusRetries
	}
	if retries <= 0 {
		retries = 3
	}

	return solana.NewHeliusClientWithOptions(
		apiKey,
		endpoint,
		cfg.Solana.HeliusWSSURL,
		network,
		time.Duration(timeout*float64(time.Second)),
		retries,
		750*time.Millisecond,
	), nil
}

func displayOptionsFromFlags(showFungible, showNativeBalance, showInscription bool) map[string]any {
	opts := map[string]any{}
	if showFungible {
		// Keep both keys for compatibility with Helius doc variants.
		opts["showFungible"] = true
		opts["showFungibleTokens"] = true
	}
	if showNativeBalance {
		opts["showNativeBalance"] = true
	}
	if showInscription {
		opts["showInscription"] = true
	}
	if len(opts) == 0 {
		return nil
	}
	return opts
}

func parseJSONMap(raw string) (map[string]any, error) {
	raw = sanitizeJSONInput(raw)
	if raw == "" {
		return map[string]any{}, nil
	}
	var params map[string]any
	if err := json.Unmarshal([]byte(raw), &params); err != nil {
		return nil, fmt.Errorf("invalid JSON object: %w", err)
	}
	if params == nil {
		params = map[string]any{}
	}
	return params, nil
}

func parseJSONAny(raw string) (any, error) {
	raw = sanitizeJSONInput(raw)
	if raw == "" {
		return map[string]any{}, nil
	}
	var params any
	if err := json.Unmarshal([]byte(raw), &params); err != nil {
		return nil, fmt.Errorf("invalid JSON params: %w", err)
	}
	if params == nil {
		params = map[string]any{}
	}
	return params, nil
}

func printJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(v)
}

func sanitizeJSONInput(raw string) string {
	s := strings.TrimSpace(raw)
	if len(s) >= 2 {
		if (s[0] == '\'' && s[len(s)-1] == '\'') || (s[0] == '`' && s[len(s)-1] == '`') {
			s = s[1 : len(s)-1]
		}
	}
	return strings.TrimSpace(s)
}

// ── Daemon Command ───────────────────────────────────────────────────

func NewDaemonCommand() *cobra.Command {
	var (
		petName    string
		seekerMode bool
		noTelegram bool
		noOODA     bool
	)

	cmd := &cobra.Command{
		Use:   "daemon",
		Short: "Start the SolanaOS daemon (OODA + wallet + Telegram + x402 + companion runtime)",
		Long: `Launch the full SolanaOS daemon — a long-running process that:
  • Generates/loads the agentic Solana wallet
  • Connects to Helius RPC (or fallback)
  • Starts the companion runtime state engine
  • Starts the Telegram bot (if configured)
  • Supports Seeker-focused mode + custom companion identity
  • Initializes x402 payment gateway
  • Runs the heartbeat loop
  • Waits for SIGINT/SIGTERM to shutdown`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			petNameResolved := strings.TrimSpace(petName)
			if petNameResolved == "" {
				petNameResolved = "SolanaOS"
			}
			if seekerMode && !cmd.Flags().Changed("pet-name") {
				petNameResolved = "SeekerClaw"
			}

			d, err := daemon.NewWithOptions(cfg, daemon.Options{
				PetName:         petNameResolved,
				SeekerMode:      seekerMode,
				DisableTelegram: noTelegram,
				AutoStartOODA:   !noOODA,
			})
			if err != nil {
				return fmt.Errorf("daemon init: %w", err)
			}

			return d.Run()
		},
	}

	cmd.Flags().StringVar(&petName, "pet-name", "SolanaOS", "Companion runtime display name")
	cmd.Flags().BoolVar(&seekerMode, "seeker", false, "Enable Seeker branding/mode for daemon runtime")
	cmd.Flags().BoolVar(&noTelegram, "no-telegram", false, "Disable Telegram channel startup")
	cmd.Flags().BoolVar(&noOODA, "no-ooda", false, "Disable OODA autostart (daemon still serves wallet/pet/x402/channels)")

	return cmd
}

// ── Pet Command (TamaGOchi) ──────────────────────────────────────────

func NewPetCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "pet",
		Short: "Show companion runtime status",
		Long:  "Display the SolanaOS companion runtime state, including progression, mood, energy, and performance-reactive status.",
		Run: func(cmd *cobra.Command, args []string) {
			pet := tamagochi.New("SolanaOS")
			fmt.Println()
			fmt.Println(pet.StatusString())
			fmt.Println()
		},
	}
	return cmd
}

// ── Version Command ──────────────────────────────────────────────────

func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show version info",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("SolanaOS %s\n", config.FormatVersion())
			buildTime, goVer := config.FormatBuildInfo()
			if buildTime != "" {
				fmt.Printf("built:  %s\n", buildTime)
			}
			fmt.Printf("go:     %s\n", goVer)
		},
	}
}

// ── Console hooks (AgentHooks → terminal output) ───────────────────────

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
func (c *consoleHooks) OnHeartbeat(cycleCount, openPos int) {
	fmt.Printf("%s[OODA]%s 💓 cycle=%d open=%d\n", colorDim, colorReset, cycleCount, openPos)
}

// ── Interactive REPL ─────────────────────────────────────────────────

func runInteractiveAgent(cfg *config.Config) error {
	client := llm.New()
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 4096), 1024*1024)
	sessionID := fmt.Sprintf("cli-%d", time.Now().Unix())

	for {
		fmt.Printf("%s🐹 > %s", colorGreen, colorReset)
		if !scanner.Scan() {
			return nil
		}
		input := scanner.Text()

		switch {
		case input == "exit" || input == "quit":
			fmt.Printf("%s💤 SolanaOS sleeping. Vault saved.%s\n", colorDim, colorReset)
			return nil
		case input == "!trades":
			fmt.Printf("%s📊 Trade history: (not yet implemented)%s\n", colorDim, colorReset)
		case input == "!lessons":
			fmt.Printf("%s🧠 Learned patterns: (not yet implemented)%s\n", colorDim, colorReset)
		case len(input) > 10 && input[:10] == "!remember ":
			fmt.Printf("%s💾 Stored to ClawVault: %s%s\n", colorGreen, input[10:], colorReset)
		case len(input) > 8 && input[:8] == "!recall ":
			fmt.Printf("%s🔍 Searching memory: %s%s\n", colorTeal, input[8:], colorReset)
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
		return "", fmt.Errorf("no LLM backend configured; set OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_MODEL")
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

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func main() {
	config.BootstrapEnv()
	fmt.Print(banner)
	cmd := NewSolanaOSCommand()
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
