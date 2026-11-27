// The Clawd Bot — Sovereign Solana Trading Intelligence
// Optimized for lightweight edge deployment on NVIDIA Orin Nano-class hardware.
// Public runtime repo: see pkg/config.RuntimeRepoURL
// Public ecosystem hub: see pkg/config.HubRepoURL
// License: MIT

package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/agent"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/birthfund"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/bus"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/catalog"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/channels"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/config"
	dnaPkg "github.com/x402agent/SolanaOS/clawdbot/pkg/dna"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/doctor"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/hardware"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/laws"
	oodaPkg "github.com/x402agent/SolanaOS/clawdbot/pkg/ooda"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/perfbench"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/phoenix"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
	skillsPkg "github.com/x402agent/SolanaOS/clawdbot/pkg/skills"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/solana"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/spinner"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/trading"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/vulcan"
	walletPkg "github.com/x402agent/SolanaOS/clawdbot/pkg/wallet"
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
		colorGreen + "    ███╗   ███╗ █████╗ ██╗    ██╗██████╗ " + colorPurple + "██████╗  ██████╗ ████████╗\n" +
		colorGreen + "    ████╗ ████║██╔══██╗██║    ██║██╔══██╗" + colorPurple + "██╔══██╗██╔═══██╗╚══██╔══╝\n" +
		colorGreen + "    ██╔████╔██║███████║██║ █╗ ██║██║  ██║" + colorPurple + "██████╔╝██║   ██║   ██║   \n" +
		colorGreen + "    ██║╚██╔╝██║██╔══██║██║███╗██║██║  ██║" + colorPurple + "██╔══██╗██║   ██║   ██║   \n" +
		colorGreen + "    ██║ ╚═╝ ██║██║  ██║╚███╔███╔╝██████╔╝" + colorPurple + "██████╔╝╚██████╔╝   ██║   \n" +
		colorGreen + "    ╚═╝     ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝ " + colorPurple + "╚═════╝  ╚═════╝    ╚═╝   \n" +
		colorReset + "\n" +
		colorDim + "    ┌─────────────────────────────────────────────────────────┐\n" +
		colorDim + "    │" + colorTeal + "  🦞 Sovereign Solana Trading Intelligence" + colorDim + "                 │\n" +
		colorDim + "    │" + colorAmber + "  NVIDIA Orin Nano · <10MB RAM · Go Runtime" + colorDim + "             │\n" +
		colorDim + "    │" + colorGreen + "  $CLAWD :: Droids Lead The Way" + colorDim + "                          │\n" +
		colorDim + "    └─────────────────────────────────────────────────────────┘\n" +
		colorReset + "\n"

	lobster = colorRed + `              ,
             /|      __
            / |   ,-~ /
           Y :|  //  /
           | jj /( .^
           >-"~"-v"
          /       Y
         jo  o    |
        ( ~T~     j
         >._-' _./
        /   "~"  |
       Y     _,  |
      /| ;-"~ _  l
     / l/ ,-"~    \
     \//\/      .- \
      Y        /    Y
      l       I     !
      ]\      _\    /"\
     (" ~----( ~   Y.  )` + colorReset + "\n"
)

func NewClawdBotCommand() *cobra.Command {
	short := fmt.Sprintf("%s The Clawd Bot — Sovereign Solana Trading Intelligence v%s", "🦞", config.GetVersion())

	cmd := &cobra.Command{
		Use:           "clawdbot",
		Short:         short,
		SilenceUsage:  true,
		SilenceErrors: true,
		Long: `The Clawd Bot — ultra-lightweight autonomous trading agent for Solana.
Powered by The Clawd Bot runtime for NVIDIA Orin Nano-class edge hardware.

Features:
  • OODA Loop (Observe → Orient → Decide → Act)
  • ClawVault persistent memory (known/learned/inferred)
  • Six-law trading harness (3 on-chain + 3 off-chain)
  • Trading cockpit, risk gate, doctor, and performance bench
  • The Clawd Bot Strategy: RSI + EMA cross + ATR signal engine
  • Solana: Jupiter swaps, Birdeye analytics, Helius RPC, Vulcan/Phoenix perps
  • Arduino Modulino® I2C: LEDs, buzzer, buttons, knob, sensors
  • Dexter deep research agent
  • Multi-channel: Telegram, Discord, CLI
  • <10MB RAM, boots in <1s on ARM64

Public surfaces:
  • Runtime repo: https://github.com/x402agent/SolanaOS (clawdbot/)
  • Ecosystem hub: https://github.com/solizardking/solana-clawd
  • x402 gateway: https://zk.x402.wtf
  • Terminal: https://musebook.trade`,
		Example: "clawdbot agent -m \"What is SOL price?\"\nclawdbot ooda --interval 60\nclawdbot ooda harness --ticks 50 --sleep 0\nclawdbot ooda --hw-bus 1\nclawdbot hardware scan\nclawdbot hardware demo\nclawdbot status",
	}

	cmd.AddCommand(
		NewAgentCommand(),
		NewGatewayCommand(),
		NewOnboardCommand(),
		NewDNACommand(),
		NewStatusCommand(),
		NewCatalogCommand(),
		NewSkillsCommand(),
		NewLawsCommand(),
		NewDoctorCommand(),
		NewBenchCommand(),
		NewTradeCommand(),
		NewOODACommand(),
		NewSolanaCommand(),
		NewHardwareCommand(),
		NewVersionCommand(),
		NewWebCommand(),
		NewPerpsCommand(),
		NewZeroCommand(),
		NewSpinnerCommand(),
	)

	return cmd
}

// ── Laws Command ─────────────────────────────────────────────────────

func NewLawsCommand() *cobra.Command {
	var jsonOut bool
	cmd := &cobra.Command{
		Use:   "laws",
		Short: "Print the Clawd six-law trading harness",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := laws.Validate(); err != nil {
				return err
			}
			if jsonOut {
				return writeJSON(laws.Six)
			}
			fmt.Print(laws.Markdown())
			return nil
		},
	}
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	return cmd
}

// ── Spinner Command ──────────────────────────────────────────────────

func NewSpinnerCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "spinner",
		Short: "List, preview, or set the themed spinner verb pack used by clawdbot agent",
	}

	list := &cobra.Command{
		Use:   "list",
		Short: "List available spinner packs",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			active := cfg.Agents.Defaults.SpinnerPack
			if active == "" {
				active = spinner.DefaultPack
			}
			for _, name := range spinner.Packs() {
				marker := "  "
				if name == active {
					marker = fmt.Sprintf("%s>%s ", colorGreen, colorReset)
				}
				fmt.Printf("%s%s\n", marker, name)
			}
			return nil
		},
	}

	preview := &cobra.Command{
		Use:   "preview <pack>",
		Short: "Animate a spinner pack for a few seconds",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			pack := args[0]
			if verbs := spinner.Verbs(pack); len(verbs) == 0 {
				return fmt.Errorf("pack %q not found; run 'clawdbot spinner list'", pack)
			}
			sp := spinner.New(pack, colorDim, colorReset)
			sp.Start()
			time.Sleep(3 * time.Second)
			sp.Stop()
			fmt.Printf("%s✔%s previewed pack %q\n", colorGreen, colorReset, pack)
			return nil
		},
	}

	set := &cobra.Command{
		Use:   "set <pack>",
		Short: "Set the default spinner pack in The Clawd Bot config",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			pack := args[0]
			names := spinner.Packs()
			found := false
			for _, name := range names {
				if name == pack {
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("pack %q not found; run 'clawdbot spinner list'", pack)
			}
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			cfg.Agents.Defaults.SpinnerPack = pack
			if err := config.Save(cfg); err != nil {
				return fmt.Errorf("save config: %w", err)
			}
			fmt.Printf("%s✔%s spinner pack set to %q\n", colorGreen, colorReset, pack)
			return nil
		},
	}

	cmd.AddCommand(list, preview, set)
	return cmd
}

// ── Doctor Command ───────────────────────────────────────────────────

func NewDoctorCommand() *cobra.Command {
	var jsonOut bool
	var fail bool
	cmd := &cobra.Command{
		Use:   "doctor",
		Short: "Run local Clawd Bot runtime and trading diagnostics",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			report := doctor.Run(doctor.Options{
				Config:        cfg,
				ConfigPath:    config.DefaultConfigPath(),
				WorkspacePath: config.DefaultWorkspacePath(),
				ProjectRoot:   projectRootFromWD(),
			})
			if jsonOut {
				if err := writeJSON(report); err != nil {
					return err
				}
			} else {
				fmt.Println(doctor.Format(report))
			}
			if fail && !report.OK {
				return fmt.Errorf("doctor found failing checks")
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	cmd.Flags().BoolVar(&fail, "fail", false, "Exit non-zero when a failing check is found")
	return cmd
}

// ── Bench Command ────────────────────────────────────────────────────

func NewBenchCommand() *cobra.Command {
	var (
		iterations int
		warmup     int
		jsonOut    bool
		fail       bool
		coldWarn   float64
		firstWarn  float64
		timeoutSec int
	)
	cmd := &cobra.Command{
		Use:   "bench",
		Short: "Run a fast Zero-style Clawd Bot startup benchmark",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
			defer cancel()
			result, err := perfbench.Run(ctx, perfbench.Options{
				Iterations:       iterations,
				WarmupIterations: warmup,
				Thresholds: perfbench.Thresholds{
					ColdStartP95Ms:   coldWarn,
					FirstOutputP95Ms: firstWarn,
				},
			})
			if err != nil {
				return err
			}
			if jsonOut {
				if err := perfbench.WriteJSON(os.Stdout, result); err != nil {
					return err
				}
			} else {
				fmt.Println(perfbench.Format(result))
			}
			if fail && len(result.Warnings) > 0 {
				return fmt.Errorf("benchmark exceeded warning thresholds")
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&iterations, "iterations", 5, "Measured benchmark iterations")
	cmd.Flags().IntVar(&warmup, "warmup", 1, "Warmup iterations")
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	cmd.Flags().BoolVar(&fail, "fail-on-warning", false, "Exit non-zero when thresholds are exceeded")
	cmd.Flags().Float64Var(&coldWarn, "cold-start-warn-ms", perfbench.DefaultThresholds.ColdStartP95Ms, "Cold-start p95 warning threshold")
	cmd.Flags().Float64Var(&firstWarn, "first-output-warn-ms", perfbench.DefaultThresholds.FirstOutputP95Ms, "First-output p95 warning threshold")
	cmd.Flags().IntVar(&timeoutSec, "timeout", 30, "Benchmark timeout in seconds")
	return cmd
}

// ── Trade Command ────────────────────────────────────────────────────

func NewTradeCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "trade",
		Short: "Trading cockpit and local risk tools",
		Long:  "Trading-native operator surface for readiness, guardrails, and local token risk scoring.",
	}
	cmd.AddCommand(newTradeCockpitCommand(), newTradeRiskCommand())
	return cmd
}

func newTradeCockpitCommand() *cobra.Command {
	var jsonOut bool
	cmd := &cobra.Command{
		Use:   "cockpit",
		Short: "Show trading readiness, connectors, limits, and six-law state",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			report := trading.BuildCockpitReport(cfg, time.Now())
			if jsonOut {
				return writeJSON(report)
			}
			fmt.Println(trading.FormatCockpit(report))
			return nil
		},
	}
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	return cmd
}

