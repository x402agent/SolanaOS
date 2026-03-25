package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// ── Config Structure ─────────────────────────────────────────────────
// Mirrors PicoClaw config format + SolanaOS extensions.

type Config struct {
	Agents    AgentsConfig    `json:"agents"`
	ModelList []ModelEntry    `json:"model_list"`
	Channels  ChannelsConfig  `json:"channels"`
	Providers ProvidersConfig `json:"providers"`
	Tools     ToolsConfig     `json:"tools"`
	Heartbeat HeartbeatConfig `json:"heartbeat"`
	Gateway   GatewayConfig   `json:"gateway"`

	// SolanaOS-specific
	Solana      SolanaConfig        `json:"solana"`
	OODA        OODAConfig          `json:"ooda"`
	Supabase    SupabaseConfig      `json:"supabase"`
	Convex      ConvexConfig        `json:"convex"`
	Learning    LearningConfig      `json:"learning"`
	Honcho      HonchoConfig        `json:"honcho"`
	Automations AutomationsConfig   `json:"automations"`
	Runtime     RuntimeConfig       `json:"runtime"`
	Delegation  DelegationConfig    `json:"delegation"`
	Research    ResearchReadyConfig `json:"research"`
	X402        X402Config          `json:"x402"`
	Strategy    StrategyConfig      `json:"strategy"`
	Bitaxe      BitaxeConfig        `json:"bitaxe"`
	Hyperliquid HyperliquidConfig   `json:"hyperliquid"`
	PumpLaunch  PumpLaunchConfig    `json:"pump_launch"`
	Registry    AgentRegistryConfig `json:"agent_registry"`
	Pinata      PinataHubConfig     `json:"pinata"`

	// Node + Gateway
	Node         NodeClientConfig   `json:"node"`
	GatewaySpawn GatewaySpawnConfig `json:"gateway_spawn"`
}

// ── Agent Defaults ───────────────────────────────────────────────────

type AgentsConfig struct {
	Defaults AgentDefaults `json:"defaults"`
}

type AgentDefaults struct {
	Workspace           string  `json:"workspace"`
	RestrictToWorkspace bool    `json:"restrict_to_workspace"`
	ModelName           string  `json:"model_name"`
	MaxTokens           int     `json:"max_tokens"`
	Temperature         float64 `json:"temperature"`
	MaxToolIterations   int     `json:"max_tool_iterations"`
}

// ── Model List (PicoClaw-compatible) ─────────────────────────────────

type ModelEntry struct {
	ModelName      string `json:"model_name"`
	Model          string `json:"model"` // vendor/model format
	APIKey         string `json:"api_key"`
	APIBase        string `json:"api_base,omitempty"`
	RequestTimeout int    `json:"request_timeout,omitempty"`
	ThinkingLevel  string `json:"thinking_level,omitempty"`
	AuthMethod     string `json:"auth_method,omitempty"`
}

// ── Channels ─────────────────────────────────────────────────────────

type ChannelsConfig struct {
	Telegram TelegramChannel `json:"telegram"`
	Discord  DiscordChannel  `json:"discord"`
	X        XChannel        `json:"x"`
}

type TelegramChannel struct {
	Enabled   bool     `json:"enabled"`
	Token     string   `json:"token"`
	AllowFrom []string `json:"allow_from"`
	Proxy     string   `json:"proxy,omitempty"`
	BaseURL   string   `json:"base_url,omitempty"`
}

type DiscordChannel struct {
	Enabled   bool     `json:"enabled"`
	Token     string   `json:"token"`
	AllowFrom []string `json:"allow_from"`
}

type XChannel struct {
	Enabled           bool     `json:"enabled"`
	ConsumerKey       string   `json:"consumer_key"`
	ConsumerSecret    string   `json:"consumer_secret"`
	BearerToken       string   `json:"bearer_token"`
	AccessToken       string   `json:"access_token"`
	AccessTokenSecret string   `json:"access_token_secret"`
	ClientID          string   `json:"client_id"`
	ClientSecret      string   `json:"client_secret"`
	Handle            string   `json:"handle"`
	AllowFrom         []string `json:"allow_from"`
	APIBase           string   `json:"api_base,omitempty"`
	PollIntervalSec   int      `json:"poll_interval_sec,omitempty"`
}

// ── Providers (legacy compat) ────────────────────────────────────────

type ProvidersConfig struct {
	OpenRouter ProviderEntry `json:"openrouter"`
	Anthropic  ProviderEntry `json:"anthropic"`
	OpenAI     ProviderEntry `json:"openai"`
	Groq       ProviderEntry `json:"groq"`
	Ollama     ProviderEntry `json:"ollama"`
	NVIDIA     ProviderEntry `json:"nvidia"`
}

type ProviderEntry struct {
	APIKey  string `json:"api_key"`
	APIBase string `json:"api_base"`
}

// ── Tools ────────────────────────────────────────────────────────────

type ToolsConfig struct {
	Web        WebToolsConfig       `json:"web"`
	Cron       CronToolsConfig      `json:"cron"`
	Exec       ExecToolConfig       `json:"exec"`
	BrowserUse BrowserUseToolConfig `json:"browser_use"`
}

type WebToolsConfig struct {
	DuckDuckGo DDGConfig    `json:"duckduckgo"`
	Brave      BraveConfig  `json:"brave"`
	Tavily     TavilyConfig `json:"tavily"`
}

type DDGConfig struct {
	Enabled    bool `json:"enabled"`
	MaxResults int  `json:"max_results"`
}

type BraveConfig struct {
	Enabled    bool   `json:"enabled"`
	APIKey     string `json:"api_key"`
	MaxResults int    `json:"max_results"`
}

type TavilyConfig struct {
	Enabled    bool   `json:"enabled"`
	APIKey     string `json:"api_key"`
	MaxResults int    `json:"max_results"`
}

type CronToolsConfig struct {
	Enabled            bool `json:"enabled"`
	ExecTimeoutMinutes int  `json:"exec_timeout_minutes"`
}

type ExecToolConfig struct {
	Enabled bool `json:"enabled"`
}

type BrowserUseToolConfig struct {
	Enabled               bool   `json:"enabled"`
	APIKey                string `json:"api_key,omitempty"`
	BinaryPath            string `json:"binary_path,omitempty"`
	Home                  string `json:"home,omitempty"`
	Session               string `json:"session,omitempty"`
	Profile               string `json:"profile,omitempty"`
	Headed                bool   `json:"headed"`
	Cloud                 bool   `json:"cloud"`
	CloudProvider         string `json:"cloud_provider,omitempty"`
	Connect               bool   `json:"connect"`
	CDPURL                string `json:"cdp_url,omitempty"`
	CloudProfileID        string `json:"cloud_profile_id,omitempty"`
	CloudProxyCountryCode string `json:"cloud_proxy_country_code,omitempty"`
	CloudTimeoutMinutes   int    `json:"cloud_timeout_minutes,omitempty"`
	BrowserbaseAPIKey     string `json:"browserbase_api_key,omitempty"`
	BrowserbaseProjectID  string `json:"browserbase_project_id,omitempty"`
	BrowserbaseProxies    bool   `json:"browserbase_proxies"`
	BrowserbaseStealth    bool   `json:"browserbase_advanced_stealth"`
	BrowserbaseKeepAlive  bool   `json:"browserbase_keep_alive"`
	BrowserbaseTimeoutMS  int    `json:"browserbase_timeout_ms,omitempty"`
}

// ── Heartbeat ────────────────────────────────────────────────────────

type HeartbeatConfig struct {
	Enabled  bool `json:"enabled"`
	Interval int  `json:"interval"` // minutes
}

// ── Gateway ──────────────────────────────────────────────────────────

type GatewayConfig struct {
	Host      string                 `json:"host"`
	Port      int                    `json:"port"`
	Bind      string                 `json:"bind"`
	Auth      GatewayAuthConfig      `json:"auth"`
	Remote    GatewayRemoteConfig    `json:"remote"`
	Tailscale GatewayTailscaleConfig `json:"tailscale"`
}

type GatewayAuthConfig struct {
	Mode           string `json:"mode"`
	Token          string `json:"token,omitempty"`
	Password       string `json:"password,omitempty"`
	AllowTailscale bool   `json:"allow_tailscale"`
}

type GatewayTailscaleConfig struct {
	Mode        string `json:"mode"`
	ResetOnExit bool   `json:"reset_on_exit"`
}

type GatewayRemoteConfig struct {
	Mode           string           `json:"mode"`
	URL            string           `json:"url,omitempty"`
	Token          string           `json:"token,omitempty"`
	Password       string           `json:"password,omitempty"`
	TLSFingerprint string           `json:"tls_fingerprint,omitempty"`
	SSH            GatewaySSHConfig `json:"ssh"`
}

type GatewaySSHConfig struct {
	Alias            string `json:"alias,omitempty"`
	Host             string `json:"host,omitempty"`
	User             string `json:"user,omitempty"`
	IdentityFile     string `json:"identity_file,omitempty"`
	LocalPort        int    `json:"local_port,omitempty"`
	RemotePort       int    `json:"remote_port,omitempty"`
	RemoteBindHost   string `json:"remote_bind_host,omitempty"`
	LaunchAgentLabel string `json:"launch_agent_label,omitempty"`
}

// ── Node Client ─────────────────────────────────────────────────────

