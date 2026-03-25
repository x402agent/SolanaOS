package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/x402agent/Solana-Os-Go/pkg/blockchain"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/honcho"
	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

func NewMemoryCommand() *cobra.Command {
	var peerID string
	var channelID string

	cmd := &cobra.Command{
		Use:   "memory",
		Short: "Honcho-backed SolanaOS memory tools",
	}

	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Show memory, Hub, and API connectivity status",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			fmt.Printf("%s🧠 SolanaOS Memory%s\n\n", colorGreen, colorReset)
			fmt.Printf("  %sHoncho Enabled:%s  %s\n", colorDim, colorReset, boolLabel(cfg.Honcho.Enabled))
			fmt.Printf("  %sWorkspace:%s       %s\n", colorDim, colorReset, cfg.Honcho.WorkspaceID)
			fmt.Printf("  %sAgent Peer:%s      %s\n", colorDim, colorReset, cfg.Honcho.AgentPeerID)
			fmt.Printf("  %sReasoning:%s       %s\n", colorDim, colorReset, cfg.Honcho.ReasoningLevel)
			fmt.Printf("  %sStrategy:%s        %s\n", colorDim, colorReset, cfg.Honcho.SessionStrategy)
			fmt.Printf("  %sContext Tokens:%s  %d\n", colorDim, colorReset, cfg.Honcho.ContextTokens)
			fmt.Printf("  %sBase URL:%s        %s\n", colorDim, colorReset, cfg.Honcho.BaseURL)

			fmt.Printf("\n%s🌐 SolanaOS Surfaces%s\n\n", colorTeal, colorReset)
			fmt.Printf("  %sLaunch:%s          %s\n", colorDim, colorReset, envOrValue("SOLANAOS_LAUNCH_URL", "https://solanaos.net"))
			fmt.Printf("  %sHub:%s             %s\n", colorDim, colorReset, envOrValue("SOLANAOS_HUB_URL", "https://seeker.solanaos.net"))
			fmt.Printf("  %sSouls:%s           %s\n", colorDim, colorReset, envOrValue("SOLANAOS_SOULS_URL", "https://souls.solanaos.net"))
			fmt.Printf("  %sControl API:%s     %s\n", colorDim, colorReset, envOrValue("SOLANAOS_CONTROL_API_URL", "http://127.0.0.1:7777"))
			fmt.Printf("  %sGateway:%s         %s\n", colorDim, colorReset, resolveGatewaySetupURL(cfg, ""))
			fmt.Printf("  %sWeb:%s             %s\n", colorDim, colorReset, envOrValue("SOLANAOS_WEB_URL", "http://127.0.0.1:18800"))

			skillsDir := discoverRepoPath("skills")
			nanohubDir := discoverRepoPath("nanohub")
			if skillsDir != "" || nanohubDir != "" {
				fmt.Printf("\n%s📁 Repo Surfaces%s\n\n", colorAmber, colorReset)
				if skillsDir != "" {
					fmt.Printf("  %sSkills:%s          %s\n", colorDim, colorReset, skillsDir)
				}
				if nanohubDir != "" {
					fmt.Printf("  %sNanoHub:%s         %s\n", colorDim, colorReset, nanohubDir)
				}
			}
			return nil
		},
	}

	recallCmd := &cobra.Command{
		Use:   "recall <query>",
		Short: "Query Honcho memory about an operator peer",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			vault, err := newHonchoVault(cfg)
			if err != nil {
				return err
			}
			answer, err := vault.Recall(cmd.Context(), peerID, strings.Join(args, " "))
			if err != nil {
				return err
			}
			fmt.Printf("%s🔎 Recall%s\n\n%s\n", colorGreen, colorReset, strings.TrimSpace(answer))
			return nil
		},
	}
	recallCmd.Flags().StringVar(&peerID, "peer", "operator", "Peer ID to query")

	rememberCmd := &cobra.Command{
		Use:   "remember <fact>",
		Short: "Store a durable fact in Honcho memory",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			vault, err := newHonchoVault(cfg)
			if err != nil {
				return err
			}
			session, err := vault.EnsureSession(cmd.Context(), memory.ChannelCLI, channelID, peerID)
			if err != nil {
				return err
			}
			fact := strings.Join(args, " ")
			if err := vault.StoreUserMessage(cmd.Context(), session, fact, map[string]any{
				"source":     "solanaos-cli",
				"intent":     "remember",
				"channel_id": channelID,
			}); err != nil {
				return err
			}
			fmt.Printf("%s✅ Saved to memory%s\n  peer=%s\n  session=%s\n", colorGreen, colorReset, session.PeerID, session.SessionID)
			return nil
		},
	}
	rememberCmd.Flags().StringVar(&peerID, "peer", "operator", "Peer ID to associate with the memory")
	rememberCmd.Flags().StringVar(&channelID, "channel-id", "solanaos-cli", "Logical CLI channel/session ID")

	profileCmd := &cobra.Command{
		Use:   "profile",
		Short: "Generate a synthesized Honcho operator profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			vault, err := newHonchoVault(cfg)
			if err != nil {
				return err
			}
			profile, err := vault.GetOperatorProfile(cmd.Context(), peerID)
			if err != nil {
				return err
			}
			fmt.Printf("%s👤 Operator Profile%s\n\n%s\n", colorGreen, colorReset, strings.TrimSpace(profile))
			return nil
		},
	}
	profileCmd.Flags().StringVar(&peerID, "peer", "operator", "Peer ID to profile")

	cmd.AddCommand(statusCmd, recallCmd, rememberCmd, profileCmd)
	return cmd
}

func newSolanaPortfolioCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "portfolio [address]",
		Short: "Show wallet portfolio with USD values",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			address := strings.TrimSpace(cfg.Solana.WalletPubkey)
			if len(args) > 0 {
				address = strings.TrimSpace(args[0])
			}
			if address == "" {
				return fmt.Errorf("no wallet address configured")
			}

			client := newBlockchainClient(cfg, nil)
			portfolio, err := client.GetWalletPortfolio(cmd.Context(), address)
			if err != nil {
				return err
			}

			fmt.Printf("%s💼 Portfolio%s\n\n", colorGreen, colorReset)
			fmt.Printf("  %sAddress:%s  %s\n", colorDim, colorReset, portfolio.Address)
			fmt.Printf("  %sSOL:%s      %.4f ($%.2f)\n", colorDim, colorReset, portfolio.SOLBalance, portfolio.SOLValueUSD)
			fmt.Printf("  %sNFTs:%s     %d\n", colorDim, colorReset, portfolio.NFTCount)
			fmt.Printf("  %sTotal:%s    $%.2f\n", colorDim, colorReset, portfolio.TotalUSD)
			if len(portfolio.Tokens) > 0 {
				fmt.Printf("\n%sTop Tokens%s\n", colorTeal, colorReset)
				limit := 8
				if len(portfolio.Tokens) < limit {
					limit = len(portfolio.Tokens)
				}
				for _, token := range portfolio.Tokens[:limit] {
					label := token.Symbol
					if strings.TrimSpace(label) == "" {
						label = token.Mint
					}
					fmt.Printf("  %-12s %10.4f  $%8.2f\n", label, token.Amount, token.ValueUSD)
				}
			}
			return nil
		},
	}
}

func newSolanaStatsCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "stats",
		Short: "Show live Solana network stats with price context",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			client := newBlockchainClient(cfg, nil)
			stats, err := client.GetNetworkStats(cmd.Context())
			if err != nil {
				return err
			}

			fmt.Printf("%s📡 Network Stats%s\n\n", colorGreen, colorReset)
			fmt.Printf("  %sSlot:%s      %d\n", colorDim, colorReset, stats.CurrentSlot)
			fmt.Printf("  %sEpoch:%s     %d\n", colorDim, colorReset, stats.Epoch)
			fmt.Printf("  %sTPS:%s       %.2f\n", colorDim, colorReset, stats.TPS)
			fmt.Printf("  %sSOL:%s       $%.4f\n", colorDim, colorReset, stats.SOLPriceUSD)
			return nil
		},
	}
}

func newSolanaPriceCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "price <mint-or-symbol>",
		Short: "Lookup a token price by mint or symbol",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _ := config.Load()
			client := newBlockchainClient(cfg, nil)
			price, err := client.GetPrice(cmd.Context(), args[0])
			if err != nil {
				return err
			}
			fmt.Printf("%s💲 Price%s\n\n", colorGreen, colorReset)
			fmt.Printf("  %sSymbol:%s  %s\n", colorDim, colorReset, price.Symbol)
			fmt.Printf("  %sMint:%s    %s\n", colorDim, colorReset, price.Mint)
			fmt.Printf("  %sUSD:%s     $%.8f\n", colorDim, colorReset, price.PriceUSD)
			fmt.Printf("  %sSource:%s  %s\n", colorDim, colorReset, price.Source)
			return nil
		},
	}
}