func newTradeRiskCommand() *cobra.Command {
	var (
		symbol     string
		price      float64
		change24h  float64
		volume24h  float64
		liquidity  float64
		top10      float64
		mutable    bool
		mintAuth   bool
		freezeAuth bool
		jsonOut    bool
	)
	cmd := &cobra.Command{
		Use:   "risk [symbol]",
		Short: "Score a token against The Clawd Bot trading risk gates",
		Args:  cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 && symbol == "" {
				symbol = args[0]
			}
			assessment := trading.AssessToken(trading.TokenSnapshot{
				Symbol:         symbol,
				Price:          price,
				Change24hPct:   change24h,
				Volume24hUSD:   volume24h,
				LiquidityUSD:   liquidity,
				Top10HolderPct: top10,
				Mutable:        mutable,
				HasMintAuth:    mintAuth,
				HasFreezeAuth:  freezeAuth,
			})
			if jsonOut {
				return writeJSON(assessment)
			}
			fmt.Println(trading.FormatRisk(assessment))
			return nil
		},
	}
	cmd.Flags().StringVar(&symbol, "symbol", "", "Token symbol")
	cmd.Flags().Float64Var(&price, "price", 0, "Token price")
	cmd.Flags().Float64Var(&change24h, "change24h", 0, "24h percent price change")
	cmd.Flags().Float64Var(&volume24h, "volume24h", 0, "24h volume in USD")
	cmd.Flags().Float64Var(&liquidity, "liquidity", 0, "Liquidity in USD")
	cmd.Flags().Float64Var(&top10, "top10", 0, "Top 10 holder percentage")
	cmd.Flags().BoolVar(&mutable, "mutable", false, "Token metadata is mutable")
	cmd.Flags().BoolVar(&mintAuth, "mint-auth", false, "Mint authority is active")
	cmd.Flags().BoolVar(&freezeAuth, "freeze-auth", false, "Freeze authority is active")
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	return cmd
}

// ── Agent Command ────────────────────────────────────────────────────

func NewAgentCommand() *cobra.Command {
	var message string

	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Chat with The Clawd Bot agent",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			if message != "" {
				fmt.Printf("%s[CLAWDBOT]%s Processing: %s\n", colorGreen, colorReset, message)
				fmt.Printf("%sfree AI path: zkrouter %s%s\n\n", colorDim, config.ZkRouterBaseURL, colorReset)
				a, err := newClawdAgent(cfg)
				if err != nil {
					return fmt.Errorf("agent init: %w", err)
				}
				ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
				defer cancel()
				sp := spinner.New(cfg.Agents.Defaults.SpinnerPack, colorDim, colorReset)
				sp.Start()
				answer, err := a.ProcessDirect(ctx, message)
				sp.Stop()
				if err != nil || strings.TrimSpace(answer) == "" || strings.Contains(strings.ToLower(answer), "authentication_error") {
					if solana.LooksLikePriceQuery(message) {
						if fallback, ferr := solana.LivePriceAnswer(message); ferr == nil {
							fmt.Printf("%s[CLAWDBOT]%s zkrouter unavailable — using live Jupiter price\n", colorAmber, colorReset)
							answer = fallback
							err = nil
						}
					}
				}
				if err != nil {
					return fmt.Errorf("agent error: %w", err)
				}
				if strings.TrimSpace(answer) == "" {
					return fmt.Errorf("agent error: empty reply from zkrouter")
				}
				fmt.Printf("%s[CLAWDBOT]%s %s\n", colorGreen, colorReset, answer)
				return nil
			}

			// Interactive REPL mode
			fmt.Print(lobster)
			fmt.Printf("%s🦞 The Clawd Bot Interactive Mode%s\n", colorGreen, colorReset)
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
	return &cobra.Command{
		Use:   "gateway",
		Short: "Start The Clawd Bot gateway (Telegram, Discord, WebSocket)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			fmt.Printf("%s🦞 The Clawd Bot Gateway starting...%s\n", colorGreen, colorReset)
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

			fmt.Printf("\n%sPublic Surfaces:%s\n", colorTeal, colorReset)
			fmt.Printf("  Runtime:   %s\n", config.RuntimeRepoURL)
			fmt.Printf("  Hub:       %s\n", config.HubRepoURL)
			fmt.Printf("  Gateway:   %s\n", config.GatewayURL)
			fmt.Printf("  Terminal:  %s\n", config.TerminalURL)

			return runGatewayRuntime(cfg)
		},
	}
}

func runGatewayRuntime(cfg *config.Config) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	messageBus := bus.NewMessageBus()
	defer messageBus.Close()

	manager := channels.NewManager(messageBus)
	registered := manager.List()
	if len(registered) == 0 {
		fmt.Printf("%sNo concrete channel adapters registered; gateway will run OODA only.%s\n", colorAmber, colorReset)
	}

	if err := manager.StartAll(ctx); err != nil {
		return fmt.Errorf("channel startup: %w", err)
	}
	defer manager.StopAll(context.Background())

	go func() {
		for {
			msg, ok := messageBus.SubscribeOutbound(ctx)
			if !ok {
				return
			}
			if err := manager.DispatchOutbound(ctx, msg); err != nil {
				fmt.Fprintf(os.Stderr, "[gateway] outbound dispatch failed channel=%s chat=%s err=%v\n", msg.Channel, msg.ChatID, err)
			}
		}
	}()

	ooda := agent.NewOODAAgent(cfg, &consoleHooks{})
	if err := ooda.Start(); err != nil {
		return fmt.Errorf("ooda startup: %w", err)
	}
	defer ooda.Stop()

	fmt.Printf("%sGateway runtime active. Press Ctrl-C to stop.%s\n", colorGreen, colorReset)
	<-ctx.Done()
	fmt.Printf("\n%sGateway shutting down...%s\n", colorAmber, colorReset)
	return nil
}

// ── Onboard Command ──────────────────────────────────────────────────

func NewOnboardCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "onboard",
		Short: "Initialize The Clawd Bot config & workspace",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Print(lobster)
			fmt.Printf("%s🦞 Welcome to The Clawd Bot!%s\n\n", colorGreen, colorReset)

			configPath := config.DefaultConfigPath()
			workspacePath := config.DefaultWorkspacePath()
			dnaPath := dnaPkg.DefaultPath(workspacePath)

			fmt.Printf("Creating config at:    %s%s%s\n", colorTeal, configPath, colorReset)
			fmt.Printf("Creating workspace at: %s%s%s\n", colorTeal, workspacePath, colorReset)
			fmt.Printf("Creating agent DNA at: %s%s%s\n", colorTeal, dnaPath, colorReset)

			if err := config.EnsureDefaults(); err != nil {
				return fmt.Errorf("onboard failed: %w", err)
			}

			fmt.Printf("\n%s✓ The Clawd Bot initialized!%s\n", colorGreen, colorReset)
			fmt.Printf("%sEdit %s to configure API keys.%s\n", colorDim, configPath, colorReset)
			fmt.Printf("\nQuick start:\n")
			fmt.Printf("  %sclawdbot dna show%s\n", colorGreen, colorReset)
			fmt.Printf("  %sclawdbot agent -m \"Hello\"%s\n", colorGreen, colorReset)
			fmt.Printf("  %sclawdbot ooda --interval 60%s\n", colorGreen, colorReset)
			fmt.Printf("  %sclawdbot solana wallet%s\n", colorGreen, colorReset)
			fmt.Printf("  %sclawdbot perps quickstart%s\n", colorGreen, colorReset)
			fmt.Printf("  %sclawdbot skills birth --install%s\n", colorGreen, colorReset)
			return nil
		},
	}
}

// ── DNA Command ─────────────────────────────────────────────────────