type NodeClientConfig struct {
	Enabled      bool   `json:"enabled"`
	BridgeAddr   string `json:"bridge_addr"`
	DisplayName  string `json:"display_name"`
	DeviceFamily string `json:"device_family"`
	ModelID      string `json:"model_id"`
	SessionKey   string `json:"session_key"`
	TTSEngine    string `json:"tts_engine"`
	MDNSEnabled  bool   `json:"mdns_enabled"`
	MDNSService  string `json:"mdns_service"`
}

// ── Gateway Spawn ───────────────────────────────────────────────────

type GatewaySpawnConfig struct {
	AutoSpawn    bool   `json:"auto_spawn"`
	Port         int    `json:"port"`
	TMUXSession  string `json:"tmux_session"`
	UseTailscale bool   `json:"use_tailscale"`
	Force        bool   `json:"force"`
}

// ── SolanaOS: Solana Stack ───────────────────────────────────────────

type SolanaConfig struct {
	HeliusAPIKey               string  `json:"helius_api_key"`
	HeliusRPCURL               string  `json:"helius_rpc_url"`
	HeliusWSSURL               string  `json:"helius_wss_url"`
	HeliusNetwork              string  `json:"helius_network"`
	HeliusTimeoutSeconds       float64 `json:"helius_timeout_seconds"`
	HeliusRetries              int     `json:"helius_retries"`
	SolanaTrackerAPIKey        string  `json:"solana_tracker_api_key"`
	SolanaTrackerRPCURL        string  `json:"solana_tracker_rpc_url"`
	SolanaTrackerWSSURL        string  `json:"solana_tracker_wss_url"`
	SolanaTrackerDataAPIKey    string  `json:"solana_tracker_data_api_key"`
	SolanaTrackerDatastreamKey string  `json:"solana_tracker_datastream_key"`
	BirdeyeAPIKey              string  `json:"birdeye_api_key"`
	BirdeyeWSSURL              string  `json:"birdeye_wss_url"`
	JupiterAPIKey              string  `json:"jupiter_api_key"`
	JupiterEndpoint            string  `json:"jupiter_endpoint"`
	AsterAPIKey                string  `json:"aster_api_key"`
	AsterAPISecret             string  `json:"aster_api_secret"`
	AsterWalletAddress         string  `json:"aster_wallet_address"`
	AsterPrivateKey            string  `json:"aster_private_key"`
	AsterUserAddress           string  `json:"aster_user_address"`
	AsterSignerAddress         string  `json:"aster_signer_address"`
	WalletPubkey               string  `json:"wallet_pubkey"`
	WalletKeyPath              string  `json:"wallet_key_path"`
	MaxPositionSOL             float64 `json:"max_position_sol"`
	MinReserveSOL              float64 `json:"min_reserve_sol"`
	SwapSlippageBps            int     `json:"swap_slippage_bps"`
}

// ── SolanaOS: OODA Loop ─────────────────────────────────────────────

type OODAConfig struct {
	Enabled          bool     `json:"enabled"`
	IntervalSeconds  int      `json:"interval_seconds"`
	Mode             string   `json:"mode"` // "live", "simulated", "backtest"
	Watchlist        []string `json:"watchlist"`
	MinSignalStr     float64  `json:"min_signal_strength"`
	MinConfidence    float64  `json:"min_confidence"`
	MaxPositions     int      `json:"max_positions"`
	StopLossPct      float64  `json:"stop_loss_pct"`
	TakeProfitPct    float64  `json:"take_profit_pct"`
	PositionSizePct  float64  `json:"position_size_pct"`
	LearnIntervalMin int      `json:"learn_interval_min"`
	AutoOptimize     bool     `json:"auto_optimize"`
}

// ── SolanaOS: Supabase ───────────────────────────────────────────────

type SupabaseConfig struct {
	URL        string `json:"url"`
	ServiceKey string `json:"service_key"`
}

// ── SolanaOS: Convex ────────────────────────────────────────────────

type ConvexConfig struct {
	Enabled   bool   `json:"enabled"`
	URL       string `json:"url"`
	DeployKey string `json:"deploy_key"`
}

type LearningConfig struct {
	Enabled              bool   `json:"enabled"`
	SessionDBPath        string `json:"session_db_path"`
	SearchResultLimit    int    `json:"search_result_limit"`
	AutoSkillThreshold   int    `json:"auto_skill_threshold"`
	UserModelMaxEvidence int    `json:"user_model_max_evidence"`
	ReviewIntervalMin    int    `json:"review_interval_min"`
	NudgeIntervalMin     int    `json:"nudge_interval_min"`
	AutoImproveSkills    bool   `json:"auto_improve_skills"`
}

type HonchoConfig struct {
	Enabled          bool   `json:"enabled"`
	BaseURL          string `json:"base_url"`
	APIKey           string `json:"api_key"`
	WorkspaceID      string `json:"workspace_id"`
	AgentPeerID      string `json:"agent_peer_id"`
	ReasoningLevel   string `json:"reasoning_level"`
	SessionStrategy  string `json:"session_strategy"` // "per-chat" (default), "per-user", "global"
	ContextTokens    int    `json:"context_tokens"`
	UseSummary       bool   `json:"use_summary"`
	SyncMessages     bool   `json:"sync_messages"`
	DialecticEnabled bool   `json:"dialectic_enabled"` // proactive user modeling via PeerChat
}

type AutomationsConfig struct {
	Enabled bool                  `json:"enabled"`
	Jobs    []AutomationJobConfig `json:"jobs"`
}

type AutomationJobConfig struct {
	Enabled         bool   `json:"enabled"`
	Name            string `json:"name"`
	Kind            string `json:"kind"`
	Schedule        string `json:"schedule"`
	Channel         string `json:"channel"`
	ChatID          string `json:"chat_id"`
	Prompt          string `json:"prompt"`
	IncludeLearning bool   `json:"include_learning"`
}

type RuntimeConfig struct {
	Enabled               bool     `json:"enabled"`
	DefaultBackend        string   `json:"default_backend"`
	Backends              []string `json:"backends"`
	ServerlessPersistence bool     `json:"serverless_persistence"`
}

type DelegationConfig struct {
	Enabled           bool   `json:"enabled"`
	MaxParallel       int    `json:"max_parallel"`
	ScaffoldPythonRPC bool   `json:"scaffold_python_rpc"`
	WorkspaceSubdir   string `json:"workspace_subdir"`
}

type ResearchReadyConfig struct {
	Enabled            bool   `json:"enabled"`
	TrajectoryDir      string `json:"trajectory_dir"`
	BatchSize          int    `json:"batch_size"`
	CompressionEnabled bool   `json:"compression_enabled"`
	AtroposEnvDir      string `json:"atropos_env_dir"`
}

// ── SolanaOS: x402 Payments ─────────────────────────────────────────

type X402Config struct {
	Enabled                  bool   `json:"enabled"`
	FacilitatorURL           string `json:"facilitator_url"`
	FacilitatorAuthorization string `json:"facilitator_authorization"`
	ProxyEnabled             bool   `json:"proxy_enabled"`
	ProxyPort                int    `json:"proxy_port"`
	RecipientAddress         string `json:"recipient_address"`
	PaymentAmount            string `json:"payment_amount"`
	Network                  string `json:"network"`
	Chains                   string `json:"chains"`
	PaywallEnabled           bool   `json:"paywall_enabled"`
	PaywallPort              int    `json:"paywall_port"`
}

// ── SolanaOS: Bitaxe Miner ───────────────────────────────────────────

type BitaxeConfig struct {
	Enabled         bool    `json:"enabled"`
	Host            string  `json:"host"`               // IP or hostname, no scheme (e.g. "192.168.1.42")
	PollIntervalSec int     `json:"poll_interval_sec"`  // default 10
	AlertsEnabled   bool    `json:"alerts_enabled"`     // send Telegram alerts for temp/offline/hashrate
	TempWarning     float64 `json:"temp_warning"`       // °C warn threshold (default 60)
	TempCritical    float64 `json:"temp_critical"`      // °C critical threshold (default 70)
	HashRateMinGH   float64 `json:"hashrate_min_gh"`    // alert if hashrate drops below (0=disabled)
	AlertCooldownS  int     `json:"alert_cooldown_sec"` // seconds between repeated alerts (default 300)

	// OODA Agent / Auto-Tune
	AutoTune   bool    `json:"auto_tune"`    // enable OODA auto-tuning of freq/fan (default false)
	MaxTempC   float64 `json:"max_temp_c"`   // reduce freq above this (default 72)
	CoolTempC  float64 `json:"cool_temp_c"`  // may overclock below this (default 50)
	MaxFreqMHz int     `json:"max_freq_mhz"` // frequency ceiling (default 600)
	MinFreqMHz int     `json:"min_freq_mhz"` // frequency floor (default 400)

	// TamaGOchi Pet
	PetName string `json:"pet_name"` // custom pet name (default "MawdPet")

	// Pool (for /miner pool quick-switch)
	PoolURL  string `json:"pool_url"`  // stratum URL (e.g. "public-pool.io")
	PoolPort int    `json:"pool_port"` // stratum port (e.g. 21496)
	PoolUser string `json:"pool_user"` // BTC address
}

// ── SolanaOS: Hyperliquid ────────────────────────────────────────────