func runSolanaResearch(ctx context.Context, mint string) error {
	cfg, _ := config.Load()
	client := newBlockchainClient(cfg, nil)
	research, err := client.ResearchToken(ctx, mint)
	if err != nil {
		return err
	}

	fmt.Printf("%s🔬 Token Research%s\n\n", colorGreen, colorReset)
	fmt.Printf("  %sToken:%s      %s (%s)\n", colorDim, colorReset, research.Name, research.Symbol)
	fmt.Printf("  %sMint:%s       %s\n", colorDim, colorReset, research.Mint)
	fmt.Printf("  %sPrice:%s      $%.8f\n", colorDim, colorReset, research.PriceUSD)
	fmt.Printf("  %sSupply:%s     %.2f\n", colorDim, colorReset, research.TotalSupply)
	fmt.Printf("  %sRisk:%s       %.2f\n", colorDim, colorReset, research.RiskScore)
	if len(research.RiskFlags) > 0 {
		fmt.Printf("\n%sRisk Flags%s\n", colorAmber, colorReset)
		for _, flag := range research.RiskFlags {
			fmt.Printf("  - %s\n", flag)
		}
	}
	if len(research.TopHolders) > 0 {
		fmt.Printf("\n%sTop Holders%s\n", colorTeal, colorReset)
		limit := 5
		if len(research.TopHolders) < limit {
			limit = len(research.TopHolders)
		}
		for _, holder := range research.TopHolders[:limit] {
			fmt.Printf("  %s  %.2f%%\n", holder.Address, holder.Percentage)
		}
	}
	return nil
}

func runSolanaTrending(ctx context.Context) error {
	cfg, _ := config.Load()
	client := newBlockchainClient(cfg, nil)
	tokens, err := client.GetTrending(ctx, 10)
	if err != nil {
		return err
	}

	fmt.Printf("%s🌐 Trending Tokens%s\n\n", colorGreen, colorReset)
	for i, token := range tokens {
		label := token.Symbol
		if strings.TrimSpace(label) == "" {
			label = token.Name
		}
		fmt.Printf("  %2d. %-12s $%.8f  vol=$%.0f  liq=$%.0f\n",
			i+1, label, token.PriceUSD, token.Volume24h, token.Liquidity)
	}
	return nil
}

func newBlockchainClient(cfg *config.Config, vault memory.Vault) *blockchain.Client {
	trackerKey := strings.TrimSpace(cfg.Solana.SolanaTrackerDataAPIKey)
	if trackerKey == "" {
		trackerKey = strings.TrimSpace(cfg.Solana.SolanaTrackerAPIKey)
	}
	if trackerKey == "" {
		trackerKey = strings.TrimSpace(cfg.Solana.HeliusAPIKey)
	}

	trackerRPC := strings.TrimSpace(cfg.Solana.SolanaTrackerRPCURL)
	if trackerRPC == "" {
		trackerRPC = strings.TrimSpace(cfg.Solana.HeliusRPCURL)
	}
	heliusRPC := strings.TrimSpace(cfg.Solana.HeliusRPCURL)
	if heliusRPC == "" {
		heliusRPC = trackerRPC
	}

	return blockchain.NewClient(
		trackerKey,
		trackerRPC,
		strings.TrimSpace(cfg.Solana.HeliusAPIKey),
		heliusRPC,
		vault,
		newCLILogger(),
	)
}

func newHonchoVault(cfg *config.Config) (memory.Vault, error) {
	if cfg == nil || !cfg.Honcho.Enabled {
		return nil, fmt.Errorf("honcho is disabled; set HONCHO_ENABLED=true and HONCHO_API_KEY")
	}
	client := honcho.NewClient(cfg.Honcho)
	return memory.NewHonchoVault(client, cfg.Honcho.AgentPeerID, cfg.Honcho.ReasoningLevel, cfg.Honcho.ContextTokens), nil
}

func newCLILogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func discoverRepoPath(name string) string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	candidates := []string{
		filepath.Join(cwd, name),
		filepath.Join(filepath.Dir(cwd), name),
		filepath.Join(filepath.Dir(filepath.Dir(cwd)), name),
	}
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			return candidate
		}
	}
	return ""
}

func envOrValue(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func boolLabel(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}