func NewDNACommand() *cobra.Command {
	var (
		out     string
		jsonOut bool
	)

	cmd := &cobra.Command{
		Use:   "dna",
		Short: "Generate and inspect synthetic starter DNA for this agent",
		Long: `Generate a local synthetic DNA profile for a Clawd agent.

The DNA profile is identity and attestation metadata: A/C/G/T sequence,
motif metrics, trait scores, proof hashes, and a pending Solana attestation
seed. It is not biological or clinical instruction.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return showDNA(out, jsonOut)
		},
	}
	cmd.PersistentFlags().StringVar(&out, "out", "", "DNA file path (default: workspace/agent-dna.json)")
	cmd.PersistentFlags().BoolVar(&jsonOut, "json", false, "Print JSON")

	var (
		agentName string
		role      string
		seed      string
		length    int
		force     bool
		ifMissing bool
	)
	generate := &cobra.Command{
		Use:   "generate",
		Short: "Generate an agent DNA profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			path := resolveDNAPath(out)
			if existing, err := dnaPkg.ReadFile(path); err == nil && !force {
				if ifMissing {
					return printDNA(path, existing, false, jsonOut)
				}
				return fmt.Errorf("agent DNA already exists at %s; use --force to overwrite", path)
			} else if err != nil && !os.IsNotExist(err) {
				return err
			}

			value, err := dnaPkg.Generate(dnaPkg.Options{
				AgentName: agentName,
				Role:      role,
				Seed:      seed,
				Length:    length,
			})
			if err != nil {
				return err
			}
			if err := dnaPkg.WriteFile(path, value); err != nil {
				return err
			}
			return printDNA(path, value, true, jsonOut)
		},
	}
	generate.Flags().StringVar(&agentName, "agent-name", "The Clawd Bot", "Agent name embedded in the DNA profile")
	generate.Flags().StringVar(&role, "role", "sovereign Solana trading intelligence", "Agent role embedded in the DNA profile")
	generate.Flags().StringVar(&seed, "seed", "", "Optional deterministic seed; random when empty")
	generate.Flags().IntVar(&length, "length", dnaPkg.DefaultSequenceLength, "Synthetic DNA sequence length")
	generate.Flags().BoolVar(&force, "force", false, "Overwrite an existing DNA file")
	generate.Flags().BoolVar(&ifMissing, "if-missing", false, "Create DNA only when the file is missing")

	show := &cobra.Command{
		Use:   "show",
		Short: "Show the current agent DNA profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			return showDNA(out, jsonOut)
		},
	}

	cmd.AddCommand(generate, show)
	return cmd
}

func resolveDNAPath(path string) string {
	if strings.TrimSpace(path) != "" {
		return path
	}
	return dnaPkg.DefaultPath(config.DefaultWorkspacePath())
}

func showDNA(path string, jsonOut bool) error {
	path = resolveDNAPath(path)
	value, err := dnaPkg.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("agent DNA missing at %s; run `clawdbot dna generate` or `clawdbot onboard`", path)
		}
		return err
	}
	return printDNA(path, value, false, jsonOut)
}

func printDNA(path string, value dnaPkg.AgentDNA, created bool, jsonOut bool) error {
	if jsonOut {
		return writeJSON(map[string]any{
			"path":    path,
			"created": created,
			"dna":     value,
		})
	}
	if created {
		fmt.Printf("%sAgent DNA generated%s\n", colorGreen, colorReset)
	} else {
		fmt.Printf("%sAgent DNA loaded%s\n", colorTeal, colorReset)
	}
	fmt.Println(dnaPkg.Format(value))
	fmt.Printf("path: %s\n", path)
	return nil
}

// ── Status Command ───────────────────────────────────────────────────

func NewStatusCommand() *cobra.Command {
	var hwBus int

	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show The Clawd Bot status",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}

			fmt.Printf("%s🦞 The Clawd Bot Status%s\n\n", colorGreen, colorReset)
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
			fmt.Printf("\n%sPublic Surfaces:%s\n", colorTeal, colorReset)
			fmt.Printf("  Runtime:   %s\n", config.RuntimeRepoURL)
			fmt.Printf("  Hub:       %s\n", config.HubRepoURL)
			fmt.Printf("  Gateway:   %s\n", config.GatewayURL)
			fmt.Printf("  Terminal:  %s\n", config.TerminalURL)
			fmt.Printf("  Jupiter:     %s\n", boolIcon(cfg.Solana.JupiterEndpoint != ""))
			fmt.Printf("  Aster DEX:   %s\n", boolIcon(cfg.Solana.AsterAPIKey != ""))
			_, vulcanErr := exec.LookPath(cfg.Vulcan.Binary)
			fmt.Printf("  Vulcan CLI:  %s (%s)\n", boolIcon(vulcanErr == nil), cfg.Vulcan.DefaultMode)
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
				fmt.Printf("  %sRun: clawdbot hardware scan%s\n", colorDim, colorReset)
			}

			return nil
		},
	}

	cmd.Flags().IntVar(&hwBus, "hw-bus", 1, "I2C bus number to check for Modulino® hardware")
	return cmd
}

// ── Catalog Command ─────────────────────────────────────────────────

func NewCatalogCommand() *cobra.Command {
	roots := catalog.DefaultRoots()
	var jsonOut bool

	report := func() catalog.Report {
		return catalog.BuildReport(roots)
	}

	cmd := &cobra.Command{
		Use:   "catalog",
		Short: "Inspect local Clawd skills, agents, and ZK primitives",
		Long: `Inspect the local Clawd ecosystem indexes that The Clawd Bot can use:
  • /Users/8bit/skills/skills        local AgentSkill library
  • /Users/8bit/agents/agents/src    local agent catalog JSON definitions
  • ./zk-primitives                  Clawd ZK agent/client/program surface

The command is read-only. It does not install skills, execute tools, or call live
trading endpoints.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			r := report()
			if jsonOut {
				return writeJSON(r)
			}
			fmt.Printf("%s🦞 Clawd Catalog%s\n\n", colorGreen, colorReset)
			fmt.Printf("Skills:       %d\n", len(r.Skills))
			fmt.Printf("Agents:       %d\n", len(r.Agents))
			if r.ZK != nil {
				fmt.Printf("ZK agent:     %s", r.ZK.AgentPackageName)
				if r.ZK.AgentBinary != "" {
					fmt.Printf(" (%s)", r.ZK.AgentBinary)
				}
				fmt.Println()
				fmt.Printf("ZK client:    %s\n", r.ZK.ClientPackage)
				fmt.Printf("ZK program:   %s\n", r.ZK.ProgramName)
			}
			fmt.Printf("\n%sRoots:%s\n", colorTeal, colorReset)
			fmt.Printf("  Skills: %s\n", r.Roots.SkillsDir)
			fmt.Printf("  Agents: %s\n", r.Roots.AgentsDir)
			fmt.Printf("  ZK:     %s\n", r.Roots.ZKPrimitivesDir)
			printCatalogWarnings(r.Warnings)
			return nil
		},
	}

	cmd.PersistentFlags().StringVar(&roots.SkillsDir, "skills-dir", roots.SkillsDir, "Skill catalog root")
	cmd.PersistentFlags().StringVar(&roots.AgentsDir, "agents-dir", roots.AgentsDir, "Agent catalog JSON root")
	cmd.PersistentFlags().StringVar(&roots.ZKPrimitivesDir, "zk-dir", roots.ZKPrimitivesDir, "ZK primitives root")
	cmd.PersistentFlags().BoolVar(&jsonOut, "json", false, "Print JSON")

	cmd.AddCommand(&cobra.Command{
		Use:   "skills [query]",
		Short: "List local skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			r := report()
			query := strings.Join(args, " ")
			skills := catalog.FilterSkills(r.Skills, query)
			if jsonOut {
				return writeJSON(skills)
			}
			fmt.Printf("%sSkills (%d)%s\n", colorGreen, len(skills), colorReset)
			for _, skill := range skills {
				category := skill.Category
				if category == "" {
					category = "uncategorized"
				}
				fmt.Printf("  %s%-32s%s %-24s %s\n", colorTeal, skill.Slug, colorReset, category, truncate(skill.Description, 110))
			}
			printCatalogWarnings(r.Warnings)
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "agents [query]",
		Short: "List local agents",
		RunE: func(cmd *cobra.Command, args []string) error {
			r := report()
			query := strings.Join(args, " ")
			agents := catalog.FilterAgents(r.Agents, query)
			if jsonOut {
				return writeJSON(agents)
			}
			fmt.Printf("%sAgents (%d)%s\n", colorGreen, len(agents), colorReset)
			for _, agent := range agents {
				category := agent.Category
				if category == "" {
					category = "catalog"
				}
				fmt.Printf("  %s%-42s%s %-16s %s\n", colorTeal, agent.ID, colorReset, category, truncate(agent.Description, 100))
			}
			printCatalogWarnings(r.Warnings)
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "zk",
		Short: "Show the Clawd ZK primitive surface",
		RunE: func(cmd *cobra.Command, args []string) error {
			r := report()
			if r.ZK == nil {
				return fmt.Errorf("zk surface not available")
			}
			if jsonOut {
				return writeJSON(r.ZK)
			}
			zk := r.ZK
			fmt.Printf("%sClawd ZK Primitives%s\n", colorGreen, colorReset)
			fmt.Printf("  Root:       %s\n", zk.Root)
			fmt.Printf("  Skill:      %s\n", zk.SkillFile)
			fmt.Printf("  Manifest:   %s\n", zk.ManifestFile)
			if zk.Status != "" {
				fmt.Printf("  Status:     %s\n", zk.Status)
			}
			if zk.PackageManager != "" {
				fmt.Printf("  Packages:   %s workspace\n", zk.PackageManager)
			}
			fmt.Printf("  Agent:      %s", zk.AgentPackageName)
			if zk.AgentBinary != "" {
				fmt.Printf(" (%s)", zk.AgentBinary)
			}
			if len(zk.AgentAliases) > 0 {
				fmt.Printf(" aliases=%s", strings.Join(zk.AgentAliases, ","))
			}
			fmt.Println()
			fmt.Printf("  Client:     %s\n", zk.ClientPackage)
			fmt.Printf("  Program:    %s", zk.ProgramName)
			if zk.ProgramID != "" {
				fmt.Printf(" (%s)", zk.ProgramID)
			}
			fmt.Println()
			fmt.Printf("  Config:     %s\n", zk.ConfigFile)
			fmt.Printf("  Operations: %s\n", strings.Join(zk.Operations, ", "))
			if len(zk.Docs) > 0 {
				fmt.Println("  Docs:")
				for _, doc := range zk.Docs {
					fmt.Printf("    - %s\n", doc)
				}
			}
			printCatalogWarnings(r.Warnings)
			return nil
		},
	})

	var (
		packOut           string
		packDryRun        bool
		packIncludeSkills bool
		packIncludeAgents bool
		packIncludeZK     bool
	)
	packIncludeSkills = true
	packIncludeAgents = true
	packIncludeZK = true
	packOut = filepath.Join(config.DefaultWorkspacePath(), "clawd-agent-pack.tar.gz")

	packCmd := &cobra.Command{
		Use:     "compress [query]",
		Aliases: []string{"pack", "compact", "pied-piper"},
		Short:   "Compress local agent catalog material into a tiny bundle",
		Long: `Compress the local Clawd catalog into a deterministic tar.gz bundle.

The pack includes matching agent JSON definitions, skill source folders, and the
ZK primitives surface. It automatically skips regenerated or bulky payloads such
as node_modules, dist, build, target, caches, screenshots, lockfiles for optional
TypeScript surfaces, and secret-looking env/key files.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if !packIncludeSkills && !packIncludeAgents && !packIncludeZK {
				return fmt.Errorf("enable at least one of --skills, --agents, or --zk")
			}
			r := report()
			result, err := catalog.CompressReport(r, catalog.PackOptions{
				OutputPath:    packOut,
				Query:         strings.Join(args, " "),
				IncludeSkills: packIncludeSkills,
				IncludeAgents: packIncludeAgents,
				IncludeZK:     packIncludeZK,
				DryRun:        packDryRun,
			})
			if err != nil {
				return err
			}
			if jsonOut {
				return writeJSON(result)
			}

			fmt.Printf("%sClawd Agent Pack%s\n", colorGreen, colorReset)
			if packDryRun {
				fmt.Printf("  Output:     %s (dry run)\n", result.OutputPath)
			} else {
				fmt.Printf("  Output:     %s\n", result.OutputPath)
			}
			fmt.Printf("  Files:      %d (%d skills, %d agents, %d zk files)\n",
				result.FileCount,
				result.SkillCount,
				result.AgentCount,
				result.ZKFileCount,
			)
			fmt.Printf(
				"  Size:       %s -> %s\n",
				catalog.FormatBytes(result.OriginalBytes),
				catalog.FormatBytes(result.PackedBytes),
			)
			fmt.Printf("  Saved:      %s (%.1f%%)\n", catalog.FormatBytes(result.SavedBytes), result.SavingsPercent)
			printCatalogWarnings(result.Warnings)
			return nil
		},
	}
	packCmd.Flags().StringVar(&packOut, "out", packOut, "Output tar.gz path")
	packCmd.Flags().BoolVar(
		&packDryRun,
		"dry-run",
		false,
		"Estimate compressed size without writing the bundle",
	)
	packCmd.Flags().BoolVar(&packIncludeSkills, "skills", true, "Include matching skill source folders")
	packCmd.Flags().BoolVar(&packIncludeAgents, "agents", true, "Include matching agent JSON definitions")
	packCmd.Flags().BoolVar(&packIncludeZK, "zk", true, "Include ZK primitive source/config surface")
	cmd.AddCommand(packCmd)

	return cmd
}

// ── Skills Command ───────────────────────────────────────────────────

func NewSkillsCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "skills",
		Short: "Manage The Clawd Bot birth skill seeds",
	}
	cmd.AddCommand(newSkillsBirthCommand())
	return cmd
}

func newSkillsBirthCommand() *cobra.Command {
	var (
		jsonOut    bool
		install    bool
		timeoutSec int
	)
	cmd := &cobra.Command{
		Use:   "birth",
		Short: "Write or install the default skill packs every Clawd Bot spawn should inherit",
		Long: `Writes the birth skill manifest into The Clawd Bot workspace and can install
the default all-skills packs:
  - https://github.com/themusebook/skills --all
  - https://github.com/samber/cc-skills-golang --all`,
		RunE: func(cmd *cobra.Command, args []string) error {
			manifest := skillsPkg.BuildBirthManifest(time.Now(), nil)
			path := ""
			if !jsonOut || install {
				var err error
				path, err = skillsPkg.WriteBirthManifest(config.DefaultWorkspacePath(), manifest)
				if err != nil {
					return err
				}
			}
			if jsonOut {
				if err := writeJSON(map[string]any{"manifestPath": path, "manifest": manifest}); err != nil {
					return err
				}
			} else {
				fmt.Println(skillsPkg.FormatBirthManifest(manifest))
				fmt.Printf("manifest: %s\n", path)
			}
			if install {
				ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
				defer cancel()
				if err := skillsPkg.InstallBirthSources(ctx, manifest.Sources, os.Stdout); err != nil {
					return err
				}
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	cmd.Flags().BoolVar(&install, "install", false, "Run npx skills add for each birth source")
	cmd.Flags().IntVar(&timeoutSec, "timeout", 600, "Install timeout in seconds")
	return cmd
}

func writeJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func printCatalogWarnings(warnings []string) {
	if len(warnings) == 0 {
		return
	}
	fmt.Printf("\n%sWarnings:%s\n", colorAmber, colorReset)
	for _, warning := range warnings {
		fmt.Printf("  - %s\n", warning)
	}
}

// ── OODA Command — fully wired ─────────────────────────────────────────

func NewOODACommand() *cobra.Command {
	var (
		interval int
		hwBus    int
		noHW     bool
		simMode  bool
		ticks    int
	)

	cmd := &cobra.Command{
		Use:   "ooda",
		Short: "Start autonomous OODA trading loop",
		Long: `Start the Observe-Orient-Decide-Act autonomous trading cycle.
The agent will continuously:
  1. OBSERVE: Pull Helius on-chain + Birdeye OHLCV + Vulcan/Phoenix perps
  2. ORIENT:  RSI/EMA/ATR strategy evaluation + ClawVault recall
  3. DECIDE:  Signal scoring (strength × confidence threshold)
  4. ACT:     Open/close positions, store vault entries, adjust params

Hardware integration (when --hw-bus is set):
  Pixels  → live status (idle/signal/trade/win/loss)
  Buzzer  → audio alerts on signals, trades, wins, losses
  Button A → trigger immediate cycle
  Button B → toggle simulated/live mode
  Button C → emergency stop (closes all positions)
  Knob    → real-time RSI threshold tuning (twist to adjust, press to reset)

TypeScript paper/devnet harness:
  clawdbot ooda harness --ticks 50 --sleep 0
  clawdbot ooda harness --tui
  clawdbot ooda journal --tail 20`,
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

			maxTicks := oodaPkg.ResolveTickCount(simMode, ticks, cmd.Flags().Changed("ticks"))

			fmt.Printf("%s🔄 The Clawd Bot OODA Loop%s\n", colorGreen, colorReset)
			if simMode {
				fmt.Printf("%ssimulated tick banner — paper/sim mode, no live trades%s\n", colorAmber, colorReset)
			}
			if maxTicks > 0 {
				fmt.Printf("%sTicks: %d (one-shot)%s\n", colorDim, maxTicks, colorReset)
			}
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

			if !noHW {
				hwCfg := hardware.DefaultAdapterConfig()
				hwCfg.I2CBusNum = hwBus
				hwAdapter = hardware.NewHardwareAdapter(hwCfg, hardware.AgentControls{})
				if hwAdapter.IsConnected() {
					fmt.Printf("%s🎛  Hardware: %v%s\n", colorTeal, hwAdapter.ConnectedSensors(), colorReset)
					hooks = agent.NewMultiHooks(&consoleHooks{}, hwAdapter)
				} else {
					fmt.Printf("%s🎛  Hardware: not connected (stub mode)%s\n", colorDim, colorReset)
				}
			}

			fmt.Println()

			// ── Create agent ───────────────────────────────────────────────
			ooda := agent.NewOODAAgent(cfg, hooks)

			// ── Wire hardware controls back to agent ───────────────────────
			if hwAdapter != nil && hwAdapter.IsConnected() {
				hwCfg := hardware.DefaultAdapterConfig()
				hwCfg.I2CBusNum = hwBus
				controls := hardware.AgentControls{
					TriggerCycle:  ooda.TriggerCycle,
					SetMode:       ooda.SetMode,
					EmergencyStop: ooda.Stop,
					AdjustRSI:     ooda.AdjustRSI,
				}
				hwAdapter = hardware.NewHardwareAdapter(hwCfg, controls)
				hwAdapter.Start()
				defer hwAdapter.Stop()
			}

			// ── Start agent ────────────────────────────────────────────────
			if maxTicks > 0 {
				if err := ooda.RunTicks(maxTicks); err != nil {
					return fmt.Errorf("agent ticks: %w", err)
				}
				printOODAStats(ooda)
				return nil
			}

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
			printOODAStats(ooda)
			return nil
		},
	}

	cmd.Flags().IntVar(&interval, "interval", 0, "OODA cycle interval in seconds (overrides config)")
	cmd.Flags().IntVar(&hwBus, "hw-bus", 1, "I2C bus number for Modulino® hardware")
	cmd.Flags().BoolVar(&noHW, "no-hw", false, "Disable hardware integration")
	cmd.Flags().BoolVar(&simMode, "sim", false, "Force simulated mode (no live trades)")
	cmd.Flags().IntVar(&ticks, "ticks", 0, "Number of cycles to run (0=forever). Default 1 with --sim")
	cmd.AddCommand(
		NewOODAHarnessCommand(),
		NewOODAJournalCommand(),
	)
	return cmd
}

func NewOODAHarnessCommand() *cobra.Command {
	var (
		dir             string
		tsx             string
		ticks           int
		sleep           float64
		seed            int
		commitEvery     int
		timeoutSec      int
		useLLM          bool
		tui             bool
		goblin          bool
		perpsOI         bool
		perpsSymbol     string
		perpsSignalMode string
		perpsOIMock     bool
		planOnly        bool
	)

	cmd := &cobra.Command{
		Use:   "harness",
		Short: "Run the local TypeScript OODA paper/devnet harness",
		Long: `Run ooda/loop.ts through the main Clawd Bot CLI.

This harness is intentionally paper/devnet-only. It writes the append-only tick
journal under ooda/journal/ticks.jsonl and can optionally pipe structured JSONL
into ooda/tui.ts for the ANSI dashboard.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			runner, opts := buildOODAHarnessRun(cmd, dir, tsx, timeoutSec, oodaPkg.LoopOptions{
				Ticks:           ticks,
				SleepSeconds:    sleep,
				Seed:            seed,
				CommitEvery:     commitEvery,
				TUI:             tui,
				LLM:             useLLM,
				Goblin:          goblin,
				PerpsOI:         perpsOI,
				PerpsSymbol:     perpsSymbol,
				PerpsSignalMode: perpsSignalMode,
				PerpsOIMock:     perpsOIMock,
			})

			plan := runner.Plan(opts)
			if planOnly {
				return writeJSON(plan)
			}

			fmt.Printf("%sOODA Harness%s\n", colorGreen, colorReset)
			fmt.Printf("%sDir: %s%s\n", colorDim, plan.Dir, colorReset)
			fmt.Printf("%sJournal: %s%s\n\n", colorDim, plan.Journal, colorReset)

			ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer stop()
			return runner.RunAttached(ctx, opts)
		},
	}

	cmd.Flags().StringVar(&dir, "dir", defaultOODADir(), "OODA harness directory")
	cmd.Flags().StringVar(&tsx, "tsx", "", "tsx executable override (defaults to ooda/node_modules/.bin/tsx)")
	cmd.Flags().IntVar(&ticks, "ticks", 50, "Number of ticks to run")
	cmd.Flags().Float64Var(&sleep, "sleep", 0.25, "Seconds between ticks")
	cmd.Flags().IntVar(&seed, "seed", 42, "Seed for synthetic candles")
	cmd.Flags().IntVar(&commitEvery, "commit-every", 0, "Git commit the journal every N ticks")
	cmd.Flags().IntVar(&timeoutSec, "timeout", 0, "Optional harness timeout in seconds")
	cmd.Flags().BoolVar(&useLLM, "llm", false, "Use the LLM decision chain when keys are available")
	cmd.Flags().BoolVar(&tui, "tui", false, "Pipe loop JSONL into the local ANSI TUI")
	cmd.Flags().BoolVar(&goblin, "goblin", false, "Use the aggressive paper/devnet prompt variant")
	cmd.Flags().BoolVar(&perpsOI, "perps-oi", false, "Fetch perps open-interest signal when available")
	cmd.Flags().StringVar(&perpsSymbol, "perps-symbol", "", "Perps symbol override, for example SOL-PERP")
	cmd.Flags().StringVar(&perpsSignalMode, "perps-signal-mode", "", "Perps signal mode override")
	cmd.Flags().BoolVar(&perpsOIMock, "perps-oi-mock", false, "Use mock perps OI data")
	cmd.Flags().BoolVar(&planOnly, "plan", false, "Print the launch plan and exit")
	return cmd
}

func NewOODAJournalCommand() *cobra.Command {
	var (
		dir     string
		tail    int
		jsonOut bool
	)
	cmd := &cobra.Command{
		Use:   "journal",
		Short: "Tail the local TypeScript OODA harness journal",
		RunE: func(cmd *cobra.Command, args []string) error {
			runner := newOODARunner(dir, "", 0)
			lines, err := runner.ReadJournalTail(tail)
			if err != nil {
				return err
			}
			if jsonOut {
				entries := make([]any, 0, len(lines))
				for _, line := range lines {
					var entry any
					if err := json.Unmarshal([]byte(line), &entry); err != nil {
						entry = line
					}
					entries = append(entries, entry)
				}
				return writeJSON(map[string]any{
					"journal": runner.JournalPath(),
					"entries": entries,
				})
			}
			fmt.Printf("%s\n", runner.JournalPath())
			if len(lines) == 0 {
				fmt.Println("(empty)")
				return nil
			}
			for _, line := range lines {
				fmt.Println(line)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&dir, "dir", defaultOODADir(), "OODA harness directory")
	cmd.Flags().IntVar(&tail, "tail", 20, "Number of journal lines to print")
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print parsed JSON")
	return cmd
}

func buildOODAHarnessRun(cmd *cobra.Command, dir, tsx string, timeoutSec int, opts oodaPkg.LoopOptions) (*oodaPkg.Runner, oodaPkg.LoopOptions) {
	if !cmd.Flags().Changed("ticks") {
		opts.Ticks = 0
	}
	if cmd.Flags().Changed("sleep") {
		opts.SleepSet = true
	} else {
		opts.SleepSeconds = 0
	}
	if cmd.Flags().Changed("seed") {
		opts.SeedSet = true
	} else {
		opts.Seed = 0
	}
	if !cmd.Flags().Changed("perps-symbol") {
		opts.PerpsSymbol = ""
	}
	if !cmd.Flags().Changed("perps-signal-mode") {
		opts.PerpsSignalMode = ""
	}
	return newOODARunner(dir, tsx, timeoutSec), opts
}

func newOODARunner(dir, tsx string, timeoutSec int) *oodaPkg.Runner {
	timeout := time.Duration(timeoutSec) * time.Second
	return oodaPkg.New(oodaPkg.Config{
		Dir:     dir,
		TSX:     tsx,
		Timeout: timeout,
	})
}

func defaultOODADir() string {
	root := projectRootFromWD()
	if found, err := oodaPkg.FindDir(root); err == nil {
		return found
	}
	return filepath.Join(root, "ooda")
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
		NewSolanaWalletCommand(),
		NewSolanaFundAgentCommand(),
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
			Short: "Show trending Solana tokens (Birdeye, Jupiter fallback)",
			RunE: func(cmd *cobra.Command, args []string) error {
				cfg, err := config.Load()
				if err != nil {
					return fmt.Errorf("config error: %w", err)
				}
				jup := solana.NewJupiterClient(cfg.Solana.JupiterEndpoint, cfg.Solana.JupiterAPIKey)
				rows, err := solana.FetchTrending(solana.TrendingRequest{
					BirdeyeAPIKey: cfg.Solana.BirdeyeAPIKey,
					Limit:         20,
					Jupiter:       jup,
				})
				if err != nil {
					return fmt.Errorf("trending: %w", err)
				}
				if len(rows) == 0 {
					return fmt.Errorf("trending: no live rows")
				}
				fmt.Printf("%s🌐 Trending Solana Tokens%s  %s[%s]%s\n\n",
					colorGreen, colorReset, colorDim, rows[0].Source, colorReset)
				fmt.Print(solana.FormatTrending(rows))
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

func NewSolanaFundAgentCommand() *cobra.Command {
	var (
		send        bool
		jsonOut     bool
		solAmount   string
		solLamports string
		clawdAmount string
		clawdMint   string
		rpcURL      string
		ledgerPath  string
		timeoutSec  int
	)

	cmd := &cobra.Command{
		Use:     "fund-agent [recipient-pubkey]",
		Aliases: []string{"fund"},
		Short:   "Plan or send startup SOL + $CLAWD funding to an agent wallet",
		Long: `Plan or send startup funding for a registered agent wallet.

By default this is a dry-run plan. To send real funds, pass --send and provide
CLAWDBOT_TREASURY_KEYPAIR or CLAWDBOT_TREASURY_PRIVATE_KEY in the environment.
Private keys are never written to config, receipts, or command output.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			recipient := ""
			if len(args) > 0 {
				recipient = strings.TrimSpace(args[0])
			}
			if recipient == "" {
				recipient = strings.TrimSpace(cfg.Solana.WalletPubkey)
			}
			if recipient == "" && strings.TrimSpace(cfg.Solana.WalletKeyPath) != "" {
				if kp, err := walletPkg.Load(expandUserPath(cfg.Solana.WalletKeyPath)); err == nil {
					recipient = kp.Pubkey()
				}
			}
			if recipient == "" {
				return fmt.Errorf("recipient required; pass [recipient-pubkey] or run `clawdbot solana wallet init`")
			}

			funding := birthfund.FromEnv(recipient, config.DefaultWorkspacePath())
			funding.Enabled = true
			if send {
				funding.Send = true
			}
			if solAmount != "" {
				funding.SOLAmount = solAmount
			}
			if solLamports != "" {
				lamports, err := strconv.ParseUint(solLamports, 10, 64)
				if err != nil {
					return fmt.Errorf("invalid --sol-lamports: %w", err)
				}
				funding.SOLAmount = strconv.FormatFloat(float64(lamports)/1_000_000_000, 'f', 9, 64)
			}
			if clawdAmount != "" {
				funding.CLAWDAmount = clawdAmount
			}
			if clawdMint != "" {
				funding.CLAWDMint = clawdMint
			}
			if rpcURL != "" {
				funding.RPCURL = rpcURL
			}
			if ledgerPath != "" {
				funding.LedgerPath = expandUserPath(ledgerPath)
			}

			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
			defer cancel()
			result, err := birthfund.Fund(ctx, funding, birthfund.ExecRunner{})
			if jsonOut {
				_ = writeJSON(result)
			}
			if err != nil {
				return err
			}
			if jsonOut {
				return nil
			}

			fmt.Printf("%sAgent startup funding%s\n", colorGreen, colorReset)
			fmt.Printf("status:    %s\n", result.Status)
			fmt.Printf("recipient: %s\n", result.Recipient)
			fmt.Printf("sol:       %s SOL (%d lamports)\n", result.SOLAmount, result.SOLLamports)
			fmt.Printf("clawd:     %s tokens\n", result.CLAWDAmount)
			fmt.Printf("mint:      %s\n", result.CLAWDMint)
			fmt.Printf("rpc:       %s\n", result.RPCURL)
			if len(result.SOLCommand) > 0 {
				fmt.Printf("sol cmd:   %s\n", strings.Join(result.SOLCommand, " "))
			}
			if len(result.CLAWDCommand) > 0 {
				fmt.Printf("clawd cmd: %s\n", strings.Join(result.CLAWDCommand, " "))
			}
			if result.SOLSignature != "" {
				fmt.Printf("sol sig:   %s\n", result.SOLSignature)
			}
			if result.CLAWDSignature != "" {
				fmt.Printf("clawd sig: %s\n", result.CLAWDSignature)
			}
			for _, warning := range result.Warnings {
				fmt.Printf("%swarning:%s %s\n", colorAmber, colorReset, warning)
			}
			if !result.Send {
				fmt.Printf("%sdry-run only; pass --send and set CLAWDBOT_TREASURY_KEYPAIR or CLAWDBOT_TREASURY_PRIVATE_KEY to move funds.%s\n", colorDim, colorReset)
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&send, "send", false, "Send real transactions; otherwise only print and record the funding plan")
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")
	cmd.Flags().StringVar(&solAmount, "sol", "", "SOL amount to send (default: env or 0.069420)")
	cmd.Flags().StringVar(&solLamports, "sol-lamports", "", "Lamports to send; overrides --sol")
	cmd.Flags().StringVar(&clawdAmount, "clawd", "", "$CLAWD token amount to send (default: env or 1000)")
	cmd.Flags().StringVar(&clawdMint, "clawd-mint", "", "$CLAWD token mint (default: env or installer mint)")
	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Solana RPC URL")
	cmd.Flags().StringVar(&ledgerPath, "ledger", "", "JSONL funding ledger path")
	cmd.Flags().IntVar(&timeoutSec, "timeout", 120, "Funding command timeout in seconds")
	return cmd
}

func NewSolanaWalletCommand() *cobra.Command {
	var jsonOut bool

	cmd := &cobra.Command{
		Use:   "wallet",
		Short: "Show wallet info and balance",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			pubkey := strings.TrimSpace(cfg.Solana.WalletPubkey)
			keyPath := strings.TrimSpace(cfg.Solana.WalletKeyPath)
			if pubkey == "" && keyPath != "" {
				if kp, err := walletPkg.Load(expandUserPath(keyPath)); err == nil {
					pubkey = kp.Pubkey()
				}
			}

			if jsonOut {
				return writeJSON(map[string]any{
					"pubkey":      pubkey,
					"keypairPath": keyPath,
					"rpc":         cfg.Solana.HeliusRPCURL,
				})
			}

			fmt.Printf("%s💰 Solana Wallet%s\n", colorGreen, colorReset)
			fmt.Printf("Pubkey:  %s\n", pubkey)
			if keyPath != "" {
				fmt.Printf("Keypair: %s\n", keyPath)
			}
			fmt.Printf("RPC:     %s\n", truncate(cfg.Solana.HeliusRPCURL, 40))

			if pubkey != "" && cfg.Solana.HeliusAPIKey != "" {
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

				balance, err := hc.GetBalance(pubkey)
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
	}
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Print JSON")

	var (
		out      string
		force    bool
		initJSON bool
	)
	initCmd := &cobra.Command{
		Use:   "init",
		Short: "Generate or reuse the local agent wallet",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("config error: %w", err)
			}
			path := strings.TrimSpace(out)
			if path == "" {
				path = strings.TrimSpace(cfg.Solana.WalletKeyPath)
			}
			if path == "" {
				path = defaultAgentWalletPath()
			}
			path = expandUserPath(path)

			var kp *walletPkg.Keypair
			created := false
			if force {
				kp, err = walletPkg.Generate()
				if err != nil {
					return err
				}
				if err := walletPkg.Save(path, kp, true); err != nil {
					return err
				}
				created = true
			} else {
				kp, created, err = walletPkg.Ensure(path)
				if err != nil {
					return err
				}
			}

			cfg.Solana.WalletPubkey = kp.Pubkey()
			cfg.Solana.WalletKeyPath = path
			if err := config.Save(cfg); err != nil {
				return fmt.Errorf("save config: %w", err)
			}

			result := map[string]any{
				"created":     created,
				"pubkey":      kp.Pubkey(),
				"keypairPath": path,
				"configPath":  config.DefaultConfigPath(),
			}
			if initJSON {
				return writeJSON(result)
			}

			if created {
				fmt.Printf("%sAgent wallet generated%s\n", colorGreen, colorReset)
			} else {
				fmt.Printf("%sAgent wallet loaded%s\n", colorTeal, colorReset)
			}
			fmt.Printf("pubkey:  %s\n", kp.Pubkey())
			fmt.Printf("keypair: %s\n", path)
			fmt.Printf("config:  %s\n", config.DefaultConfigPath())
			return nil
		},
	}
	initCmd.Flags().StringVar(&out, "out", "", "Keypair path (default: workspace/agent-wallet.json)")
	initCmd.Flags().BoolVar(&force, "force", false, "Overwrite any existing keypair")
	initCmd.Flags().BoolVar(&initJSON, "json", false, "Print JSON")

	cmd.AddCommand(initCmd)
	return cmd
}

func defaultAgentWalletPath() string {
	return filepath.Join(config.DefaultWorkspacePath(), "agent-wallet.json")
}

func expandUserPath(path string) string {
	if path == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			return home
		}
	}
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, strings.TrimPrefix(path, "~/"))
		}
	}
	return path
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