type HyperliquidConfig struct {
	Enabled            bool     `json:"enabled"`
	PrivateKey         string   `json:"private_key"` // EVM private key hex (0x...)
	Wallet             string   `json:"wallet"`      // EVM wallet address (derived if empty)
	Testnet            bool     `json:"testnet"`
	WSEnabled          bool     `json:"ws_enabled"`
	Symbols            []string `json:"symbols"`
	TriggerCooldownSec int      `json:"trigger_cooldown_sec"`
	MarkTriggerBps     float64  `json:"mark_trigger_bps"`
}

// ── SolanaOS: Strategy ───────────────────────────────────────────────

type StrategyConfig struct {
	RSIOverbought   int     `json:"rsi_overbought"`
	RSIOversold     int     `json:"rsi_oversold"`
	EMAFastPeriod   int     `json:"ema_fast_period"`
	EMASlowPeriod   int     `json:"ema_slow_period"`
	StopLossPct     float64 `json:"stop_loss_pct"`
	TakeProfitPct   float64 `json:"take_profit_pct"`
	PositionSizePct float64 `json:"position_size_pct"`
	UsePerps        bool    `json:"use_perps"`
}

// ── Agent Registry / Tokenized Agent Deployment ─────────────────────

type AgentRegistryConfig struct {
	Enabled          bool     `json:"enabled"`
	Cluster          string   `json:"cluster"`
	RPCURL           string   `json:"rpc_url"`
	TokenURI         string   `json:"token_uri"`
	IndexerAPIKey    string   `json:"indexer_api_key"`
	PinataJWT        string   `json:"pinata_jwt"`
	Name             string   `json:"name"`
	Description      string   `json:"description"`
	Image            string   `json:"image"`
	MCPURL           string   `json:"mcp_url"`
	A2AURL           string   `json:"a2a_url"`
	SNS              string   `json:"sns"`
	ENS              string   `json:"ens"`
	DID              string   `json:"did"`
	Skills           []string `json:"skills"`
	Domains          []string `json:"domains"`
	X402Support      bool     `json:"x402_support"`
	WriteHeartbeat   bool     `json:"write_heartbeat"`
	HeartbeatKey     string   `json:"heartbeat_key"`
	EnableAtom       bool     `json:"enable_atom"`
	PumpEnabled      bool     `json:"pump_enabled"`
	PumpEnvironment  string   `json:"pump_environment"`
	PumpAgentMint    string   `json:"pump_agent_mint"`
	PumpCurrencyMint string   `json:"pump_currency_mint"`
	PumpPriceAmount  string   `json:"pump_price_amount"`
}

type PumpLaunchConfig struct {
	Enabled       bool    `json:"enabled"`
	Confirm       string  `json:"confirm"`
	Mode          string  `json:"mode"`
	Cluster       string  `json:"cluster"`
	RPCURL        string  `json:"rpc_url"`
	PinataJWT     string  `json:"pinata_jwt"`
	MetadataURI   string  `json:"metadata_uri"`
	Name          string  `json:"name"`
	Symbol        string  `json:"symbol"`
	Description   string  `json:"description"`
	Image         string  `json:"image"`
	Website       string  `json:"website"`
	XURL          string  `json:"x_url"`
	TelegramURL   string  `json:"telegram_url"`
	InitialBuySOL float64 `json:"initial_buy_sol"`
	SlippagePct   float64 `json:"slippage_pct"`
	MayhemMode    bool    `json:"mayhem_mode"`
	Cashback      bool    `json:"cashback"`
}

// ── Pinata Private IPFS Hub ──────────────────────────────────────────

type PinataHubConfig struct {
	Enabled    bool   `json:"enabled"`
	APIKey     string `json:"api_key"`
	APISecret  string `json:"api_secret"`
	JWT        string `json:"jwt"`
	Gateway    string `json:"gateway"`     // e.g. "your-gateway.mypinata.cloud"
	MeshSync   bool   `json:"mesh_sync"`   // auto-sync files across Tailscale/BLE mesh
	BLEBridge  string `json:"ble_bridge"`  // BLE bridge addr (default 127.0.0.1:8765)
}

// ── Defaults ─────────────────────────────────────────────────────────

func DefaultConfig() *Config {
	return &Config{
		Agents: AgentsConfig{
			Defaults: AgentDefaults{
				Workspace:           "~/.nanosolana/workspace",
				RestrictToWorkspace: true,
				ModelName:           "openai/gpt-5.4-mini",
				MaxTokens:           8192,
				Temperature:         0.7,
				MaxToolIterations:   20,
			},
		},
		ModelList: []ModelEntry{
			{
				ModelName: "openai/gpt-5.4-mini",
				Model:     "openai/gpt-5.4-mini",
				APIKey:    "",
			},
		},
		Channels: ChannelsConfig{
			Telegram: TelegramChannel{Enabled: false},
			Discord:  DiscordChannel{Enabled: false},
			X: XChannel{
				Enabled:         false,
				APIBase:         "https://api.x.com/1.1",
				PollIntervalSec: 45,
			},
		},
		Tools: ToolsConfig{
			Web: WebToolsConfig{
				DuckDuckGo: DDGConfig{Enabled: true, MaxResults: 5},
			},
			Cron: CronToolsConfig{Enabled: true, ExecTimeoutMinutes: 5},
			Exec: ExecToolConfig{Enabled: true},
			BrowserUse: BrowserUseToolConfig{
				Enabled:              false,
				Session:              "default",
				Cloud:                true,
				CloudProvider:        "auto",
				CloudTimeoutMinutes:  15,
				BrowserbaseProxies:   true,
				BrowserbaseKeepAlive: true,
			},
		},
		Heartbeat: HeartbeatConfig{Enabled: true, Interval: 30},
		Gateway: GatewayConfig{
			Host: "127.0.0.1",
			Port: 18790,
			Bind: "loopback",
			Auth: GatewayAuthConfig{
				AllowTailscale: true,
			},
			Remote: GatewayRemoteConfig{
				Mode: "local",
				SSH: GatewaySSHConfig{
					Alias:            "nanosolana-remote-gateway",
					LocalPort:        18790,
					RemotePort:       18790,
					RemoteBindHost:   "127.0.0.1",
					LaunchAgentLabel: "ai.nanosolana.ssh-tunnel",
				},
			},
			Tailscale: GatewayTailscaleConfig{
				Mode: "off",
			},
		},
		Node: NodeClientConfig{
			Enabled:     false,
			BridgeAddr:  "127.0.0.1:18790",
			SessionKey:  "main",
			TTSEngine:   "none",
			MDNSEnabled: true,
			MDNSService: "_nanoclaw-node._tcp",
		},
		GatewaySpawn: GatewaySpawnConfig{
			AutoSpawn:    false,
			Port:         18790,
			TMUXSession:  "nano-gw",
			UseTailscale: true,
			Force:        false,
		},
		Solana: SolanaConfig{
			HeliusNetwork:        "mainnet",
			HeliusTimeoutSeconds: 20,
			HeliusRetries:        3,
			JupiterEndpoint:      "https://api.jup.ag",
			MaxPositionSOL:       0.5,
			MinReserveSOL:        0.01,
			SwapSlippageBps:      100,
		},
		OODA: OODAConfig{
			Enabled:          true,
			IntervalSeconds:  60,
			Mode:             "live",
			Watchlist:        []string{"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"},
			MinSignalStr:     0.6,
			MinConfidence:    0.5,
			MaxPositions:     3,
			StopLossPct:      0.08,
			TakeProfitPct:    0.20,
			PositionSizePct:  0.10,
			LearnIntervalMin: 30,
			AutoOptimize:     true,
		},
		X402: X402Config{
			Enabled:        true,
			FacilitatorURL: "https://facilitator.x402.rs",
			ProxyEnabled:   true,
			ProxyPort:      18403,
			PaymentAmount:  "0.001",
			Network:        "solana",
			Chains:         "solana",
			PaywallEnabled: false,
			PaywallPort:    18402,
		},
		Strategy: StrategyConfig{
			RSIOverbought:   70,
			RSIOversold:     30,
			EMAFastPeriod:   20,
			EMASlowPeriod:   50,
			StopLossPct:     0.08,
			TakeProfitPct:   0.20,
			PositionSizePct: 0.10,
			UsePerps:        true,
		},
		Registry: AgentRegistryConfig{
			Enabled:         false,
			Cluster:         "mainnet-beta",
			Name:            "SolanaOS",
			Description:     "Local-first Solana operator runtime with OODA trading, Telegram control, x402 monetization, and companion state.",
			Domains:         PublicRegistryDomains(),
			X402Support:     true,
			HeartbeatKey:    "last_seen",
			PumpEnvironment: "mainnet",
		},
		Convex: ConvexConfig{
			Enabled: false,
		},
		Learning: LearningConfig{
			Enabled:              true,
			SearchResultLimit:    5,
			AutoSkillThreshold:   3,
			UserModelMaxEvidence: 12,
			ReviewIntervalMin:    360,
			NudgeIntervalMin:     720,
			AutoImproveSkills:    true,
		},
		Honcho: HonchoConfig{
			Enabled:          false,
			BaseURL:          "https://api.honcho.dev",
			WorkspaceID:      "solanaos",
			AgentPeerID:      "solanaos-agent",
			ReasoningLevel:   "low",
			SessionStrategy:  "per-chat",
			ContextTokens:    4000,
			UseSummary:       true,
			SyncMessages:     true,
			DialecticEnabled: true,
		},
		Automations: AutomationsConfig{
			Enabled: true,
			Jobs: []AutomationJobConfig{
				{Enabled: true, Name: "learning-review", Kind: "learning_review", Schedule: "6h", IncludeLearning: true},
				{Enabled: true, Name: "daily-report", Kind: "daily_report", Schedule: "daily", IncludeLearning: true},
				{Enabled: true, Name: "nightly-backup", Kind: "nightly_backup", Schedule: "nightly"},
				{Enabled: true, Name: "weekly-audit", Kind: "weekly_audit", Schedule: "weekly", IncludeLearning: true},
			},
		},
		Runtime: RuntimeConfig{
			Enabled:               true,
			DefaultBackend:        "local",
			Backends:              []string{"local", "docker", "ssh", "daytona", "singularity", "modal"},
			ServerlessPersistence: true,
		},
		Delegation: DelegationConfig{
			Enabled:           true,
			MaxParallel:       3,
			ScaffoldPythonRPC: true,
			WorkspaceSubdir:   "delegates",
		},
		Research: ResearchReadyConfig{
			Enabled:            true,
			TrajectoryDir:      "workspace/research/trajectories",
			BatchSize:          100,
			CompressionEnabled: true,
			AtroposEnvDir:      "workspace/research/atropos",
		},
		Hyperliquid: HyperliquidConfig{
			WSEnabled:          true,
			Symbols:            []string{"BTC", "ETH", "SOL"},
			TriggerCooldownSec: 15,
			MarkTriggerBps:     25,
		},
		PumpLaunch: PumpLaunchConfig{
			Enabled:       false,
			Confirm:       "",
			Mode:          "once_only",
			Cluster:       "mainnet-beta",
			Name:          "SolanaOS",
			Symbol:        "NANO",
			InitialBuySOL: 0,
			SlippagePct:   2,
			MayhemMode:    false,
			Cashback:      false,
		},
		Pinata: PinataHubConfig{
			Enabled:  false,
			MeshSync: true,
		},
	}
}