func projectRootFromWD() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "."
		}
		dir = parent
	}
}

// ── Version Command ──────────────────────────────────────────────────

func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show version info",
		Run: func(cmd *cobra.Command, args []string) {
			out := cmd.OutOrStdout()
			fmt.Fprintf(out, "clawdbot %s\n", config.FormatVersion())
			buildTime, goVer := config.FormatBuildInfo()
			if buildTime != "" {
				fmt.Fprintf(out, "built:  %s\n", buildTime)
			}
			fmt.Fprintf(out, "go:     %s\n", goVer)
		},
	}
}

func printOODAStats(ooda *agent.OODAAgent) {
	stats := ooda.GetStats()
	fmt.Printf("\n%s📊 Final Stats:%s\n", colorGreen, colorReset)
	fmt.Printf("  Cycles:   %v\n", stats["cycles"])
	fmt.Printf("  Trades:   %v closed\n", stats["closed_trades"])
	fmt.Printf("  Win Rate: %.1f%%\n", stats["win_rate"])
	fmt.Printf("  Avg PnL:  %.2f%%\n", stats["avg_pnl_pct"])
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

// ── Provider + Agent Helpers ─────────────────────────────────────────

func buildProvider(cfg *config.Config) providers.LLMProvider {
	if len(cfg.ModelList) > 0 {
		entry := cfg.ModelList[0]
		base := entry.APIBase
		if base == "" {
			base = config.ZkRouterBaseURL
		}
		key := entry.APIKey
		if key == "" {
			key = "clawdbot-free"
		}
		return providers.NewOpenAICompatProvider(key, base)
	}
	return providers.NewOpenRouterProvider(cfg.Providers.OpenRouter.APIKey)
}

func newClawdAgent(cfg *config.Config) (*agent.ClawdAgent, error) {
	model := "openai/zkrouter-auto"
	if len(cfg.ModelList) > 0 && cfg.ModelList[0].Model != "" {
		model = cfg.ModelList[0].Model
	}
	godModeModels := make([]string, 0, len(cfg.ModelList))
	for _, entry := range cfg.ModelList {
		if entry.Model != "" {
			godModeModels = append(godModeModels, entry.Model)
		}
	}
	return agent.NewClawdAgent(agent.AgentConfig{
		Model:         model,
		Provider:      buildProvider(cfg),
		MaxIterations: cfg.Agents.Defaults.MaxToolIterations,
		MaxTokens:     cfg.Agents.Defaults.MaxTokens,
		Temperature:   cfg.Agents.Defaults.Temperature,
		GodMode:       cfg.GodMode.Enabled,
		GodModeModels: godModeModels,
		GodModeLimit:  cfg.GodMode.RaceLimit,
		GodModeBoost:  cfg.GodMode.SamplingBoost,
		GodModeLearn:  cfg.GodMode.Feedback,
	})
}

// ── Interactive REPL ─────────────────────────────────────────────────

func runInteractiveAgent(cfg *config.Config) error {
	a, err := newClawdAgent(cfg)
	if err != nil {
		return fmt.Errorf("agent init: %w", err)
	}

	reader := bufio.NewReader(os.Stdin)
	for {
		fmt.Printf("%s🦞 > %s", colorGreen, colorReset)
		input, err := reader.ReadString('\n')
		if err != nil {
			return nil
		}
		input = strings.TrimSpace(input)

		switch {
		case input == "exit" || input == "quit":
			fmt.Printf("%s💤 The Clawd Bot sleeping. Vault saved.%s\n", colorDim, colorReset)
			return nil
		case input == "":
			// skip empty
		case input == "!trades":
			fmt.Printf("%s📊 Trade history: (not yet implemented)%s\n", colorDim, colorReset)
		case input == "!lessons":
			fmt.Printf("%s🧠 Learned patterns: (not yet implemented)%s\n", colorDim, colorReset)
		case len(input) > 10 && input[:10] == "!remember ":
			fmt.Printf("%s💾 Stored to ClawVault: %s%s\n", colorGreen, input[10:], colorReset)
		case len(input) > 8 && input[:8] == "!recall ":
			fmt.Printf("%s🔍 Searching memory: %s%s\n", colorTeal, input[8:], colorReset)
		default:
			ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			sp := spinner.New(cfg.Agents.Defaults.SpinnerPack, colorDim, colorReset)
			sp.Start()
			answer, err := a.ProcessDirect(ctx, input)
			sp.Stop()
			cancel()
			if err != nil {
				fmt.Printf("%s[ERROR]%s %v\n\n", colorRed, colorReset, err)
			} else {
				fmt.Printf("\n%s[CLAWDBOT]%s %s\n\n", colorGreen, colorReset, answer)
			}
		}
	}
}

// ── Web Command ──────────────────────────────────────────────────────

func NewWebCommand() *cobra.Command {
	var port string
	var public bool

	cmd := &cobra.Command{
		Use:   "web",
		Short: "Start The Clawd Bot web console (dashboard + REST API, default :18800)",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s🦞 The Clawd Bot Web Console%s\n", colorGreen, colorReset)
			fmt.Printf("%s  Dashboard → http://localhost:%s%s\n", colorTeal, port, colorReset)
			fmt.Printf("%s  Config:     %s%s\n\n", colorDim, config.DefaultConfigPath(), colorReset)

			webArgs := []string{"run", "./web/backend/", "-port", port}
			if public {
				webArgs = append(webArgs, "-public")
			}
			c := exec.Command("go", webArgs...)
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		},
	}
	cmd.Flags().StringVarP(&port, "port", "p", "18800", "Port to listen on")
	cmd.Flags().BoolVar(&public, "public", false, "Listen on 0.0.0.0 instead of localhost")
	return cmd
}

// ── Perps Command (Phoenix perpetual futures) ────────────────────────

func NewPerpsCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:          "perps",
		Aliases:      []string{"phoenix"},
		Short:        "Phoenix perpetual futures through Vulcan — paper, dry-run, live-ready",
		SilenceUsage: true,
		Long: `Phoenix perpetual futures command group.

Use this surface to inspect markets, fetch pricing/candle data, inspect
trader state, and trade through the official Vulcan CLI. Execution defaults
to paper mode, which uses live Phoenix prices without wallet signing.`,
		Example: strings.Join([]string{
			"  clawdbot perps quickstart",
			"  clawdbot perps markets",
			"  clawdbot perps price SOL",
			"  clawdbot perps candles SOL --tf 1h --limit 20",
			"  clawdbot perps paper init --balance 10000",
			"  clawdbot perps order market --symbol SOL --side buy --notional-usdc 25",
			"  clawdbot perps strategy twap --symbol SOL --side buy --notional-usdc 100 --slices 4 --detached",
			"  clawdbot perps preflight --wallet my-wallet",
		}, "\n"),
	}
	cmd.AddCommand(
		newPerpsQuickstartCmd(),
		newPerpsHealthCmd(),
		newPerpsMarketsCmd(),
		newPerpsPriceCmd(),
		newPerpsCandlesCmd(),
		newPerpsStateCmd(),
		newPerpsOrdersCmd(),
		newPerpsTradesCmd(),
		newPerpsPaperCmd(),
		newPerpsPreflightCmd(),
		newPerpsStrategyCmd(),
		newPerpsOrderCmd(),
	)
	silenceUsageTree(cmd)
	return cmd
}