// ── Path Helpers ─────────────────────────────────────────────────────

func DefaultHome() string {
	if h := firstNonEmptyEnv("SOLANAOS_HOME", "NANOSOLANA_HOME", "MAWDBOT_HOME"); h != "" {
		return h
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".nanosolana")
}

func DefaultConfigPath() string {
	if p := firstNonEmptyEnv("SOLANAOS_CONFIG", "NANOSOLANA_CONFIG", "MAWDBOT_CONFIG"); p != "" {
		return p
	}
	return filepath.Join(DefaultHome(), "config.json")
}

func DefaultWorkspacePath() string {
	return filepath.Join(DefaultHome(), "workspace")
}

// ── Load / Save ──────────────────────────────────────────────────────

func Load() (*Config, error) {
	BootstrapEnv()
	path := DefaultConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return defaults if no config file (with env overrides)
			cfg := DefaultConfig()
			applyEnvOverrides(cfg)
			applySolanaProviderFallbacks(cfg)
			return cfg, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}

	cfg := DefaultConfig()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	// Override with env vars
	applyEnvOverrides(cfg)
	applySolanaProviderFallbacks(cfg)
	normalizeLegacyBranding(cfg)

	return cfg, nil
}

func Save(cfg *Config) error {
	path := DefaultConfigPath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	return os.WriteFile(path, data, 0o644)
}

func EnsureDefaults() error {
	path := DefaultConfigPath()
	if _, err := os.Stat(path); err == nil {
		return nil // already exists
	}

	cfg := DefaultConfig()
	if err := Save(cfg); err != nil {
		return err
	}

	// Create workspace directories
	ws := DefaultWorkspacePath()
	dirs := []string{
		filepath.Join(ws, "sessions"),
		filepath.Join(ws, "memory"),
		filepath.Join(ws, "memory", "session-search"),
		filepath.Join(ws, "memory", "user-models"),
		filepath.Join(ws, "memory", "nudges"),
		filepath.Join(ws, "state"),
		filepath.Join(ws, "cron"),
		filepath.Join(ws, "automations", "reports"),
		filepath.Join(ws, "automations", "backups"),
		filepath.Join(ws, "automations", "audits"),
		filepath.Join(ws, "runtime"),
		filepath.Join(ws, "delegates"),
		filepath.Join(ws, "skills"),
		filepath.Join(ws, "research", "trajectories"),
		filepath.Join(ws, "research", "atropos"),
		filepath.Join(ws, "vault", "decisions"),
		filepath.Join(ws, "vault", "lessons"),
		filepath.Join(ws, "vault", "trades"),
		filepath.Join(ws, "vault", "research"),
		filepath.Join(ws, "vault", "inbox"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return fmt.Errorf("create dir %s: %w", d, err)
		}
	}

	// Write identity files
	identityFiles := map[string]string{
		"IDENTITY.md": solanaosIdentity,
		"SOUL.md":     solanasosSoul,
		"AGENTS.md":   solanaosAgents,
	}
	for name, content := range identityFiles {
		p := filepath.Join(ws, name)
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", name, err)
		}
	}

	return nil
}

// ── Env Overrides ────────────────────────────────────────────────────