func silenceUsageTree(cmd *cobra.Command) {
	cmd.SilenceUsage = true
	for _, child := range cmd.Commands() {
		silenceUsageTree(child)
	}
}

func newVulcanRunner(cfg *config.Config) *vulcan.Runner {
	timeout := time.Duration(cfg.Vulcan.TimeoutSeconds) * time.Second
	return vulcan.New(vulcan.Config{
		Binary:               cfg.Vulcan.Binary,
		DefaultMode:          cfg.Vulcan.DefaultMode,
		PaperBalance:         cfg.Vulcan.PaperBalance,
		Timeout:              timeout,
		MaxStepNotionalUSDC:  cfg.Vulcan.MaxStepNotionalUSDC,
		MaxTotalNotionalUSDC: cfg.Vulcan.MaxTotalNotionalUSDC,
		MaxPriceDriftBPS:     cfg.Vulcan.MaxPriceDriftBPS,
		MaxExposureRatio:     cfg.Vulcan.MaxExposureRatio,
		Wallet:               cfg.Vulcan.DefaultWallet,
	})
}

func writeVulcanResult(result *vulcan.Result) error {
	if len(result.JSON) > 0 {
		var v any
		if err := json.Unmarshal(result.JSON, &v); err == nil {
			return writeJSON(v)
		}
		fmt.Println(string(result.JSON))
		return nil
	}
	if result.Stdout != "" {
		fmt.Println(result.Stdout)
	}
	if result.Stderr != "" {
		fmt.Fprintln(os.Stderr, result.Stderr)
	}
	return nil
}

func runVulcanAndWrite(ctx context.Context, r *vulcan.Runner, args []string) error {
	result, err := r.Run(ctx, args)
	if result != nil {
		_ = writeVulcanResult(result)
	}
	return err
}

func requireVulcan(r *vulcan.Runner) error {
	path, err := r.LookPath()
	if err != nil {
		return fmt.Errorf("vulcan binary not found; install it with `curl -fsSL https://github.com/Ellipsis-Labs/vulcan-cli/releases/latest/download/install.sh | sh` or set VULCAN_BIN")
	}
	fmt.Printf("%s[VULCAN]%s %s\n", colorGreen, colorReset, path)
	return nil
}

// perps quickstart — out-of-box Vulcan paper setup and market smoke check
func newPerpsQuickstartCmd() *cobra.Command {
	var (
		symbol  string
		balance float64
	)
	cmd := &cobra.Command{
		Use:   "quickstart",
		Short: "Initialize Vulcan paper perps and run a safe market-data smoke check",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			if err := requireVulcan(r); err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			defer cancel()
			steps := [][]string{
				r.AgentHealthArgs(),
				r.PaperInitArgs(balance),
				r.MarketArgs("list", ""),
				r.MarketArgs("ticker", symbol),
			}
			for _, step := range steps {
				fmt.Printf("%s$ %s%s\n", colorDim, strings.Join(append([]string{r.Config().Binary}, step...), " "), colorReset)
				if err := runVulcanAndWrite(ctx, r, step); err != nil {
					return err
				}
			}
			fmt.Printf("%s[VULCAN]%s Paper perps are ready. Try: clawdbot perps order market --symbol %s --side buy --notional-usdc 25\n",
				colorGreen, colorReset, strings.ToUpper(symbol))
			return nil
		},
	}
	cmd.Flags().StringVar(&symbol, "symbol", "SOL", "Smoke-check market symbol")
	cmd.Flags().Float64Var(&balance, "balance", 10000, "Paper account balance")
	return cmd
}

// perps health — Vulcan binary, agent health, and status
func newPerpsHealthCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "health",
		Short: "Check Vulcan CLI, agent health, and Phoenix connectivity",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			if err := requireVulcan(r); err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			for _, step := range [][]string{r.AgentHealthArgs(), r.StatusArgs()} {
				fmt.Printf("%s$ %s%s\n", colorDim, strings.Join(append([]string{r.Config().Binary}, step...), " "), colorReset)
				if err := runVulcanAndWrite(ctx, r, step); err != nil {
					return err
				}
			}
			return nil
		},
	}
	return cmd
}

// perps markets — list all active markets
func newPerpsMarketsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "markets",
		Short: "List all Phoenix perp markets",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			cl := phoenix.NewClient(cfg.Solana.PhoenixAPIURL)
			markets, err := cl.ListMarkets(ctx)
			if err != nil {
				return err
			}
			fmt.Printf("%s%-8s %-12s %-10s %-10s %-6s%s\n",
				colorAmber, "SYMBOL", "STATUS", "TAKER FEE", "MAKER FEE", "ISO", colorReset)
			fmt.Println(strings.Repeat("─", 52))
			for _, m := range markets {
				iso := " "
				if m.IsolatedOnly {
					iso = "✓"
				}
				fmt.Printf("%-8s %-12s %-10.4f %-10.4f %-6s\n",
					m.Symbol, m.MarketStatus, m.TakerFee, m.MakerFee, iso)
			}
			fmt.Printf("\n%s%d markets%s\n", colorDim, len(markets), colorReset)
			return nil
		},
	}
}

// perps price [symbol] — mark price and funding rate from exchange snapshot
func newPerpsPriceCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "price [symbol]",
		Short: "Show mark price and funding rate (all markets or single symbol)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			cl := phoenix.NewClient(cfg.Solana.PhoenixAPIURL)
			snap, err := cl.GetSnapshot(ctx)
			if err != nil {
				return err
			}
			filter := ""
			if len(args) > 0 {
				filter = strings.ToUpper(args[0])
			}
			fmt.Printf("%s%-8s %-16s %-16s %-14s %-12s%s\n",
				colorAmber, "SYMBOL", "MARK PRICE", "INDEX PRICE", "FUNDING RATE", "OPEN INT.", colorReset)
			fmt.Println(strings.Repeat("─", 70))
			for _, m := range snap.Markets {
				if filter != "" && strings.ToUpper(m.Symbol) != filter {
					continue
				}
				fundingPct := m.FundingRate * 100
				fmt.Printf("%-8s $%-15.4f $%-15.4f %+.6f%%   %.2f\n",
					m.Symbol, m.MarkPrice, m.IndexPrice, fundingPct, m.OpenInterest)
			}
			fmt.Printf("\n%sSlot: %d%s\n", colorDim, snap.Slot, colorReset)
			return nil
		},
	}
}

// perps candles <symbol> [--tf 1h] [--limit 20]
func newPerpsCandlesCmd() *cobra.Command {
	var tf string
	var limit int

	cmd := &cobra.Command{
		Use:   "candles <symbol>",
		Short: "OHLCV candles for a perp market",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			cl := phoenix.NewClient(cfg.Solana.PhoenixAPIURL)
			candles, err := cl.GetCandles(ctx, strings.ToUpper(args[0]), tf, limit)
			if err != nil {
				return err
			}
			fmt.Printf("%s%s (%s) — %d candles%s\n", colorAmber, args[0], tf, len(candles), colorReset)
			fmt.Printf("%s%-24s %-12s %-12s %-12s %-12s %-12s%s\n",
				colorDim, "TIME", "OPEN", "HIGH", "LOW", "CLOSE", "VOLUME", colorReset)
			fmt.Println(strings.Repeat("─", 84))
			for _, c := range candles {
				t := time.UnixMilli(c.Time).UTC().Format("2006-01-02 15:04")
				vol := ""
				if c.Volume != nil {
					vol = fmt.Sprintf("%.4f", *c.Volume)
				}
				fmt.Printf("%-24s %-12.4f %-12.4f %-12.4f %-12.4f %-12s\n",
					t, c.Open, c.High, c.Low, c.Close, vol)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&tf, "tf", "1h", "Timeframe: 1m 5m 15m 1h 4h 1d")
	cmd.Flags().IntVar(&limit, "limit", 20, "Number of candles")
	return cmd
}

// perps state <authority> — trader account state (positions, PnL)
func newPerpsStateCmd() *cobra.Command {
	var pdaIndex int

	cmd := &cobra.Command{
		Use:   "state <authority>",
		Short: "Show trader account state: positions, PnL, margins",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			cl := phoenix.NewClient(cfg.Solana.PhoenixAPIURL)
			resp, err := cl.GetTraderState(ctx, args[0], pdaIndex)
			if err != nil {
				return err
			}
			for _, t := range resp.Traders {
				fmt.Printf("%s── Trader Account ──%s\n", colorTeal, colorReset)
				fmt.Printf("  Collateral:    $%.4f\n", t.Collateral)
				fmt.Printf("  Portfolio:     $%.4f\n", t.PortfolioValue)
				fmt.Printf("  Unrealized PnL:%s $%.4f%s\n", pnlColor(t.UnrealizedPnl), t.UnrealizedPnl, colorReset)
				fmt.Printf("  Init Margin:   $%.4f\n", t.InitialMargin)
				fmt.Printf("  Maint Margin:  $%.4f\n", t.MaintenanceMargin)
				fmt.Printf("  Risk State:    %s\n", t.RiskState)
				fmt.Printf("  Activity:      %s\n\n", t.ActivityState)

				if len(t.Positions) > 0 {
					fmt.Printf("%s── Open Positions ──%s\n", colorGreen, colorReset)
					fmt.Printf("%s%-8s %-12s %-12s %-12s %-12s %-12s%s\n",
						colorDim, "SYMBOL", "SIZE", "ENTRY", "MARK", "LIQ PRICE", "UNREAL PnL", colorReset)
					fmt.Println(strings.Repeat("─", 72))
					for _, p := range t.Positions {
						fmt.Printf("%-8s %-12s $%-11.4f $%-11.4f $%-11.4f %s$%.4f%s\n",
							p.Symbol, p.BaseLots, p.EntryPrice, p.MarkPrice, p.LiquidationPrice,
							pnlColor(p.UnrealizedPnl), p.UnrealizedPnl, colorReset)
					}
					fmt.Println()
				} else {
					fmt.Printf("%sNo open positions%s\n\n", colorDim, colorReset)
				}

				if len(t.LimitOrders) > 0 {
					fmt.Printf("%s── Open Orders ──%s\n", colorAmber, colorReset)
					fmt.Printf("%s%-8s %-6s %-12s %-12s%s\n",
						colorDim, "SYMBOL", "SIDE", "PRICE", "SIZE", colorReset)
					fmt.Println(strings.Repeat("─", 42))
					for _, o := range t.LimitOrders {
						fmt.Printf("%-8s %-6s $%-11.4f %-12s\n",
							o.Symbol, o.Side, o.Price, o.BaseLots)
					}
				}
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&pdaIndex, "pda-index", 0, "Trader PDA index")
	return cmd
}

// perps orders <authority> [--symbol SOL] [--limit 20]
func newPerpsOrdersCmd() *cobra.Command {
	var symbol string
	var limit int

	cmd := &cobra.Command{
		Use:   "orders <authority>",
		Short: "Order history for a trader account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			cl := phoenix.NewClient(cfg.Solana.PhoenixAPIURL)
			resp, err := cl.GetOrderHistory(ctx, args[0], symbol, limit, "")
			if err != nil {
				return err
			}
			fmt.Printf("%s%-8s %-8s %-10s %-12s %-12s %-12s %-10s%s\n",
				colorAmber, "SYMBOL", "SIDE", "STATUS", "PRICE", "QTY", "FILLED", "PLACED AT", colorReset)
			fmt.Println(strings.Repeat("─", 80))
			for _, o := range resp.Data {
				placed := ""
				if o.PlacedAt != nil {
					placed = *o.PlacedAt
					if len(placed) > 16 {
						placed = placed[:16]
					}
				}
				fmt.Printf("%-8s %-8s %-10s $%-11.4f %-12s %-12s %-10s\n",
					o.MarketSymbol, o.Side, o.Status, o.Price, o.BaseQty, o.FilledBaseQty, placed)
			}
			if resp.HasMore {
				fmt.Printf("\n%s... more results available%s\n", colorDim, colorReset)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&symbol, "symbol", "", "Filter by market symbol (e.g. SOL)")
	cmd.Flags().IntVar(&limit, "limit", 20, "Number of orders to return")
	return cmd
}

// perps trades <authority> [--symbol SOL] [--limit 20]
func newPerpsTradesCmd() *cobra.Command {
	var symbol string
	var limit int

	cmd := &cobra.Command{
		Use:   "trades <authority>",
		Short: "Trade history for a trader account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			cl := phoenix.NewClient(cfg.Solana.PhoenixAPIURL)
			resp, err := cl.GetTradeHistory(ctx, args[0], symbol, limit, "")
			if err != nil {
				return err
			}
			fmt.Printf("%s%-8s %-20s %-12s %-12s %-12s %-8s %-8s%s\n",
				colorAmber, "SYMBOL", "TIME", "PRICE", "DELTA", "REAL PnL", "TYPE", "LIQ.", colorReset)
			fmt.Println(strings.Repeat("─", 84))
			for _, t := range resp.Data {
				ts := t.Timestamp
				if len(ts) > 19 {
					ts = ts[:19]
				}
				sig := ""
				if t.Signature != nil {
					sig = (*t.Signature)[:8] + "…"
				}
				_ = sig
				fmt.Printf("%-8s %-20s %-12s %-12s %s%-12s%s %-8s %-8s\n",
					t.MarketSymbol, ts, t.Price, t.BaseLotsDelta,
					pnlColorStr(t.RealizedPnl), t.RealizedPnl, colorReset,
					t.TradeType, t.Liquidity)
			}
			if resp.HasMore {
				fmt.Printf("\n%s... more results available%s\n", colorDim, colorReset)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&symbol, "symbol", "", "Filter by market symbol")
	cmd.Flags().IntVar(&limit, "limit", 20, "Number of trades to return")
	return cmd
}

// perps paper — local paper trading against live Phoenix prices
func newPerpsPaperCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "paper",
		Short: "Manage Vulcan paper perps state",
	}
	cmd.AddCommand(newPerpsPaperInitCmd(), newPerpsPaperPassthroughCmd("status"), newPerpsPaperPassthroughCmd("positions"), newPerpsPaperPassthroughCmd("orders"), newPerpsPaperPassthroughCmd("fills"))
	return cmd
}

func newPerpsPaperInitCmd() *cobra.Command {
	var balance float64
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize or reset the Vulcan paper account",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			return runVulcanAndWrite(ctx, r, r.PaperInitArgs(balance))
		},
	}
	cmd.Flags().Float64Var(&balance, "balance", 10000, "Paper account balance")
	return cmd
}