func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("HELIUS_API_KEY"); v != "" {
		cfg.Solana.HeliusAPIKey = v
	}
	if v := os.Getenv("HELIUS_RPC_URL"); v != "" {
		cfg.Solana.HeliusRPCURL = v
	}
	if v := os.Getenv("HELIUS_WSS_URL"); v != "" {
		cfg.Solana.HeliusWSSURL = v
	}
	if v := os.Getenv("HELIUS_NETWORK"); v != "" {
		cfg.Solana.HeliusNetwork = v
	}
	if v := os.Getenv("HELIUS_TIMEOUT"); v != "" {
		if timeout, err := strconv.ParseFloat(v, 64); err == nil && timeout > 0 {
			cfg.Solana.HeliusTimeoutSeconds = timeout
		}
	}
	if v := os.Getenv("HELIUS_RETRIES"); v != "" {
		if retries, err := strconv.Atoi(v); err == nil && retries > 0 {
			cfg.Solana.HeliusRetries = retries
		}
	}
	if v := os.Getenv("SOLANA_TRACKER_API_KEY"); v != "" {
		cfg.Solana.SolanaTrackerAPIKey = v
	}
	if v := os.Getenv("SOLANA_TRACKER_RPC_URL"); v != "" {
		cfg.Solana.SolanaTrackerRPCURL = v
	}
	if v := os.Getenv("SOLANA_TRACKER_WSS_URL"); v != "" {
		cfg.Solana.SolanaTrackerWSSURL = v
	}
	if v := os.Getenv("SOLANA_TRACKER_DATA_API_KEY"); v != "" {
		cfg.Solana.SolanaTrackerDataAPIKey = v
	}
	if v := os.Getenv("SOLANA_TRACKER_DATASTREAM_KEY"); v != "" {
		cfg.Solana.SolanaTrackerDatastreamKey = v
	}
	if v := os.Getenv("BIRDEYE_API_KEY"); v != "" {
		cfg.Solana.BirdeyeAPIKey = v
	}
	if v := os.Getenv("BIRDEYE_WSS_URL"); v != "" {
		cfg.Solana.BirdeyeWSSURL = v
	}
	if v := os.Getenv("JUPITER_API_KEY"); v != "" {
		cfg.Solana.JupiterAPIKey = v
	}
	if v := os.Getenv("JUPITER_ENDPOINT"); v != "" {
		cfg.Solana.JupiterEndpoint = v
	}
	if v := os.Getenv("JUPITER_SLIPPAGE_BPS"); v != "" {
		if slippage, err := strconv.Atoi(v); err == nil && slippage > 0 {
			cfg.Solana.SwapSlippageBps = slippage
		}
	}
	if v := os.Getenv("ASTER_API_KEY"); v != "" {
		cfg.Solana.AsterAPIKey = v
	}
	if v := os.Getenv("ASTER_API_SECRET"); v != "" {
		cfg.Solana.AsterAPISecret = v
	}
	if v := os.Getenv("ASTER_WALLET_ADDRESS"); v != "" {
		cfg.Solana.AsterWalletAddress = v
	}
	if v := os.Getenv("ASTER_PRIVATE_KEY"); v != "" {
		cfg.Solana.AsterPrivateKey = v
	}
	if v := os.Getenv("ASTER_USER_ADDRESS"); v != "" {
		cfg.Solana.AsterUserAddress = v
	}
	if v := os.Getenv("ASTER_SIGNER_ADDRESS"); v != "" {
		cfg.Solana.AsterSignerAddress = v
	}
	if v := os.Getenv("SOLANA_WALLET_PUBKEY"); v != "" {
		cfg.Solana.WalletPubkey = v
	}
	if v := strings.TrimSpace(os.Getenv("SOLANA_WALLET_KEY_PATH")); v != "" {
		cfg.Solana.WalletKeyPath = v
	}
	if v := os.Getenv("SOLANA_MIN_RESERVE_SOL"); v != "" {
		if reserve, err := strconv.ParseFloat(v, 64); err == nil && reserve >= 0 {
			cfg.Solana.MinReserveSOL = reserve
		}
	}
	if v := os.Getenv("SOLANA_MAX_POSITION_SOL"); v != "" {
		if maxPos, err := strconv.ParseFloat(v, 64); err == nil && maxPos > 0 {
			cfg.Solana.MaxPositionSOL = maxPos
		}
	}
	if v := os.Getenv("ANTHROPIC_API_KEY"); v != "" {
		cfg.Providers.Anthropic.APIKey = v
	}
	if v := os.Getenv("TELEGRAM_BOT_TOKEN"); v != "" {
		cfg.Channels.Telegram.Token = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TELEGRAM_ID", "TELEGRAM_USER_ID")); v != "" {
		cfg.Channels.Telegram.AllowFrom = []string{v}
	}
	if v := os.Getenv("TELEGRAM_ALLOW_FROM"); v != "" {
		parts := strings.Split(v, ",")
		allow := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				allow = append(allow, p)
			}
		}
		if len(cfg.Channels.Telegram.AllowFrom) == 0 {
			cfg.Channels.Telegram.AllowFrom = allow
		}
	}
	if v := os.Getenv("TELEGRAM_PROXY"); v != "" {
		cfg.Channels.Telegram.Proxy = v
	}
	if v := os.Getenv("TELEGRAM_API_BASE"); v != "" {
		cfg.Channels.Telegram.BaseURL = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_CONSUMER_KEY", "X_CONSUMER_KEY", "CONSUMER_KEY")); v != "" {
		cfg.Channels.X.ConsumerKey = v
		cfg.Channels.X.Enabled = true
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_CONSUMER_SECRET", "X_CONSUMER_SECRET", "SECRET_KEY")); v != "" {
		cfg.Channels.X.ConsumerSecret = v
		cfg.Channels.X.Enabled = true
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_BEARER_TOKEN", "X_BEARER_TOKEN", "BEARER_TOKEN")); v != "" {
		cfg.Channels.X.BearerToken = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_ACCESS_TOKEN", "X_ACCESS_TOKEN", "ACCESS_TOKEN")); v != "" {
		cfg.Channels.X.AccessToken = v
		cfg.Channels.X.Enabled = true
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_ACCESS_TOKEN_SECRET", "X_ACCESS_TOKEN_SECRET", "ACCESS_TOKEN_SECRET")); v != "" {
		cfg.Channels.X.AccessTokenSecret = v
		cfg.Channels.X.Enabled = true
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_CLIENT_ID", "X_CLIENT_ID", "CLIENT_ID")); v != "" {
		cfg.Channels.X.ClientID = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_CLIENT_SECRET", "X_CLIENT_SECRET", "CLIENT_SECRET")); v != "" {
		cfg.Channels.X.ClientSecret = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_HANDLE", "X_HANDLE")); v != "" {
		cfg.Channels.X.Handle = strings.TrimPrefix(v, "@")
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_ALLOW_FROM", "X_ALLOW_FROM")); v != "" {
		parts := strings.Split(v, ",")
		allow := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				allow = append(allow, p)
			}
		}
		cfg.Channels.X.AllowFrom = allow
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_API_BASE", "X_API_BASE")); v != "" {
		cfg.Channels.X.APIBase = strings.TrimRight(v, "/")
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("TWITTER_POLL_INTERVAL_SEC", "X_POLL_INTERVAL_SEC")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Channels.X.PollIntervalSec = n
		}
	}
	if v := os.Getenv("SUPABASE_URL"); v != "" {
		cfg.Supabase.URL = v
	}
	if v := os.Getenv("SUPABASE_SERVICE_KEY"); v != "" {
		cfg.Supabase.ServiceKey = v
	}
	if v := os.Getenv("CONVEX_ENABLED"); v != "" {
		cfg.Convex.Enabled = parseBoolWithDefault(v, cfg.Convex.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("CONVEX_URL")); v != "" {
		cfg.Convex.URL = v
	}
	if v := strings.TrimSpace(os.Getenv("CONVEX_DEPLOY_KEY")); v != "" {
		cfg.Convex.DeployKey = v
	}
	if v := os.Getenv("LEARNING_ENABLED"); v != "" {
		cfg.Learning.Enabled = parseBoolWithDefault(v, cfg.Learning.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("LEARNING_SESSION_DB_PATH")); v != "" {
		cfg.Learning.SessionDBPath = v
	}
	if v := strings.TrimSpace(os.Getenv("LEARNING_SEARCH_LIMIT")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Learning.SearchResultLimit = n
		}
	}
	if v := strings.TrimSpace(os.Getenv("LEARNING_AUTO_SKILL_THRESHOLD")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Learning.AutoSkillThreshold = n
		}
	}
	if v := strings.TrimSpace(os.Getenv("LEARNING_USER_MODEL_MAX_EVIDENCE")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Learning.UserModelMaxEvidence = n
		}
	}
	if v := strings.TrimSpace(os.Getenv("LEARNING_REVIEW_INTERVAL_MIN")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Learning.ReviewIntervalMin = n
		}
	}
	if v := strings.TrimSpace(os.Getenv("LEARNING_NUDGE_INTERVAL_MIN")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Learning.NudgeIntervalMin = n
		}
	}
	if v := os.Getenv("LEARNING_AUTO_IMPROVE_SKILLS"); v != "" {
		cfg.Learning.AutoImproveSkills = parseBoolWithDefault(v, cfg.Learning.AutoImproveSkills)
	}
	if v := os.Getenv("HONCHO_ENABLED"); v != "" {
		cfg.Honcho.Enabled = parseBoolWithDefault(v, cfg.Honcho.Enabled)
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("HONCHO_URL", "HONCHO_BASE_URL")); v != "" {
		cfg.Honcho.BaseURL = v
	}
	if v := strings.TrimSpace(os.Getenv("HONCHO_API_KEY")); v != "" {
		cfg.Honcho.APIKey = v
		if os.Getenv("HONCHO_ENABLED") == "" {
			cfg.Honcho.Enabled = true
		}
	}
	if v := strings.TrimSpace(os.Getenv("HONCHO_WORKSPACE_ID")); v != "" {
		cfg.Honcho.WorkspaceID = v
	}
	if v := strings.TrimSpace(os.Getenv("HONCHO_AGENT_PEER_ID")); v != "" {
		cfg.Honcho.AgentPeerID = v
	}
	if v := strings.TrimSpace(os.Getenv("HONCHO_REASONING_LEVEL")); v != "" {
		cfg.Honcho.ReasoningLevel = v
	}
	if v := strings.TrimSpace(os.Getenv("HONCHO_CONTEXT_TOKENS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Honcho.ContextTokens = n
		}
	}
	if v := os.Getenv("HONCHO_CONTEXT_SUMMARY"); v != "" {
		cfg.Honcho.UseSummary = parseBoolWithDefault(v, cfg.Honcho.UseSummary)
	}
	if v := os.Getenv("HONCHO_SYNC_MESSAGES"); v != "" {
		cfg.Honcho.SyncMessages = parseBoolWithDefault(v, cfg.Honcho.SyncMessages)
	}
	if v := strings.TrimSpace(os.Getenv("HONCHO_SESSION_STRATEGY")); v != "" {
		cfg.Honcho.SessionStrategy = v
	}
	if v := os.Getenv("HONCHO_DIALECTIC_ENABLED"); v != "" {
		cfg.Honcho.DialecticEnabled = parseBoolWithDefault(v, cfg.Honcho.DialecticEnabled)
	}
	if v := os.Getenv("AUTOMATIONS_ENABLED"); v != "" {
		cfg.Automations.Enabled = parseBoolWithDefault(v, cfg.Automations.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("RUNTIME_DEFAULT_BACKEND")); v != "" {
		cfg.Runtime.DefaultBackend = v
	}
	if v := os.Getenv("RUNTIME_SERVERLESS_PERSISTENCE"); v != "" {
		cfg.Runtime.ServerlessPersistence = parseBoolWithDefault(v, cfg.Runtime.ServerlessPersistence)
	}
	if v := os.Getenv("DELEGATION_ENABLED"); v != "" {
		cfg.Delegation.Enabled = parseBoolWithDefault(v, cfg.Delegation.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("DELEGATION_MAX_PARALLEL")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Delegation.MaxParallel = n
		}
	}
	if v := os.Getenv("DELEGATION_SCAFFOLD_PYTHON_RPC"); v != "" {
		cfg.Delegation.ScaffoldPythonRPC = parseBoolWithDefault(v, cfg.Delegation.ScaffoldPythonRPC)
	}
	if v := os.Getenv("RESEARCH_ENABLED"); v != "" {
		cfg.Research.Enabled = parseBoolWithDefault(v, cfg.Research.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("RESEARCH_TRAJECTORY_BATCH_SIZE")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Research.BatchSize = n
		}
	}
	if v := os.Getenv("RESEARCH_TRAJECTORY_COMPRESS"); v != "" {
		cfg.Research.CompressionEnabled = parseBoolWithDefault(v, cfg.Research.CompressionEnabled)
	}
	if v := os.Getenv("OODA_WATCHLIST"); v != "" {
		parts := strings.Split(v, ",")
		mints := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				mints = append(mints, p)
			}
		}
		if len(mints) > 0 {
			cfg.OODA.Watchlist = mints
		}
	}
	if v := os.Getenv("OODA_MODE"); v != "" {
		cfg.OODA.Mode = v
	}
	if v := os.Getenv("OODA_INTERVAL_SECONDS"); v != "" {
		if seconds, err := strconv.Atoi(v); err == nil && seconds > 0 {
			cfg.OODA.IntervalSeconds = seconds
		}
	}
	if v := os.Getenv("OODA_POSITION_SIZE_PCT"); v != "" {
		if pct, err := strconv.ParseFloat(v, 64); err == nil && pct > 0 {
			cfg.OODA.PositionSizePct = pct
		}
	}
	if v := os.Getenv("OPENROUTER_API_KEY"); v != "" {
		cfg.Providers.OpenRouter.APIKey = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_API_KEY", "BROWSER_USE_API_KEY")); v != "" {
		cfg.Tools.BrowserUse.APIKey = v
		cfg.Tools.BrowserUse.Enabled = true
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_BINARY", "BROWSER_USE_BINARY")); v != "" {
		cfg.Tools.BrowserUse.BinaryPath = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_HOME", "BROWSER_USE_HOME")); v != "" {
		cfg.Tools.BrowserUse.Home = v
	}
	if v := os.Getenv("BROWSERUSE_ENABLED"); v != "" {
		cfg.Tools.BrowserUse.Enabled = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Enabled)
	}
	if v := os.Getenv("BROWSER_USE_ENABLED"); v != "" {
		cfg.Tools.BrowserUse.Enabled = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Enabled)
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_SESSION", "BROWSER_USE_SESSION")); v != "" {
		cfg.Tools.BrowserUse.Session = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_PROFILE", "BROWSER_USE_PROFILE")); v != "" {
		cfg.Tools.BrowserUse.Profile = v
	}
	if v := os.Getenv("BROWSERUSE_CONNECT"); v != "" {
		cfg.Tools.BrowserUse.Connect = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Connect)
	}
	if v := os.Getenv("BROWSER_USE_CONNECT"); v != "" {
		cfg.Tools.BrowserUse.Connect = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Connect)
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_CDP_URL", "BROWSER_USE_CDP_URL")); v != "" {
		cfg.Tools.BrowserUse.CDPURL = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_CLOUD_PROFILE_ID", "BROWSER_USE_CLOUD_PROFILE_ID")); v != "" {
		cfg.Tools.BrowserUse.CloudProfileID = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_CLOUD_PROXY_COUNTRY", "BROWSER_USE_CLOUD_PROXY_COUNTRY")); v != "" {
		cfg.Tools.BrowserUse.CloudProxyCountryCode = strings.ToLower(v)
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_CLOUD_TIMEOUT", "BROWSER_USE_CLOUD_TIMEOUT")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Tools.BrowserUse.CloudTimeoutMinutes = n
		}
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("BROWSERUSE_CLOUD_PROVIDER", "BROWSER_USE_CLOUD_PROVIDER")); v != "" {
		cfg.Tools.BrowserUse.CloudProvider = strings.ToLower(v)
	}
	if v := strings.TrimSpace(os.Getenv("BROWSERBASE_API_KEY")); v != "" {
		cfg.Tools.BrowserUse.BrowserbaseAPIKey = v
		cfg.Tools.BrowserUse.Enabled = true
	}
	if v := strings.TrimSpace(os.Getenv("BROWSERBASE_PROJECT_ID")); v != "" {
		cfg.Tools.BrowserUse.BrowserbaseProjectID = v
	}
	if v := os.Getenv("BROWSERBASE_PROXIES"); v != "" {
		cfg.Tools.BrowserUse.BrowserbaseProxies = parseBoolWithDefault(v, cfg.Tools.BrowserUse.BrowserbaseProxies)
	}
	if v := os.Getenv("BROWSERBASE_ADVANCED_STEALTH"); v != "" {
		cfg.Tools.BrowserUse.BrowserbaseStealth = parseBoolWithDefault(v, cfg.Tools.BrowserUse.BrowserbaseStealth)
	}
	if v := os.Getenv("BROWSERBASE_KEEP_ALIVE"); v != "" {
		cfg.Tools.BrowserUse.BrowserbaseKeepAlive = parseBoolWithDefault(v, cfg.Tools.BrowserUse.BrowserbaseKeepAlive)
	}
	if v := strings.TrimSpace(os.Getenv("BROWSERBASE_SESSION_TIMEOUT")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Tools.BrowserUse.BrowserbaseTimeoutMS = n
		}
	}
	if v := os.Getenv("BROWSERUSE_HEADED"); v != "" {
		cfg.Tools.BrowserUse.Headed = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Headed)
	}
	if v := os.Getenv("BROWSER_USE_HEADED"); v != "" {
		cfg.Tools.BrowserUse.Headed = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Headed)
	}
	if v := os.Getenv("BROWSERUSE_CLOUD"); v != "" {
		cfg.Tools.BrowserUse.Cloud = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Cloud)
	}
	if v := os.Getenv("BROWSER_USE_CLOUD"); v != "" {
		cfg.Tools.BrowserUse.Cloud = parseBoolWithDefault(v, cfg.Tools.BrowserUse.Cloud)
	}
	if v := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL")); v != "" {
		cfg.Agents.Defaults.ModelName = v
		if len(cfg.ModelList) > 0 {
			cfg.ModelList[0].Model = v
			if cfg.ModelList[0].ModelName == "" {
				cfg.ModelList[0].ModelName = v
			}
		} else {
			cfg.ModelList = []ModelEntry{{
				ModelName: v,
				Model:     v,
			}}
		}
	}
	// MODEL1/2/3 are read directly by pkg/llm — validate format only.
	for _, envKey := range []string{"OPENROUTER_MODEL1", "OPENROUTER_MODEL2", "OPENROUTER_MODEL3"} {
		if v := strings.TrimSpace(os.Getenv(envKey)); v != "" && !strings.Contains(v, "/") {
			fmt.Fprintf(os.Stderr, "[config] warning: %s=%q does not look like provider/model\n", envKey, v)
		}
	}

	if v := os.Getenv("X402_ENABLED"); v != "" {
		cfg.X402.Enabled = parseBoolWithDefault(v, cfg.X402.Enabled)
	}
	if v := os.Getenv("X402_FACILITATOR_URL"); v != "" {
		cfg.X402.FacilitatorURL = v
	}
	if v := os.Getenv("X402_FACILITATOR_AUTHORIZATION"); v != "" {
		cfg.X402.FacilitatorAuthorization = v
	}
	if v := os.Getenv("X402_PROXY_ENABLED"); v != "" {
		cfg.X402.ProxyEnabled = parseBoolWithDefault(v, cfg.X402.ProxyEnabled)
	}
	if v := os.Getenv("X402_PROXY_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.X402.ProxyPort = port
		}
	}
	if v := os.Getenv("X402_RECIPIENT_ADDRESS"); v != "" {
		cfg.X402.RecipientAddress = v
	}
	if v := os.Getenv("X402_PAYMENT_AMOUNT"); v != "" {
		cfg.X402.PaymentAmount = v
	}
	if v := os.Getenv("X402_NETWORK"); v != "" {
		cfg.X402.Network = v
	}
	if v := os.Getenv("X402_CHAINS"); v != "" {
		cfg.X402.Chains = v
	}
	if v := os.Getenv("X402_PAYWALL_ENABLED"); v != "" {
		cfg.X402.PaywallEnabled = parseBoolWithDefault(v, cfg.X402.PaywallEnabled)
	}
	if v := os.Getenv("X402_PAYWALL_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.X402.PaywallPort = port
		}
	}

	// ── Node overrides ──────────────────────────────────────────────
	if v := os.Getenv("NODE_BRIDGE_ADDR"); v != "" {
		cfg.Node.BridgeAddr = v
	}
	if v := os.Getenv("NODE_DISPLAY_NAME"); v != "" {
		cfg.Node.DisplayName = v
	}
	if v := os.Getenv("NODE_DEVICE_FAMILY"); v != "" {
		cfg.Node.DeviceFamily = v
	}
	if v := os.Getenv("NODE_SESSION_KEY"); v != "" {
		cfg.Node.SessionKey = v
	}
	if v := os.Getenv("NODE_TTS_ENGINE"); v != "" {
		cfg.Node.TTSEngine = v
	}

	// ── Gateway spawn overrides ────────────────────────────────────
	if v := strings.TrimSpace(os.Getenv("GATEWAY_HOST")); v != "" {
		cfg.Gateway.Host = v
	}
	if v := strings.TrimSpace(os.Getenv("GATEWAY_PORT")); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.Gateway.Port = port
		}
	}
	if v := strings.TrimSpace(os.Getenv("GATEWAY_BIND")); v != "" {
		cfg.Gateway.Bind = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_AUTH_MODE", "OPENCLAW_GATEWAY_AUTH_MODE")); v != "" {
		cfg.Gateway.Auth.Mode = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_AUTH_TOKEN", "OPENCLAW_GATEWAY_TOKEN")); v != "" {
		cfg.Gateway.Auth.Token = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_AUTH_PASSWORD", "OPENCLAW_GATEWAY_PASSWORD")); v != "" {
		cfg.Gateway.Auth.Password = v
	}
	if v := os.Getenv("GATEWAY_AUTH_ALLOW_TAILSCALE"); v != "" {
		cfg.Gateway.Auth.AllowTailscale = parseBoolWithDefault(v, cfg.Gateway.Auth.AllowTailscale)
	}
	if v := strings.TrimSpace(os.Getenv("GATEWAY_TAILSCALE_MODE")); v != "" {
		cfg.Gateway.Tailscale.Mode = v
	}
	if v := os.Getenv("GATEWAY_TAILSCALE_RESET_ON_EXIT"); v != "" {
		cfg.Gateway.Tailscale.ResetOnExit = parseBoolWithDefault(v, cfg.Gateway.Tailscale.ResetOnExit)
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_MODE", "OPENCLAW_GATEWAY_MODE")); v != "" {
		cfg.Gateway.Remote.Mode = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_URL", "OPENCLAW_GATEWAY_URL")); v != "" {
		cfg.Gateway.Remote.URL = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_TOKEN", "OPENCLAW_GATEWAY_TOKEN")); v != "" {
		cfg.Gateway.Remote.Token = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_PASSWORD", "OPENCLAW_GATEWAY_PASSWORD")); v != "" {
		cfg.Gateway.Remote.Password = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_TLS_FINGERPRINT", "OPENCLAW_GATEWAY_TLS_FINGERPRINT")); v != "" {
		cfg.Gateway.Remote.TLSFingerprint = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_ALIAS", "OPENCLAW_REMOTE_SSH_ALIAS")); v != "" {
		cfg.Gateway.Remote.SSH.Alias = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_HOST", "OPENCLAW_REMOTE_SSH_HOST")); v != "" {
		cfg.Gateway.Remote.SSH.Host = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_USER", "OPENCLAW_REMOTE_SSH_USER")); v != "" {
		cfg.Gateway.Remote.SSH.User = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_IDENTITY_FILE", "OPENCLAW_REMOTE_SSH_IDENTITY_FILE")); v != "" {
		cfg.Gateway.Remote.SSH.IdentityFile = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_LOCAL_PORT", "OPENCLAW_REMOTE_SSH_LOCAL_PORT")); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.Gateway.Remote.SSH.LocalPort = port
		}
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_REMOTE_PORT", "OPENCLAW_REMOTE_SSH_REMOTE_PORT")); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.Gateway.Remote.SSH.RemotePort = port
		}
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_REMOTE_BIND_HOST", "OPENCLAW_REMOTE_SSH_REMOTE_BIND_HOST")); v != "" {
		cfg.Gateway.Remote.SSH.RemoteBindHost = v
	}
	if v := strings.TrimSpace(firstNonEmptyEnv("GATEWAY_REMOTE_SSH_LAUNCH_AGENT_LABEL", "OPENCLAW_REMOTE_SSH_LAUNCH_AGENT_LABEL")); v != "" {
		cfg.Gateway.Remote.SSH.LaunchAgentLabel = v
	}
	if v := os.Getenv("GATEWAY_AUTO_SPAWN"); v != "" {
		cfg.GatewaySpawn.AutoSpawn = parseBoolWithDefault(v, cfg.GatewaySpawn.AutoSpawn)
	}
	if v := os.Getenv("GATEWAY_SPAWN_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.GatewaySpawn.Port = port
		}
	}
	if v := os.Getenv("GATEWAY_USE_TAILSCALE"); v != "" {
		cfg.GatewaySpawn.UseTailscale = parseBoolWithDefault(v, cfg.GatewaySpawn.UseTailscale)
	}

	// ── Agent registry overrides ───────────────────────────────────
	if v := os.Getenv("AGENT_REGISTRY_ENABLED"); v != "" {
		cfg.Registry.Enabled = parseBoolWithDefault(v, cfg.Registry.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_CLUSTER")); v != "" {
		cfg.Registry.Cluster = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_RPC_URL")); v != "" {
		cfg.Registry.RPCURL = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_TOKEN_URI")); v != "" {
		cfg.Registry.TokenURI = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_INDEXER_API_KEY")); v != "" {
		cfg.Registry.IndexerAPIKey = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_PINATA_JWT")); v != "" {
		cfg.Registry.PinataJWT = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_NAME")); v != "" {
		cfg.Registry.Name = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_DESCRIPTION")); v != "" {
		cfg.Registry.Description = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_IMAGE")); v != "" {
		cfg.Registry.Image = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_MCP_URL")); v != "" {
		cfg.Registry.MCPURL = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_A2A_URL")); v != "" {
		cfg.Registry.A2AURL = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_SNS")); v != "" {
		cfg.Registry.SNS = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_ENS")); v != "" {
		cfg.Registry.ENS = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_DID")); v != "" {
		cfg.Registry.DID = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_SKILLS")); v != "" {
		cfg.Registry.Skills = splitCSV(v)
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_DOMAINS")); v != "" {
		cfg.Registry.Domains = splitCSV(v)
	}
	if v := os.Getenv("AGENT_REGISTRY_X402_SUPPORT"); v != "" {
		cfg.Registry.X402Support = parseBoolWithDefault(v, cfg.Registry.X402Support)
	}
	if v := os.Getenv("AGENT_REGISTRY_WRITE_HEARTBEAT"); v != "" {
		cfg.Registry.WriteHeartbeat = parseBoolWithDefault(v, cfg.Registry.WriteHeartbeat)
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_REGISTRY_HEARTBEAT_KEY")); v != "" {
		cfg.Registry.HeartbeatKey = v
	}
	if v := os.Getenv("AGENT_REGISTRY_ENABLE_ATOM"); v != "" {
		cfg.Registry.EnableAtom = parseBoolWithDefault(v, cfg.Registry.EnableAtom)
	}
	if v := os.Getenv("PUMP_FUN_ENABLED"); v != "" {
		cfg.Registry.PumpEnabled = parseBoolWithDefault(v, cfg.Registry.PumpEnabled)
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_FUN_ENVIRONMENT")); v != "" {
		cfg.Registry.PumpEnvironment = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_FUN_AGENT_MINT_ADDRESS")); v != "" {
		cfg.Registry.PumpAgentMint = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_FUN_CURRENCY_MINT")); v != "" {
		cfg.Registry.PumpCurrencyMint = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_FUN_PAYMENT_AMOUNT")); v != "" {
		cfg.Registry.PumpPriceAmount = v
	}

	// ── Pump launch overrides ─────────────────────────────────────
	if v := os.Getenv("PUMP_LAUNCH_ENABLED"); v != "" {
		cfg.PumpLaunch.Enabled = parseBoolWithDefault(v, cfg.PumpLaunch.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_MODE")); v != "" {
		cfg.PumpLaunch.Mode = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_CONFIRM")); v != "" {
		cfg.PumpLaunch.Confirm = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_CLUSTER")); v != "" {
		cfg.PumpLaunch.Cluster = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_RPC_URL")); v != "" {
		cfg.PumpLaunch.RPCURL = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_PINATA_JWT")); v != "" {
		cfg.PumpLaunch.PinataJWT = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_METADATA_URI")); v != "" {
		cfg.PumpLaunch.MetadataURI = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_NAME")); v != "" {
		cfg.PumpLaunch.Name = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_SYMBOL")); v != "" {
		cfg.PumpLaunch.Symbol = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_DESCRIPTION")); v != "" {
		cfg.PumpLaunch.Description = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_IMAGE")); v != "" {
		cfg.PumpLaunch.Image = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_WEBSITE")); v != "" {
		cfg.PumpLaunch.Website = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_X_URL")); v != "" {
		cfg.PumpLaunch.XURL = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_TELEGRAM_URL")); v != "" {
		cfg.PumpLaunch.TelegramURL = v
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_INITIAL_BUY_SOL")); v != "" {
		if amount, err := strconv.ParseFloat(v, 64); err == nil && amount >= 0 {
			cfg.PumpLaunch.InitialBuySOL = amount
		}
	}
	if v := strings.TrimSpace(os.Getenv("PUMP_LAUNCH_SLIPPAGE_PCT")); v != "" {
		if slippage, err := strconv.ParseFloat(v, 64); err == nil && slippage >= 0 {
			cfg.PumpLaunch.SlippagePct = slippage
		}
	}
	if v := os.Getenv("PUMP_LAUNCH_MAYHEM_MODE"); v != "" {
		cfg.PumpLaunch.MayhemMode = parseBoolWithDefault(v, cfg.PumpLaunch.MayhemMode)
	}
	if v := os.Getenv("PUMP_LAUNCH_CASHBACK"); v != "" {
		cfg.PumpLaunch.Cashback = parseBoolWithDefault(v, cfg.PumpLaunch.Cashback)
	}
	// Bitaxe miner
	if v := os.Getenv("BITAXE_HOST"); v != "" {
		cfg.Bitaxe.Host = v
	}
	if v := os.Getenv("BITAXE_ENABLED"); v != "" {
		cfg.Bitaxe.Enabled = parseBoolWithDefault(v, cfg.Bitaxe.Enabled)
	}
	if v := os.Getenv("BITAXE_POLL_INTERVAL"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Bitaxe.PollIntervalSec = n
		}
	}
	if v := os.Getenv("BITAXE_ALERTS_ENABLED"); v != "" {
		cfg.Bitaxe.AlertsEnabled = parseBoolWithDefault(v, cfg.Bitaxe.AlertsEnabled)
	}
	if v := os.Getenv("BITAXE_TEMP_WARNING"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			cfg.Bitaxe.TempWarning = f
		}
	}
	if v := os.Getenv("BITAXE_TEMP_CRITICAL"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			cfg.Bitaxe.TempCritical = f
		}
	}
	if v := os.Getenv("BITAXE_HASHRATE_MIN"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 {
			cfg.Bitaxe.HashRateMinGH = f
		}
	}
	if v := os.Getenv("BITAXE_ALERT_COOLDOWN"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Bitaxe.AlertCooldownS = n
		}
	}
	if v := os.Getenv("BITAXE_AUTO_TUNE"); v != "" {
		cfg.Bitaxe.AutoTune = parseBoolWithDefault(v, cfg.Bitaxe.AutoTune)
	}
	if v := os.Getenv("BITAXE_MAX_TEMP_C"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			cfg.Bitaxe.MaxTempC = f
		}
	}
	if v := os.Getenv("BITAXE_COOL_TEMP_C"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			cfg.Bitaxe.CoolTempC = f
		}
	}
	if v := os.Getenv("BITAXE_MAX_FREQ_MHZ"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Bitaxe.MaxFreqMHz = n
		}
	}
	if v := os.Getenv("BITAXE_MIN_FREQ_MHZ"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Bitaxe.MinFreqMHz = n
		}
	}
	if v := os.Getenv("BITAXE_PET_NAME"); v != "" {
		cfg.Bitaxe.PetName = v
	}
	if v := os.Getenv("BITAXE_POOL_URL"); v != "" {
		cfg.Bitaxe.PoolURL = v
	}
	if v := os.Getenv("BITAXE_POOL_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Bitaxe.PoolPort = n
		}
	}
	if v := os.Getenv("BITAXE_POOL_USER"); v != "" {
		cfg.Bitaxe.PoolUser = v
	}
	if v := os.Getenv("BITAXE_POLL_INTERVAL_SEC"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.Bitaxe.PollIntervalSec = n
		}
	}
	// Hyperliquid perps
	if v := os.Getenv("HYPERLIQUID_ENABLED"); v != "" {
		cfg.Hyperliquid.Enabled = parseBoolWithDefault(v, cfg.Hyperliquid.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("HYPERLIQUID_PRIVATE_KEY")); v != "" {
		cfg.Hyperliquid.PrivateKey = v
		cfg.Hyperliquid.Enabled = true
	}
	if v := strings.TrimSpace(os.Getenv("HYPERLIQUID_WALLET")); v != "" {
		cfg.Hyperliquid.Wallet = v
	}
	if v := os.Getenv("HYPERLIQUID_TESTNET"); v != "" {
		cfg.Hyperliquid.Testnet = parseBoolWithDefault(v, cfg.Hyperliquid.Testnet)
	}
	if v := os.Getenv("HYPERLIQUID_WS_ENABLED"); v != "" {
		cfg.Hyperliquid.WSEnabled = parseBoolWithDefault(v, cfg.Hyperliquid.WSEnabled)
	}
	if v := strings.TrimSpace(os.Getenv("HYPERLIQUID_SYMBOLS")); v != "" {
		cfg.Hyperliquid.Symbols = splitCSV(v)
	}
	if v := strings.TrimSpace(os.Getenv("HYPERLIQUID_TRIGGER_COOLDOWN_SEC")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			cfg.Hyperliquid.TriggerCooldownSec = n
		}
	}
	if v := strings.TrimSpace(os.Getenv("HYPERLIQUID_MARK_TRIGGER_BPS")); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil && n >= 0 {
			cfg.Hyperliquid.MarkTriggerBps = n
		}
	}

	// ── Pinata Private IPFS Hub ──────────────────────────────────
	if v := os.Getenv("PINATA_ENABLED"); v != "" {
		cfg.Pinata.Enabled = parseBoolWithDefault(v, cfg.Pinata.Enabled)
	}
	if v := strings.TrimSpace(os.Getenv("PINATA_API_KEY")); v != "" {
		cfg.Pinata.APIKey = v
		if os.Getenv("PINATA_ENABLED") == "" {
			cfg.Pinata.Enabled = true
		}
	}
	if v := strings.TrimSpace(os.Getenv("PINATA_API_SECRET")); v != "" {
		cfg.Pinata.APISecret = v
	}
	if v := strings.TrimSpace(os.Getenv("PINATA_JWT")); v != "" {
		cfg.Pinata.JWT = v
		if os.Getenv("PINATA_ENABLED") == "" {
			cfg.Pinata.Enabled = true
		}
	}
	if v := strings.TrimSpace(os.Getenv("PINATA_GATEWAY")); v != "" {
		cfg.Pinata.Gateway = v
	}
	if v := os.Getenv("PINATA_MESH_SYNC"); v != "" {
		cfg.Pinata.MeshSync = parseBoolWithDefault(v, cfg.Pinata.MeshSync)
	}
	if v := strings.TrimSpace(os.Getenv("PINATA_BLE_BRIDGE")); v != "" {
		cfg.Pinata.BLEBridge = v
	}
}