func newPerpsPaperPassthroughCmd(name string) *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   name,
		Short: "Run `vulcan paper " + name + " -o json`",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			vargs := []string{"paper", name, "-o", "json"}
			if name == "fills" && limit > 0 {
				vargs = []string{"paper", name, "--limit", strconv.Itoa(limit), "-o", "json"}
			}
			return runVulcanAndWrite(ctx, r, vargs)
		},
	}
	if name == "fills" {
		cmd.Flags().IntVar(&limit, "limit", 50, "Number of fills")
	}
	return cmd
}

// perps preflight — Vulcan live readiness
func newPerpsPreflightCmd() *cobra.Command {
	var wallet string
	cmd := &cobra.Command{
		Use:   "preflight",
		Short: "Run Vulcan live-readiness preflight for a wallet",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			if wallet == "" {
				wallet = cfg.Vulcan.DefaultWallet
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return runVulcanAndWrite(ctx, r, r.StrategyPreflightArgs(wallet))
		},
	}
	cmd.Flags().StringVar(&wallet, "wallet", "", "Vulcan wallet name")
	return cmd
}

// perps strategy — first-class Vulcan strategy runners
func newPerpsStrategyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "strategy",
		Short: "Run Vulcan TWAP and grid strategies with guardrails",
	}
	cmd.AddCommand(newPerpsTWAPCmd(), newPerpsGridCmd())
	return cmd
}

func newPerpsTWAPCmd() *cobra.Command {
	var spec vulcan.TWAPSpec
	cmd := &cobra.Command{
		Use:   "twap",
		Short: "Start a Vulcan TWAP strategy, defaulting to paper mode",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			if spec.Wallet == "" {
				spec.Wallet = cfg.Vulcan.DefaultWallet
			}
			vargs, err := r.TWAPArgs(spec)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return runVulcanAndWrite(ctx, r, vargs)
		},
	}
	cmd.Flags().StringVar(&spec.Mode, "mode", "paper", "Execution mode: paper, dry-run, confirm-each, auto-execute")
	cmd.Flags().StringVar(&spec.Symbol, "symbol", "SOL", "Market symbol")
	cmd.Flags().StringVar(&spec.Side, "side", "", "Side: buy or sell")
	cmd.Flags().Float64Var(&spec.NotionalUSDC, "notional-usdc", 0, "Total notional in USDC")
	cmd.Flags().Float64Var(&spec.Tokens, "tokens", 0, "Total base tokens")
	cmd.Flags().IntVar(&spec.Slices, "slices", 0, "TWAP slices")
	cmd.Flags().IntVar(&spec.IntervalSeconds, "interval-seconds", 60, "Seconds between slices")
	cmd.Flags().StringVar(&spec.MarginMode, "margin-mode", "cross", "Margin mode: cross or isolated")
	cmd.Flags().Float64Var(&spec.IsolatedCollateral, "isolated-collateral", 0, "USDC collateral for isolated margin")
	cmd.Flags().StringVar(&spec.RunLabel, "run-label", "", "Human-readable run label")
	cmd.Flags().BoolVar(&spec.Detached, "detached", false, "Start in background and return run id")
	cmd.Flags().BoolVar(&spec.Yes, "yes", false, "Required acknowledgement for live modes")
	cmd.Flags().StringVar(&spec.Wallet, "wallet", "", "Vulcan wallet name for live modes")
	cmd.Flags().Float64Var(&spec.MaxStepNotionalUSDC, "max-step-notional-usdc", 0, "Per-step live notional cap")
	cmd.Flags().Float64Var(&spec.MaxTotalNotionalUSDC, "max-total-notional-usdc", 0, "Total live notional cap")
	cmd.Flags().IntVar(&spec.MaxPriceDriftBPS, "max-price-drift-bps", 0, "Pause if mark drifts this many bps")
	cmd.Flags().Float64Var(&spec.MaxExposureRatio, "max-exposure-ratio", 0, "Position notional/equity exposure cap")
	_ = cmd.MarkFlagRequired("side")
	_ = cmd.MarkFlagRequired("slices")
	return cmd
}

func newPerpsGridCmd() *cobra.Command {
	var spec vulcan.GridSpec
	cmd := &cobra.Command{
		Use:   "grid",
		Short: "Start a Vulcan grid strategy, defaulting to paper mode",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			if spec.Wallet == "" {
				spec.Wallet = cfg.Vulcan.DefaultWallet
			}
			vargs, err := r.GridArgs(spec)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return runVulcanAndWrite(ctx, r, vargs)
		},
	}
	cmd.Flags().StringVar(&spec.Mode, "mode", "paper", "Execution mode: paper, dry-run, confirm-each, auto-execute")
	cmd.Flags().StringVar(&spec.Symbol, "symbol", "SOL", "Market symbol")
	cmd.Flags().BoolVar(&spec.CenterOnMark, "center-on-mark", true, "Center the grid on current mark")
	cmd.Flags().Float64Var(&spec.WidthPct, "width-pct", 2.5, "Half-width percentage around mark")
	cmd.Flags().Float64Var(&spec.LowerPrice, "lower-price", 0, "Explicit lower boundary")
	cmd.Flags().Float64Var(&spec.UpperPrice, "upper-price", 0, "Explicit upper boundary")
	cmd.Flags().IntVar(&spec.LevelsPerSide, "levels-per-side", 0, "Grid levels per side")
	cmd.Flags().Float64Var(&spec.TokensPerLevel, "tokens-per-level", 0, "Base tokens per level")
	cmd.Flags().Float64Var(&spec.SizeLotsPerLevel, "size-lots-per-level", 0, "Base lots per level")
	cmd.Flags().IntVar(&spec.IntervalSeconds, "interval-seconds", 60, "Seconds between ticks")
	cmd.Flags().IntVar(&spec.Ticks, "ticks", 60, "Maximum ticks")
	cmd.Flags().BoolVar(&spec.RunUntilStopped, "run-until-stopped", false, "Run until stopped")
	cmd.Flags().StringVar(&spec.RunLabel, "run-label", "", "Human-readable run label")
	cmd.Flags().BoolVar(&spec.Detached, "detached", false, "Start in background and return run id")
	cmd.Flags().BoolVar(&spec.Yes, "yes", false, "Required acknowledgement for live modes")
	cmd.Flags().StringVar(&spec.Wallet, "wallet", "", "Vulcan wallet name for live modes")
	cmd.Flags().Float64Var(&spec.MaxStepNotionalUSDC, "max-step-notional-usdc", 0, "Per-step live notional cap")
	cmd.Flags().Float64Var(&spec.MaxTotalNotionalUSDC, "max-total-notional-usdc", 0, "Total live notional cap")
	cmd.Flags().IntVar(&spec.MaxPriceDriftBPS, "max-price-drift-bps", 0, "Pause if mark drifts this many bps")
	cmd.Flags().Float64Var(&spec.MaxExposureRatio, "max-exposure-ratio", 0, "Position notional/equity exposure cap")
	_ = cmd.MarkFlagRequired("levels-per-side")
	return cmd
}

// perps order market|limit — place one-shot orders through Vulcan
func newPerpsOrderCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "order",
		Short: "Place a market or limit order through Vulcan, defaulting to paper mode",
	}
	cmd.AddCommand(newPerpsMarketOrderCmd(), newPerpsLimitOrderCmd())
	return cmd
}

func newPerpsMarketOrderCmd() *cobra.Command {
	var spec vulcan.OrderSpec

	cmd := &cobra.Command{
		Use:   "market",
		Short: "Place a market order through Vulcan",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			spec.OrderType = "market"
			if spec.Wallet == "" {
				spec.Wallet = cfg.Vulcan.DefaultWallet
			}
			vargs, err := r.OrderArgs(spec)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return runVulcanAndWrite(ctx, r, vargs)
		},
	}
	addVulcanOrderFlags(cmd, &spec)
	_ = cmd.MarkFlagRequired("side")
	return cmd
}

func newPerpsLimitOrderCmd() *cobra.Command {
	var spec vulcan.OrderSpec

	cmd := &cobra.Command{
		Use:   "limit",
		Short: "Place a limit order through Vulcan",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			r := newVulcanRunner(cfg)
			spec.OrderType = "limit"
			if spec.Wallet == "" {
				spec.Wallet = cfg.Vulcan.DefaultWallet
			}
			vargs, err := r.OrderArgs(spec)
			if err != nil {
				return err
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return runVulcanAndWrite(ctx, r, vargs)
		},
	}
	addVulcanOrderFlags(cmd, &spec)
	_ = cmd.MarkFlagRequired("side")
	_ = cmd.MarkFlagRequired("price")
	return cmd
}

func addVulcanOrderFlags(cmd *cobra.Command, spec *vulcan.OrderSpec) {
	cmd.Flags().StringVar(&spec.Mode, "mode", "paper", "Execution mode: paper, dry-run, live")
	cmd.Flags().StringVar(&spec.Symbol, "symbol", "SOL", "Market symbol")
	cmd.Flags().StringVar(&spec.Side, "side", "", "Order side: buy or sell")
	cmd.Flags().Float64Var(&spec.Size, "size", 0, "Order size in base lots")
	cmd.Flags().Float64Var(&spec.Tokens, "tokens", 0, "Order size in base tokens")
	cmd.Flags().Float64Var(&spec.Tokens, "qty", 0, "Alias for --tokens")
	cmd.Flags().Float64Var(&spec.NotionalUSDC, "notional-usdc", 0, "Order notional in USDC")
	cmd.Flags().Float64Var(&spec.Price, "price", 0, "Limit price in USDC")
	cmd.Flags().Float64Var(&spec.TP, "tp", 0, "Take-profit price")
	cmd.Flags().Float64Var(&spec.SL, "sl", 0, "Stop-loss price")
	cmd.Flags().BoolVar(&spec.Isolated, "isolated", false, "Use isolated margin for live orders")
	cmd.Flags().Float64Var(&spec.Collateral, "collateral", 0, "Isolated collateral in USDC")
	cmd.Flags().BoolVar(&spec.ReduceOnly, "reduce-only", false, "Reduce position only")
	cmd.Flags().BoolVar(&spec.Yes, "yes", false, "Required acknowledgement for live mode")
	cmd.Flags().StringVar(&spec.Wallet, "wallet", "", "Vulcan wallet name for live mode")
}

// pnlColor returns the ANSI color for a PnL value.
func pnlColor(v float64) string {
	if v >= 0 {
		return colorGreen
	}
	return colorRed
}

func pnlColorStr(s string) string {
	if len(s) > 0 && s[0] == '-' {
		return colorRed
	}
	return colorGreen
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

func main() {
	if shouldPrintBanner(os.Args[1:]) {
		fmt.Print(banner)
	}
	cmd := NewClawdBotCommand()
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func shouldPrintBanner(args []string) bool {
	for _, arg := range args {
		if arg == "--json" || strings.HasPrefix(arg, "--json=") {
			return false
		}
	}
	return true
}