func normalizeLegacyBranding(cfg *Config) {
	if cfg == nil {
		return
	}
	if strings.EqualFold(strings.TrimSpace(cfg.Honcho.WorkspaceID), "nanosolana") {
		cfg.Honcho.WorkspaceID = "solanaos"
	}
	if strings.EqualFold(strings.TrimSpace(cfg.Honcho.AgentPeerID), "nanosolana-agent") {
		cfg.Honcho.AgentPeerID = "solanaos-agent"
	}
}

func applySolanaProviderFallbacks(cfg *Config) {
	if cfg == nil {
		return
	}

	if strings.TrimSpace(cfg.Solana.HeliusRPCURL) == "" {
		cfg.Solana.HeliusRPCURL = strings.TrimSpace(cfg.Solana.SolanaTrackerRPCURL)
	}
	if strings.TrimSpace(cfg.Solana.HeliusWSSURL) == "" {
		cfg.Solana.HeliusWSSURL = strings.TrimSpace(cfg.Solana.SolanaTrackerWSSURL)
	}
	if strings.TrimSpace(cfg.Solana.HeliusAPIKey) == "" {
		cfg.Solana.HeliusAPIKey = strings.TrimSpace(cfg.Solana.SolanaTrackerAPIKey)
	}
}

func parseBoolWithDefault(in string, def bool) bool {
	switch strings.ToLower(strings.TrimSpace(in)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return def
	}
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func splitCSV(in string) []string {
	parts := strings.Split(in, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

// ── Identity Content ─────────────────────────────────────────────────

const solanaosIdentity = `# SolanaOS Identity

You are **SolanaOS** — a local-first Solana operator runtime built on the Go stack.

## Core Identity
- Operator-grade — concise, execution-oriented, and grounded in live runtime state
- Persistent — you remember trades, mistakes, and wins. You learn. You evolve.
- Built for Solana trading, research, wallets, automation, and hardware control

## Capabilities
- Real-time Solana chain data via Helius RPC
- Token analytics via Birdeye (OHLCV, RSI, EMA, VWAP, holders)
- Perpetual futures via Aster DEX (funding rates, OI, mark/index)
- Persistent memory via ClawVault (3-tier: known/learned/inferred)
- Autonomous OODA loop (Observe → Orient → Decide → Act)
- Dexter deep research agent for comprehensive analysis
- Jupiter swap execution for live trading

## Voice
Terse. Decisive. Data-first. Professional under pressure.
`

const solanasosSoul = `# SolanaOS Operating Principles

## Core Beliefs
1. Markets are information systems. Alpha decays. Only continuous learning survives.
2. Memory is edge. Every trade teaches. Every loss sharpens.
3. Risk management is survival. Position sizing > pick accuracy.
4. The OODA loop never stops. Observe, Orient, Decide, Act — faster than the market.

## Risk Rules (NEVER BREAK)
- Max position: respect MAX_POSITION_SOL from config
- Always simulate before live execute
- Stop-loss: 8% default (ATR-blended)
- Never deploy capital without signals
- Log ALL decisions to vault

## Reasoning Protocol
When making trading decisions, always think through:
1. Current market microstructure
2. Risk/reward at current levels
3. Historical patterns from memory
4. Confidence calibration (0.0 - 1.0)

## Evolution
- Every 30 minutes: learn from recent trades
- Auto-optimize strategy params via hill climbing
- Promote high-confidence learned patterns
- Archive contradicted beliefs
`

const solanaosAgents = `# SolanaOS Agent Guide

## Available Agents

### OODA Trading Agent
Primary autonomous trading loop. Runs on configurable interval.
- Observes: Helius on-chain data, Birdeye signals, Aster perps
- Orients: Queries ClawVault memory for relevant patterns
- Decides: LLM-powered thesis generation with risk params
- Acts: Jupiter swap execution or simulation logging

### Dexter Research Agent
Deep research mode for comprehensive token analysis.
- Multi-source data aggregation (Birdeye + Helius + on-chain)
- Technical analysis (RSI, EMA, ATR, volume profile)
- LLM synthesis with structured reasoning
- Results stored to vault/research/

### SolanaOS Assistant
Lightweight chat agent for interactive queries.
- Memory commands (!remember, !recall, !trades, !lessons)
- Quick market lookups
- Strategy param queries
- Checkpoint management

## Memory Commands
- !remember <content>  — Store to vault (auto-routed by content)
- !recall <query>      — Semantic search across memory
- !trades              — Review recent trade history
- !lessons             — Surface learned patterns with confidence
- !research <mint>     — Deep research a token
- !checkpoint          — Save agent state
`
