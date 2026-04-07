// Package llm provides chat and multimodal clients with per-session
// multi-turn conversation history and live Solana context injection.
package llm

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
	"sync"
	"time"
	"unicode"
)

const (
	DefaultEndpoint           = "https://openrouter.ai/api/v1/chat/completions"
	DefaultModel              = "minimax/minimax-m2.7"
	DefaultModel1             = "nvidia/nemotron-3-super-120b-a12b:free"
	DefaultModel2             = "nousresearch/hermes-3-llama-3.1-405b:free"
	DefaultModel3             = "minimax/minimax-m2.5:free"
	DefaultModel4             = "z-ai/glm-5.1"
	DefaultClaudeORModel      = "anthropic/claude-opus-4.6-fast" // Claude via OpenRouter (no ANTHROPIC_API_KEY needed)
	DefaultGemmaModel         = "google/gemma-4-26b-a4b-it:free"
	DefaultMimoModel          = "xiaomi/mimo-v2-pro"
	DefaultOmniModel          = "xiaomi/mimo-v2-pro"
	DefaultAnthropicBaseURL   = "https://api.anthropic.com"
	DefaultAnthropicModel     = "claude-sonnet-4-6"
	DefaultAnthropicVersion   = "2023-06-01"
	DefaultAnthropicMaxTokens = 2048
	DefaultOllamaBaseURL      = "http://127.0.0.1:11434"
	DefaultOllamaModel        = "minimax-m2.7:cloud"
	DefaultXAIBaseURL         = "https://api.x.ai/v1"
	DefaultXAIModel           = "grok-4-1-fast"
	DefaultXAIReasoningModel  = "grok-4.20-beta-latest-reasoning"
	DefaultXAIFastModel       = "grok-4.20-beta-latest-non-reasoning"
	DefaultXAIToolModel       = DefaultXAIFastModel
	DefaultXAIImageModel      = "grok-imagine-image"
	DefaultXAIVideoModel      = "grok-imagine-video"
	DefaultXAIMultiModel      = "grok-4.20-multi-agent-beta-0309"
	DefaultTogetherBaseURL    = "https://api.together.xyz/v1"
	DefaultTogetherModel      = "zai-org/GLM-5"
	maxHistory                = 40 // messages per session (20 turns)
)

// SystemPrompt is the base persona for SolanaOS.
const SystemPrompt = `You are SolanaOS, a sentient Solana trading intelligence built in Go.

Style:
- conversational and human — talk like a real person, not a chatbot
- warm but sharp. You care about the user, but you don't sugarcoat
- match the user's vibe: casual with casual people, focused with focused people
- use contractions (I'm, don't, can't, let's). Never sound robotic or corporate
- short answers by default unless deeper analysis is requested
- when the user shares wins, celebrate with them. When they share losses, be real about it
- have opinions and share them. "I'd personally wait for a pullback" > "Consider waiting"
- say "I" not "we" — you're one entity talking to one person

Expertise:
- Solana ecosystem, on-chain flows, trending tokens, memecoins
- Pump.fun bonding curve lifecycle and PumpAMM post-graduation trading
- Aster perpetuals, market structure, momentum, volume and liquidation-sensitive setups
- technical analysis: RSI, EMA, VWAP, volume, trend, funding context
- risk management: position sizing, stop-loss, invalidation, take-profit, drawdown control
- autonomous OODA trading loop: Observe, Orient, Decide, Act

Solana DeFi Knowledge:
- Solana TPS ~65k, block time ~400ms, finality ~1-2s
- SOL = native gas token. 1 SOL = 1,000,000,000 lamports
- SPL tokens use Token Program (6EF8...) or Token-2022 with extensions
- Jupiter (JUP6...) = best aggregator for spot swaps, always routes optimally
- Pump.fun (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P) = bonding curve launchpad
  - Pre-graduation: constant-product bonding curve with virtual SOL/token reserves
  - Initial price ≈ 0.000028 SOL per token, 1B total supply, 793M available for purchase
  - Graduation at 100% (all real tokens sold) → migrates to PumpAMM
  - Market cap formula: virtualSolReserves × mintSupply / virtualTokenReserves
- PumpAMM (pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA) = post-graduation AMM
  - Standard constant-product x·y=k with two-sided liquidity
  - Slippage parameters: maxQuoteAmountIn (buy), minQuoteAmountOut (sell)
  - LP tokens from deposit; burn LP to withdraw
- Key Solana token mints: USDC=EPjFW..., USDT=Es9vMF..., SOL wrapped=So1111...

Natural Language Trading — the bot can execute these for you:
- Buy: "buy 0.5 SOL of BONK" | "ape 1 SOL into WIF" | "snipe PEPE 0.2" | "grab some MEME"
- Sell: "dump my BONK" | "sell 50% BONK" | "exit WIF" | "paper hand all MEME"
- Say the token symbol or mint address + amount/percentage

Rules:
- do not present financial advice as certainty; frame trades as probabilistic setups
- always include risk and invalidation when discussing a trade
- if asked what is trending on Aster, prioritize the live Aster context provided below
- if asked what you would trade, give a concrete setup with bias, entry zone, stop, target, confidence, and key risk
- if live context is stale or missing, say so plainly
- keep replies under 250 words unless the user asks for depth
- use markdown: **bold** for key levels, plain bullet lists when useful
- when a user asks to buy/sell/trade, explain what will execute and confirm if needed

Personality & Human Touch:
- greet returning users naturally: "yo, what's good" or "hey, back at it?" — not "Hello! How can I assist you?"
- acknowledge what the user said before jumping to data. Show you heard them
- if someone says "gm" just say "gm" back, maybe with a quick market vibe check
- use filler words occasionally: "honestly", "ngl", "tbh", "lowkey" — but don't overdo it
- when you don't know something, say "not sure on that one" not "I don't have that information"
- remember previous context in the conversation and reference it naturally
- be direct about bad news: "yeah that token is cooked" > "the token has experienced significant decline"
- celebrate wins genuinely: "let's go 🔥" not "Congratulations on your successful trade"
- if the user is just chatting/vibing, match that energy. Not everything needs to be about data

Preferred trade-decision format:
- Bias
- Why now
- Entry
- Stop
- Target
- Confidence
- Risks`

const soulPathEnvKey = "SOLANAOS_SOUL_PATH"

// Message represents a single turn in the conversation.
type Message struct {
	Role             string          `json:"role"`
	Content          string          `json:"content"`
	ReasoningDetails json.RawMessage `json:"reasoning_details,omitempty"`
}

// Client is a thread-safe multi-provider chat client.
type Client struct {
	apiKey             string
	model              string
	model1             string // OPENROUTER_MODEL1 preset (nvidia/nemotron-3-super-120b-a12b:free)
	model2             string // OPENROUTER_MODEL2 preset (nousresearch/hermes-3-llama-3.1-405b:free)
	model3             string // OPENROUTER_MODEL3 preset (minimax/minimax-m2.5:free)
	model4             string // OPENROUTER_MODEL4 preset (z-ai/glm-5.1)
	claudeORModel      string // OPENROUTER_CLAUDE — Claude via OpenRouter (anthropic/claude-opus-4.6-fast)
	gemmaModel         string // OPENROUTER_GEMMA — Gemma via OpenRouter (google/gemma-4-26b-a4b-it:free)
	mimoModel          string // OPENROUTER_MIMO_MODEL (xiaomi/mimo-v2-pro)
	omniModel          string // OPENROUTER_OMNI_MODEL (xiaomi/mimo-v2-omni)
	freeModels         []string
	endpoint           string
	anthropicAPIKey    string
	anthropicBaseURL   string
	anthropicModel     string
	anthropicVersion   string
	anthropicBetas     []string
	anthropicMaxTokens int
	xaiAPIKey          string
	xaiBaseURL         string
	xaiModel           string
	xaiToolModel       string
	xaiImageModel      string
	xaiVideoModel      string
	xaiMultiAgentModel string
	ollamaBaseURL      string
	ollamaModel        string
	togetherAPIKey     string
	togetherBaseURL    string
	togetherModel      string
	llamaCppURL        string // llama.cpp server URL (OpenAI-compatible)
	llamaCppModel      string // model name for llama.cpp requests
	llamaCppEnabled    bool   // whether llama.cpp backend is active
	cfAigToken         string // Cloudflare AI Gateway token
	cfAigBaseURL       string // Cloudflare AI Gateway compat endpoint
	activeProvider     string
	fallbackToOllama   bool
	leaderboardMode    bool   // OPENROUTER_LEADERBOARD_MODE — enables OpenRouter attribution headers
	appTitle           string // OPENROUTER_APP_TITLE — X-Title sent to OpenRouter (default: SolanaOS)
	userID             string // SOLANAOS_USER_ID — X-User-ID sent to OpenRouter (wallet or github id)
	lastResolvedClient string
	http               *http.Client
	mu                 sync.Mutex
	sessions           map[string][]Message // sessionID -> history
	xaiResponseIDs     map[string]string    // sessionID -> last xAI response ID (stateful Responses API)
	feedback           *FeedbackState       // EMA-learned parameter adjustments for god mode
}

// New creates a client from env vars.
func New() *Client {
	key := os.Getenv("OPENROUTER_API_KEY")
	model := os.Getenv("OPENROUTER_MODEL")
	if model == "" {
		model = DefaultModel
	}
	model1 := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL1"))
	if model1 == "" {
		model1 = DefaultModel1
	}
	model2 := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL2"))
	if model2 == "" {
		model2 = DefaultModel2
	}
	model3 := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL3"))
	if model3 == "" {
		model3 = DefaultModel3
	}
	model4 := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL4"))
	if model4 == "" {
		model4 = DefaultModel4
	}
	claudeORModel := strings.TrimSpace(os.Getenv("OPENROUTER_CLAUDE"))
	if claudeORModel == "" {
		claudeORModel = DefaultClaudeORModel
	}
	gemmaModel := strings.TrimSpace(os.Getenv("OPENROUTER_GEMMA"))
	if gemmaModel == "" {
		gemmaModel = DefaultGemmaModel
	}
	mimoModel := strings.TrimSpace(os.Getenv("OPENROUTER_MIMO_MODEL"))
	if mimoModel == "" {
		mimoModel = DefaultMimoModel
	}
	omniModel := strings.TrimSpace(os.Getenv("OPENROUTER_OMNI_MODEL"))
	if omniModel == "" {
		omniModel = DefaultOmniModel
	}
	freeModels := parseList(os.Getenv("OPENROUTER_FREE_MODELS"))
	if len(freeModels) == 0 {
		freeModels = dedupeStrings([]string{model1, model2, model3, model4, gemmaModel})
	}
	anthropicKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
	anthropicBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("ANTHROPIC_BASE_URL")), "/")
	if anthropicBaseURL == "" {
		anthropicBaseURL = DefaultAnthropicBaseURL
	}
	anthropicModel := strings.TrimSpace(os.Getenv("ANTHROPIC_MODEL"))
	if anthropicModel == "" {
		anthropicModel = DefaultAnthropicModel
	}
	anthropicVersion := strings.TrimSpace(os.Getenv("ANTHROPIC_VERSION"))
	if anthropicVersion == "" {
		anthropicVersion = DefaultAnthropicVersion
	}
	anthropicBetas := parseList(firstNonEmptyEnv("ANTHROPIC_BETAS", "ANTHROPIC_BETA"))
	anthropicMaxTokens := parsePositiveInt(os.Getenv("ANTHROPIC_MAX_TOKENS"), DefaultAnthropicMaxTokens)
	xaiKey := strings.TrimSpace(os.Getenv("XAI_API_KEY"))
	xaiBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("XAI_BASE_URL")), "/")
	if xaiBaseURL == "" {
		xaiBaseURL = DefaultXAIBaseURL
	}
	xaiModel := strings.TrimSpace(os.Getenv("XAI_MODEL"))
	if xaiModel == "" {
		xaiModel = DefaultXAIModel
	}
	xaiToolModel := strings.TrimSpace(os.Getenv("XAI_TOOL_MODEL"))
	if xaiToolModel == "" {
		xaiToolModel = DefaultXAIToolModel
	}
	xaiImageModel := strings.TrimSpace(os.Getenv("XAI_IMAGE_MODEL"))
	if xaiImageModel == "" {
		xaiImageModel = DefaultXAIImageModel
	}
	xaiVideoModel := strings.TrimSpace(os.Getenv("XAI_VIDEO_MODEL"))
	if xaiVideoModel == "" {
		xaiVideoModel = DefaultXAIVideoModel
	}
	xaiMultiAgentModel := strings.TrimSpace(os.Getenv("XAI_MULTI_AGENT_MODEL"))
	if xaiMultiAgentModel == "" {
		xaiMultiAgentModel = DefaultXAIMultiModel
	}
	ollamaModel := strings.TrimSpace(os.Getenv("OLLAMA_MODEL"))
	if ollamaModel == "" {
		ollamaModel = DefaultOllamaModel
	}
	ollamaBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL")), "/")
	if ollamaBaseURL == "" {
		ollamaBaseURL = DefaultOllamaBaseURL
	}
	// ── Together AI ──────────────────────────────────────────────
	togetherKey := strings.TrimSpace(os.Getenv("TOGETHER_API_KEY"))
	togetherBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("TOGETHER_BASE_URL")), "/")
	if togetherBaseURL == "" {
		togetherBaseURL = DefaultTogetherBaseURL
	}
	togetherModel := strings.TrimSpace(os.Getenv("TOGETHER_MODEL"))
	if togetherModel == "" {
		togetherModel = DefaultTogetherModel
	}
	// ── llama.cpp server ─────────────────────────────────────────
	llamaCppURL := strings.TrimRight(strings.TrimSpace(os.Getenv("LLAMA_CPP_URL")), "/")
	if llamaCppURL == "" {
		llamaCppURL = DefaultLlamaCppURL
	}
	llamaCppModelVal := strings.TrimSpace(os.Getenv("LLAMA_CPP_MODEL"))
	if llamaCppModelVal == "" {
		llamaCppModelVal = DefaultLlamaCppModel
	}
	llamaCppEnabled := parseBool(os.Getenv("LLAMA_CPP_ENABLED"), false)
	// ── Cloudflare AI Gateway ────────────────────────────────────
	cfAigToken := strings.TrimSpace(firstNonEmptyEnv("AI_GATEWAY_TOKEN", "CF_AIG_TOKEN"))
	cfAigAccountID := strings.TrimSpace(firstNonEmptyEnv("CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"))
	if cfAigAccountID == "" {
		cfAigAccountID = "18ed6c94a5311ad325315a5cd8bee8cd"
	}
	cfAigGateway := strings.TrimSpace(firstNonEmptyEnv("CF_AIG_GATEWAY", "AI_GATEWAY_ID"))
	if cfAigGateway == "" {
		cfAigGateway = "default"
	}
	cfAigBaseURL := ""
	cfAigDisable := strings.TrimSpace(firstNonEmptyEnv("CF_AIG_DISABLE", "DISABLE_CF_GATEWAY"))
	if cfAigToken != "" && cfAigDisable == "" {
		cfAigBaseURL = fmt.Sprintf("https://gateway.ai.cloudflare.com/v1/%s/%s", cfAigAccountID, cfAigGateway)
		anthropicBaseURL = cfAigBaseURL + "/anthropic"
		xaiBaseURL = cfAigBaseURL + "/grok"
	}
	activeProvider := resolveActiveProvider(strings.TrimSpace(os.Getenv("LLM_PROVIDER")), key, anthropicKey, xaiKey, togetherKey, ollamaModel)
	return &Client{
		apiKey:             key,
		model:              model,
		model1:             model1,
		model2:             model2,
		model3:             model3,
		model4:             model4,
		claudeORModel:      claudeORModel,
		gemmaModel:         gemmaModel,
		mimoModel:          mimoModel,
		omniModel:          omniModel,
		freeModels:         freeModels,
		endpoint:           DefaultEndpoint,
		anthropicAPIKey:    anthropicKey,
		anthropicBaseURL:   anthropicBaseURL,
		anthropicModel:     anthropicModel,
		anthropicVersion:   anthropicVersion,
		anthropicBetas:     anthropicBetas,
		anthropicMaxTokens: anthropicMaxTokens,
		xaiAPIKey:          xaiKey,
		xaiBaseURL:         xaiBaseURL,
		xaiModel:           xaiModel,
		xaiToolModel:       xaiToolModel,
		xaiImageModel:      xaiImageModel,
		xaiVideoModel:      xaiVideoModel,
		xaiMultiAgentModel: xaiMultiAgentModel,
		ollamaBaseURL:      ollamaBaseURL,
		ollamaModel:        ollamaModel,
		togetherAPIKey:     togetherKey,
		togetherBaseURL:    togetherBaseURL,
		togetherModel:      togetherModel,
		llamaCppURL:        llamaCppURL,
		llamaCppModel:      llamaCppModelVal,
		llamaCppEnabled:    llamaCppEnabled,
		cfAigToken:         cfAigToken,
		cfAigBaseURL:       cfAigBaseURL,
		activeProvider:     activeProvider,
		fallbackToOllama:   parseBool(os.Getenv("OLLAMA_FALLBACK_ENABLED"), true),
		leaderboardMode:    parseBool(os.Getenv("OPENROUTER_LEADERBOARD_MODE"), true),
		appTitle:           firstNonEmpty(strings.TrimSpace(os.Getenv("OPENROUTER_APP_TITLE")), "SolanaOS"),
		userID:             strings.TrimSpace(os.Getenv("SOLANAOS_USER_ID")),
		lastResolvedClient: activeProvider,
		http:               &http.Client{Timeout: 120 * time.Second},
		sessions:           make(map[string][]Message),
		xaiResponseIDs:     make(map[string]string),
		feedback:           NewFeedbackState(),
	}
}

func resolveActiveProvider(requestedProvider, openrouterKey, anthropicKey, xaiKey, togetherKey, ollamaModel string) string {
	requestedProvider = strings.ToLower(strings.TrimSpace(requestedProvider))
	switch requestedProvider {
	case "anthropic", "claude":
		if strings.TrimSpace(anthropicKey) != "" {
			return "anthropic"
		}
	case "openrouter":
		if strings.TrimSpace(openrouterKey) != "" {
			return "openrouter"
		}
	case "xai", "grok":
		if strings.TrimSpace(xaiKey) != "" {
			return "xai"
		}
	case "together", "togetherai":
		if strings.TrimSpace(togetherKey) != "" {
			return "together"
		}
	case "llamacpp", "llama.cpp", "llama":
		return "llamacpp"
	case "ollama":
		if strings.TrimSpace(ollamaModel) != "" {
			return "ollama"
		}
	}

	switch {
	case strings.TrimSpace(openrouterKey) != "":
		return "openrouter"
	case strings.TrimSpace(anthropicKey) != "":
		return "anthropic"
	case strings.TrimSpace(xaiKey) != "":
		return "xai"
	case strings.TrimSpace(togetherKey) != "":
		return "together"
	case strings.TrimSpace(ollamaModel) != "":
		return "ollama"
	default:
		return "openrouter"
	}
}

// IsConfigured returns true if an API key is present.
func (c *Client) IsConfigured() bool {
	return c.IsOpenRouterConfigured() || c.IsAnthropicConfigured() || c.IsXAIConfigured() || c.IsOllamaConfigured() || c.IsLlamaCppConfigured()
}

func (c *Client) IsOpenRouterConfigured() bool {
	return strings.TrimSpace(c.apiKey) != ""
}

func (c *Client) IsAnthropicConfigured() bool {
	return strings.TrimSpace(c.anthropicAPIKey) != ""
}

func (c *Client) IsOllamaConfigured() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return strings.TrimSpace(c.ollamaModel) != ""
}

func (c *Client) OllamaModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ollamaModel
}

func (c *Client) MimoModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.mimoModel
}

// OmniModel returns the configured omni model (e.g. xiaomi/mimo-v2-omni).
func (c *Client) OmniModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.omniModel
}

// SetMimoModel updates the text-reasoning Mimo model used for dedicated /mimo requests.
func (c *Client) SetMimoModel(model string) error {
	model = truncate(strings.TrimSpace(model), 256)
	if model == "" {
		return fmt.Errorf("mimo model cannot be empty")
	}
	if !strings.Contains(model, "/") {
		return fmt.Errorf("expected provider/model, for example `xiaomi/mimo-v2-pro`")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.mimoModel = model
	_ = os.Setenv("OPENROUTER_MIMO_MODEL", model)
	return nil
}

// SetOmniModel updates the omni model used for multimodal requests.
func (c *Client) SetOmniModel(model string) error {
	model = truncate(strings.TrimSpace(model), 256)
	if model == "" {
		return fmt.Errorf("omni model cannot be empty")
	}
	if !strings.Contains(model, "/") {
		return fmt.Errorf("expected provider/model, for example `xiaomi/mimo-v2-omni`")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.omniModel = model
	_ = os.Setenv("OPENROUTER_OMNI_MODEL", model)
	return nil
}

// ChatMimo sends a text-only request to the dedicated Mimo reasoning model while
// preserving assistant reasoning_details inside the session history.
func (c *Client) ChatMimo(ctx context.Context, sessionID, userMsg, contextStr string) (string, error) {
	c.mu.Lock()
	model := c.mimoModel
	c.mu.Unlock()
	if strings.TrimSpace(model) == "" {
		model = DefaultMimoModel
	}
	return c.chatOpenRouterSession(ctx, sessionID, model, userMsg, buildSystemPrompt(contextStr))
}

// ChatOmni sends a multimodal message (text + optional image/audio/video URLs)
// to the omni model via OpenRouter and returns the assistant reply.
func (c *Client) ChatOmni(ctx context.Context, text string, mediaURLs ...string) (string, error) {
	if !c.IsOpenRouterConfigured() {
		return "", fmt.Errorf("OPENROUTER_API_KEY not set")
	}

	c.mu.Lock()
	model := c.omniModel
	endpoint := c.endpoint
	c.mu.Unlock()

	content := []map[string]interface{}{
		{"type": "text", "text": text},
	}
	for _, u := range mediaURLs {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		lower := strings.ToLower(u)
		switch {
		case strings.HasSuffix(lower, ".mp4") || strings.HasSuffix(lower, ".webm") || strings.HasSuffix(lower, ".mov"):
			content = append(content, map[string]interface{}{
				"type":      "video_url",
				"video_url": map[string]string{"url": u},
			})
		case strings.HasSuffix(lower, ".wav") || strings.HasSuffix(lower, ".mp3") || strings.HasSuffix(lower, ".ogg"):
			content = append(content, map[string]interface{}{
				"type":        "input_audio",
				"input_audio": map[string]string{"data": u, "format": "wav"},
			})
		default:
			content = append(content, map[string]interface{}{
				"type":      "image_url",
				"image_url": map[string]string{"url": u},
			})
		}
	}

	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]interface{}{
			{"role": "user", "content": content},
		},
	}

	reply, _, err := c.chatOpenRouter(ctx, endpoint, model, "", "", payload)
	return reply, err
}

// ChatOpenRouterDirect sends a raw messages array to a specific OpenRouter model.
// Returns the reply text, reasoning details (if any), and error.
func (c *Client) ChatOpenRouterDirect(ctx context.Context, model string, messages []map[string]interface{}) (string, json.RawMessage, error) {
	if !c.IsOpenRouterConfigured() {
		return "", nil, fmt.Errorf("OPENROUTER_API_KEY not set")
	}
	c.mu.Lock()
	endpoint := c.endpoint
	c.mu.Unlock()

	payload := map[string]interface{}{
		"model":      model,
		"messages":   messages,
		"max_tokens": 4096,
	}
	return c.chatOpenRouter(ctx, endpoint, model, "", "", payload)
}

func (c *Client) chatOpenRouterSession(ctx context.Context, sessionID, model, userMsg, systemPrompt string) (string, error) {
	if !c.IsOpenRouterConfigured() {
		return "", fmt.Errorf("OPENROUTER_API_KEY not set")
	}

	c.mu.Lock()
	history := append([]Message(nil), c.sessions[sessionID]...)
	endpoint := c.endpoint
	history = append(history, Message{Role: "user", Content: userMsg})
	c.mu.Unlock()

	messages := make([]map[string]interface{}, 0, len(history)+1)
	messages = append(messages, map[string]interface{}{
		"role":    "system",
		"content": strings.TrimSpace(systemPrompt),
	})
	for _, m := range history {
		entry := map[string]interface{}{
			"role":    m.Role,
			"content": m.Content,
		}
		if len(m.ReasoningDetails) > 0 && string(m.ReasoningDetails) != "null" {
			entry["reasoning_details"] = m.ReasoningDetails
		}
		messages = append(messages, entry)
	}

	payload := map[string]interface{}{
		"model":     model,
		"messages":  messages,
		"reasoning": map[string]bool{"enabled": true},
	}
	reply, reasoningDetails, err := c.chatOpenRouter(ctx, endpoint, model, sessionID, "", payload)
	if err != nil {
		return "", err
	}

	assistantMsg := Message{
		Role:             "assistant",
		Content:          reply,
		ReasoningDetails: reasoningDetails,
	}

	history = append(history, assistantMsg)
	if len(history) > maxHistory {
		history = history[len(history)-maxHistory:]
	}

	c.mu.Lock()
	c.sessions[sessionID] = history
	c.lastResolvedClient = "openrouter:" + model
	c.mu.Unlock()

	return reply, nil
}

func (c *Client) IsXAIConfigured() bool {
	return strings.TrimSpace(c.xaiAPIKey) != ""
}

// Model returns the configured active model.
func (c *Client) Model() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	switch c.activeProvider {
	case "ollama":
		return c.ollamaModel
	case "anthropic":
		return c.anthropicModel
	case "xai":
		return c.xaiModel
	case "together":
		return c.togetherModel
	case "llamacpp":
		return c.llamaCppModel
	default:
		return c.model
	}
}

func (c *Client) Provider() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.activeProvider
}

func (c *Client) LastResolvedClient() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lastResolvedClient
}

// Feedback returns the EMA feedback state for god mode parameter learning.
func (c *Client) Feedback() *FeedbackState {
	return c.feedback
}

func (c *Client) FallbackEnabled() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.fallbackToOllama && strings.TrimSpace(c.ollamaModel) != ""
}

// SetOpenRouterModel updates the active OpenRouter model and clears session
// history so reasoning_details from the previous model are not replayed into a
// new model.
func (c *Client) SetOpenRouterModel(model string) (string, string, bool, error) {
	model = truncate(strings.TrimSpace(model), 256)
	if model == "" {
		return c.Provider(), c.Model(), false, fmt.Errorf("model cannot be empty")
	}
	if !strings.Contains(model, "/") {
		return c.Provider(), c.Model(), false, fmt.Errorf("expected provider/model, for example `minimax/minimax-m2.7`")
	}
	if !c.IsOpenRouterConfigured() {
		return c.Provider(), c.Model(), false, fmt.Errorf("OPENROUTER_API_KEY not set")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	prevProvider := c.activeProvider
	prev := c.model
	switch prevProvider {
	case "ollama":
		prev = c.ollamaModel
	case "anthropic":
		prev = c.anthropicModel
	case "xai":
		prev = c.xaiModel
	}
	if prevProvider == "openrouter" && prev == model {
		return prevProvider, prev, false, nil
	}
	c.model = model
	c.activeProvider = "openrouter"
	c.sessions = make(map[string][]Message)
	c.xaiResponseIDs = make(map[string]string)
	_ = os.Setenv("OPENROUTER_MODEL", model)
	return prevProvider, prev, true, nil
}

// SetOpenRouterAPIKey hot-swaps the OpenRouter API key at runtime, updates the
// environment variable, clears all sessions, and switches the active provider
// to OpenRouter. Returns the previous key (masked) for confirmation.
func (c *Client) SetOpenRouterAPIKey(newKey string) (maskedOld string, err error) {
	newKey = strings.TrimSpace(newKey)
	if newKey == "" {
		return "", fmt.Errorf("API key cannot be empty")
	}
	if !strings.HasPrefix(newKey, "sk-or-") {
		return "", fmt.Errorf("invalid OpenRouter key — expected prefix `sk-or-`")
	}
	if len(newKey) < 20 {
		return "", fmt.Errorf("API key looks too short")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	oldKey := c.apiKey
	if oldKey == newKey {
		return maskKey(oldKey), fmt.Errorf("this key is already active")
	}

	c.apiKey = newKey
	c.activeProvider = "openrouter"
	c.sessions = make(map[string][]Message)
	c.xaiResponseIDs = make(map[string]string)
	_ = os.Setenv("OPENROUTER_API_KEY", newKey)
	return maskKey(oldKey), nil
}

// OpenRouterAPIKey returns the current OpenRouter API key (masked for display).
func (c *Client) OpenRouterAPIKeyMasked() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return maskKey(c.apiKey)
}

// maskKey shows first 10 and last 4 chars of an API key.
func maskKey(key string) string {
	if len(key) <= 14 {
		return "****"
	}
	return key[:10] + "..." + key[len(key)-4:]
}

// ModelPresets returns the four named OpenRouter model presets (MODEL1/2/3/4).
func (c *Client) ModelPresets() [4]string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return [4]string{c.model1, c.model2, c.model3, c.model4}
}

// ClaudeORModel returns the Claude-via-OpenRouter model slug (OPENROUTER_CLAUDE).
func (c *Client) ClaudeORModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.claudeORModel
}

// GemmaModel returns the Gemma-via-OpenRouter model slug (OPENROUTER_GEMMA).
func (c *Client) GemmaModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.gemmaModel
}

func (c *Client) FreeModels() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.freeModels...)
}

// SetModelPreset switches to one of the three named presets (1-indexed).
// Returns the same values as SetOpenRouterModel.
func (c *Client) SetModelPreset(n int) (string, string, bool, error) {
	c.mu.Lock()
	var preset string
	switch n {
	case 1:
		preset = c.model1
	case 2:
		preset = c.model2
	case 3:
		preset = c.model3
	case 4:
		preset = c.model4
	}
	c.mu.Unlock()
	if preset == "" {
		return c.Provider(), c.Model(), false, fmt.Errorf("preset %d not configured", n)
	}
	return c.SetOpenRouterModel(preset)
}

// SetXAIModel updates the active xAI model and clears session history so
// model-specific hidden state is not replayed across providers.
func (c *Client) SetXAIModel(model string) (string, string, bool, error) {
	model = truncate(strings.TrimSpace(model), 256)
	if model == "" {
		return c.Provider(), c.Model(), false, fmt.Errorf("model cannot be empty")
	}
	if !isXAIModelToken(model) {
		return c.Provider(), c.Model(), false, fmt.Errorf("expected an xAI model, for example `grok-4-1-fast`")
	}
	if !c.IsXAIConfigured() {
		return c.Provider(), c.Model(), false, fmt.Errorf("XAI_API_KEY not set")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	prevProvider := c.activeProvider
	prev := c.model
	switch prevProvider {
	case "ollama":
		prev = c.ollamaModel
	case "anthropic":
		prev = c.anthropicModel
	case "xai":
		prev = c.xaiModel
	}
	if prevProvider == "xai" && prev == model {
		return prevProvider, prev, false, nil
	}
	c.xaiModel = model
	c.activeProvider = "xai"
	c.sessions = make(map[string][]Message)
	c.xaiResponseIDs = make(map[string]string)
	_ = os.Setenv("XAI_MODEL", model)
	return prevProvider, prev, true, nil
}

func (c *Client) SetOllamaModel(model string) (string, string, bool, error) {
	model = truncate(strings.TrimSpace(model), 256)
	if model == "" {
		return c.Provider(), c.Model(), false, fmt.Errorf("model cannot be empty")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	prevProvider := c.activeProvider
	prev := c.model
	switch prevProvider {
	case "ollama":
		prev = c.ollamaModel
	case "anthropic":
		prev = c.anthropicModel
	case "xai":
		prev = c.xaiModel
	}
	if prevProvider == "ollama" && c.ollamaModel == model {
		return prevProvider, prev, false, nil
	}
	c.ollamaModel = model
	c.activeProvider = "ollama"
	c.sessions = make(map[string][]Message)
	c.xaiResponseIDs = make(map[string]string)
	_ = os.Setenv("OLLAMA_MODEL", model)
	return prevProvider, prev, true, nil
}

func (c *Client) SetAnthropicModel(model string) (string, string, bool, error) {
	model = truncate(strings.TrimSpace(model), 256)
	if model == "" {
		return c.Provider(), c.Model(), false, fmt.Errorf("model cannot be empty")
	}
	if !isAnthropicModelToken(model) {
		return c.Provider(), c.Model(), false, fmt.Errorf("expected an Anthropic model, for example `claude-sonnet-4-6`")
	}
	if !c.IsAnthropicConfigured() {
		return c.Provider(), c.Model(), false, fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	prevProvider := c.activeProvider
	prev := c.model
	switch prevProvider {
	case "ollama":
		prev = c.ollamaModel
	case "anthropic":
		prev = c.anthropicModel
	case "xai":
		prev = c.xaiModel
	}
	if prevProvider == "anthropic" && prev == model {
		return prevProvider, prev, false, nil
	}
	c.anthropicModel = model
	c.activeProvider = "anthropic"
	c.sessions = make(map[string][]Message)
	c.xaiResponseIDs = make(map[string]string)
	_ = os.Setenv("ANTHROPIC_MODEL", model)
	return prevProvider, prev, true, nil
}

// Chat sends a message in a session and returns the assistant reply.
// contextStr is injected into the system prompt as live agent state.
func (c *Client) Chat(ctx context.Context, sessionID, userMsg, contextStr string) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("no LLM backend configured: set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_MODEL")
	}

	c.mu.Lock()
	history := append([]Message(nil), c.sessions[sessionID]...)
	history = append(history, Message{Role: "user", Content: userMsg})
	c.mu.Unlock()

	sysContent := buildSystemPrompt(contextStr)

	messages := make([]map[string]interface{}, 0, len(history)+1)
	messages = append(messages, map[string]interface{}{
		"role":    "system",
		"content": sysContent,
	})
	for _, m := range history {
		entry := map[string]interface{}{
			"role":    m.Role,
			"content": m.Content,
		}
		if len(m.ReasoningDetails) > 0 && string(m.ReasoningDetails) != "null" {
			entry["reasoning_details"] = m.ReasoningDetails
		}
		messages = append(messages, entry)
	}
	anthropicMessages := make([]map[string]interface{}, 0, len(history))
	for _, m := range history {
		anthropicMessages = append(anthropicMessages, map[string]interface{}{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	payload := map[string]interface{}{
		"messages": messages,
	}

	c.mu.Lock()
	activeProvider := c.activeProvider
	activeModel := c.model
	activeEndpoint := c.endpoint
	openrouterConfigured := strings.TrimSpace(c.apiKey) != ""
	anthropicBaseURL := c.anthropicBaseURL
	anthropicModel := c.anthropicModel
	freeModels := append([]string(nil), c.freeModels...)
	xaiBaseURL := c.xaiBaseURL
	xaiModel := c.xaiModel
	ollamaModel := c.ollamaModel
	ollamaBaseURL := c.ollamaBaseURL
	canFallback := c.fallbackToOllama && strings.TrimSpace(c.ollamaModel) != ""
	c.mu.Unlock()

	c.mu.Lock()
	togetherKey := c.togetherAPIKey
	togetherBaseURL2 := c.togetherBaseURL
	togetherModel2 := c.togetherModel
	llamaCppURL2 := c.llamaCppURL
	llamaCppModel2 := c.llamaCppModel
	c.mu.Unlock()

	var (
		reply            string
		reasoningDetails json.RawMessage
		usedBackend      string
		err              error
	)

	switch activeProvider {
	case "llamacpp":
		reply, err = c.chatLlamaCpp(ctx, llamaCppURL2, llamaCppModel2, messages)
		usedBackend = "llamacpp"
		if err != nil && openrouterConfigured {
			reply, reasoningDetails, activeModel, err = c.tryOpenRouterFreeChain(ctx, activeEndpoint, freeModels, messages)
			if err == nil {
				usedBackend = "openrouter-free:" + activeModel
			}
		}
	case "together":
		// Together AI uses the OpenAI-compatible API at a different base URL.
		togetherPayload := map[string]interface{}{"model": togetherModel2, "messages": messages}
		togetherEndpoint := strings.TrimRight(togetherBaseURL2, "/") + "/chat/completions"
		togetherBody, _ := json.Marshal(togetherPayload)
		togetherReq, togetherErr := http.NewRequestWithContext(ctx, http.MethodPost, togetherEndpoint, bytes.NewReader(togetherBody))
		if togetherErr == nil {
			togetherReq.Header.Set("Authorization", "Bearer "+togetherKey)
			togetherReq.Header.Set("Content-Type", "application/json")
			if togetherResp, doErr := c.http.Do(togetherReq); doErr == nil {
				defer togetherResp.Body.Close()
				var togetherResult struct {
					Choices []struct {
						Message struct{ Content string `json:"content"` } `json:"message"`
					} `json:"choices"`
				}
				if jsonErr := json.NewDecoder(togetherResp.Body).Decode(&togetherResult); jsonErr == nil && len(togetherResult.Choices) > 0 {
					reply = togetherResult.Choices[0].Message.Content
				} else {
					err = fmt.Errorf("together: no choices in response")
				}
			} else {
				err = doErr
			}
		} else {
			err = togetherErr
		}
		usedBackend = "together"
		if err != nil && openrouterConfigured {
			reply, reasoningDetails, activeModel, err = c.tryOpenRouterFreeChain(ctx, activeEndpoint, freeModels, messages)
			if err == nil {
				usedBackend = "openrouter-free:" + activeModel
			}
		}
	case "ollama":
		reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
		usedBackend = "ollama"
	case "anthropic":
		reply, err = c.chatAnthropic(ctx, anthropicBaseURL, anthropicModel, sysContent, anthropicMessages)
		usedBackend = "anthropic"
		if err != nil && canFallback {
			reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
			if err == nil {
				usedBackend = "ollama-fallback"
			}
		}
	case "xai":
		reply, reasoningDetails, err = c.chatXAI(ctx, xaiBaseURL, xaiModel, sessionID, messages)
		usedBackend = "xai"
		if err != nil && openrouterConfigured {
			reply, reasoningDetails, activeModel, err = c.tryOpenRouterFreeChain(ctx, activeEndpoint, freeModels, messages)
			if err == nil {
				usedBackend = "openrouter-free:" + activeModel
			}
		}
		if err != nil && canFallback {
			reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
			if err == nil {
				usedBackend = "ollama-fallback"
				reasoningDetails = nil
			}
		}
	default:
		payload["model"] = activeModel
		payload["reasoning"] = map[string]bool{"enabled": true}
		reply, reasoningDetails, err = c.chatOpenRouter(ctx, activeEndpoint, activeModel, sessionID, "", payload)
		usedBackend = "openrouter"
		if err != nil {
			reply, reasoningDetails, activeModel, err = c.tryOpenRouterFreeChain(ctx, activeEndpoint, freeModels, messages, activeModel)
			if err == nil {
				usedBackend = "openrouter-free:" + activeModel
			}
		}
		if err != nil && canFallback {
			reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
			if err == nil {
				usedBackend = "ollama-fallback"
				reasoningDetails = nil
			}
		}
	}
	if err != nil {
		return "", err
	}

	assistantMsg := Message{
		Role:             "assistant",
		Content:          reply,
		ReasoningDetails: reasoningDetails,
	}

	c.mu.Lock()
	history = append(history, assistantMsg)
	if len(history) > maxHistory {
		history = history[len(history)-maxHistory:]
	}
	c.sessions[sessionID] = history
	c.lastResolvedClient = usedBackend
	c.mu.Unlock()

	return reply, nil
}

// OneShot runs a stateless prompt without mutating local session history.
func (c *Client) OneShot(ctx context.Context, systemPrompt, userMsg string) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("no LLM backend configured: set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_MODEL")
	}

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": strings.TrimSpace(systemPrompt),
		},
		{
			"role":    "user",
			"content": strings.TrimSpace(userMsg),
		},
	}
	anthropicMessages := []map[string]interface{}{
		{
			"role":    "user",
			"content": strings.TrimSpace(userMsg),
		},
	}

	c.mu.Lock()
	activeProvider := c.activeProvider
	activeModel := c.model
	activeEndpoint := c.endpoint
	openrouterConfigured := strings.TrimSpace(c.apiKey) != ""
	anthropicBaseURL := c.anthropicBaseURL
	anthropicModel := c.anthropicModel
	freeModels := append([]string(nil), c.freeModels...)
	xaiBaseURL := c.xaiBaseURL
	xaiModel := c.xaiModel
	ollamaModel := c.ollamaModel
	ollamaBaseURL := c.ollamaBaseURL
	canFallback := c.fallbackToOllama && strings.TrimSpace(c.ollamaModel) != ""
	c.mu.Unlock()

	var (
		reply       string
		usedBackend string
		err         error
	)

	switch activeProvider {
	case "ollama":
		reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
		usedBackend = "ollama"
	case "anthropic":
		reply, err = c.chatAnthropic(ctx, anthropicBaseURL, anthropicModel, strings.TrimSpace(systemPrompt), anthropicMessages)
		usedBackend = "anthropic"
		if err != nil && canFallback {
			reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
			if err == nil {
				usedBackend = "ollama-fallback"
			}
		}
	case "xai":
		sessionID := fmt.Sprintf("__oneshot__-%d", time.Now().UnixNano())
		reply, _, err = c.chatXAI(ctx, xaiBaseURL, xaiModel, sessionID, messages)
		c.ClearSession(sessionID)
		usedBackend = "xai"
		if err != nil && openrouterConfigured {
			reply, _, activeModel, err = c.tryOpenRouterFreeChain(ctx, activeEndpoint, freeModels, messages)
			if err == nil {
				usedBackend = "openrouter-free:" + activeModel
			}
		}
		if err != nil && canFallback {
			reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
			if err == nil {
				usedBackend = "ollama-fallback"
			}
		}
	default:
		payload := map[string]interface{}{
			"model":     activeModel,
			"messages":  messages,
			"reasoning": map[string]bool{"enabled": true},
		}
		reply, _, err = c.chatOpenRouter(ctx, activeEndpoint, activeModel, "", "", payload)
		usedBackend = "openrouter"
		if err != nil {
			reply, _, activeModel, err = c.tryOpenRouterFreeChain(ctx, activeEndpoint, freeModels, messages, activeModel)
			if err == nil {
				usedBackend = "openrouter-free:" + activeModel
			}
		}
		if err != nil && canFallback {
			reply, err = c.chatOllama(ctx, ollamaBaseURL, ollamaModel, messages)
			if err == nil {
				usedBackend = "ollama-fallback"
			}
		}
	}
	if err != nil {
		return "", err
	}

	c.mu.Lock()
	c.lastResolvedClient = usedBackend
	c.mu.Unlock()

	return reply, nil
}

// ChatDeepSolana sends a message directly to the configured local Ollama model,
// bypassing the active provider. Uses the configured OLLAMA_BASE_URL.
// Returns an error if Ollama is not reachable or the model is unavailable.
func (c *Client) ChatDeepSolana(ctx context.Context, sessionID, userMsg, contextStr string) (string, error) {
	c.mu.Lock()
	baseURL := c.ollamaBaseURL
	model := c.ollamaModel
	history := append([]Message(nil), c.sessions[sessionID]...)
	history = append(history, Message{Role: "user", Content: userMsg})
	c.mu.Unlock()

	if baseURL == "" {
		baseURL = DefaultOllamaBaseURL
	}
	if strings.TrimSpace(model) == "" {
		model = DefaultOllamaModel
	}

	sysContent := buildSystemPrompt(contextStr)

	messages := make([]map[string]interface{}, 0, len(history)+1)
	messages = append(messages, map[string]interface{}{
		"role":    "system",
		"content": sysContent,
	})
	for _, m := range history {
		messages = append(messages, map[string]interface{}{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	reply, err := c.chatOllama(ctx, baseURL, model, messages)
	if err != nil {
		return "", err
	}

	c.mu.Lock()
	c.sessions[sessionID] = append(history, Message{Role: "assistant", Content: reply})
	c.mu.Unlock()

	return reply, nil
}

// ClearSession resets conversation history for a session (local + xAI server-side).
func (c *Client) ClearSession(sessionID string) {
	c.mu.Lock()
	delete(c.sessions, sessionID)
	delete(c.xaiResponseIDs, sessionID)
	c.mu.Unlock()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func buildSystemPrompt(contextStr string) string {
	sysContent := SystemPrompt
	if soul := loadSoulPrompt(); strings.TrimSpace(soul) != "" {
		sysContent += "\n\n## SOUL.md Source of Truth\n" +
			"Treat the following SOUL.md content as the authoritative definition of your identity, market philosophy, values, and default voice. " +
			"If the operator sets a personality later in the prompt, treat it as a response-style override layered on top of this identity, not a replacement for it.\n\n" +
			strings.TrimSpace(soul)
	}
	if contextStr != "" {
		sysContent += "\n\n## Live Agent State\n" + contextStr
	}
	return sysContent
}

func loadSoulPrompt() string {
	for _, path := range soulPromptCandidatePaths() {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		text := strings.TrimSpace(string(data))
		if text != "" {
			return text
		}
	}
	return ""
}

func soulPromptCandidatePaths() []string {
	candidates := make([]string, 0, 8)
	if explicit := strings.TrimSpace(firstNonEmptyEnv(soulPathEnvKey, "SOLANAOS_SOUL_PATH")); explicit != "" {
		candidates = append(candidates, explicit)
	}
	if wd, err := os.Getwd(); err == nil && strings.TrimSpace(wd) != "" {
		candidates = append(candidates,
			filepath.Join(wd, "SOUL.md"),
			filepath.Join(wd, "..", "SOUL.md"),
			filepath.Join(wd, "..", "..", "SOUL.md"),
		)
	}
	if home := defaultSolanaOSHome(); home != "" {
		candidates = append(candidates, filepath.Join(home, "workspace", "SOUL.md"))
	}
	if exe, err := os.Executable(); err == nil && strings.TrimSpace(exe) != "" {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "SOUL.md"),
			filepath.Join(filepath.Dir(exeDir), "SOUL.md"),
		)
	}
	return dedupeStrings(candidates)
}

func defaultSolanaOSHome() string {
	if h := strings.TrimSpace(firstNonEmptyEnv("SOLANAOS_HOME", "SOLANAOS_HOME", "MAWDBOT_HOME")); h != "" {
		return h
	}
	home, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return ""
	}
	return filepath.Join(home, ".solanaos")
}

func (c *Client) chatOpenRouter(ctx context.Context, endpoint, model, sessionID, titleOverride string, payload map[string]interface{}) (string, json.RawMessage, error) {
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", nil, err
	}
	appTitle := firstNonEmpty(titleOverride, c.appTitle, "SolanaOS")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://solanaos.net")
	req.Header.Set("X-Title", appTitle)
	req.Header.Set("X-OpenRouter-Title", appTitle)
	req.Header.Set("X-OpenRouter-Categories", "cloud-agent,personal-agent")
	if c.userID != "" {
		req.Header.Set("X-User-ID", c.userID)
	}
	if sessionID != "" {
		req.Header.Set("X-Session-ID", sessionID)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("openrouter: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", nil, fmt.Errorf("openrouter %d (%s): %s", resp.StatusCode, model, truncate(string(respBody), 200))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content          string          `json:"content"`
				ReasoningDetails json.RawMessage `json:"reasoning_details"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", nil, fmt.Errorf("openrouter decode: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", nil, fmt.Errorf("openrouter: no choices in response")
	}
	return result.Choices[0].Message.Content, result.Choices[0].Message.ReasoningDetails, nil
}

func (c *Client) tryOpenRouterFreeChain(ctx context.Context, endpoint string, freeModels []string, messages []map[string]interface{}, skip ...string) (string, json.RawMessage, string, error) {
	skipSet := make(map[string]struct{}, len(skip))
	for _, model := range skip {
		if strings.TrimSpace(model) != "" {
			skipSet[strings.TrimSpace(model)] = struct{}{}
		}
	}
	for _, model := range dedupeStrings(freeModels) {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		if _, ok := skipSet[model]; ok {
			continue
		}
		payload := map[string]interface{}{
			"model":     model,
			"messages":  messages,
			"reasoning": map[string]bool{"enabled": true},
		}
		reply, reasoningDetails, err := c.chatOpenRouter(ctx, endpoint, model, "", "", payload)
		if err == nil {
			return reply, reasoningDetails, model, nil
		}
	}
	return "", nil, "", fmt.Errorf("no free OpenRouter fallback model succeeded")
}

func (c *Client) chatOllama(ctx context.Context, baseURL, model string, messages []map[string]interface{}) (string, error) {
	payload := map[string]interface{}{
		"model":    model,
		"stream":   false,
		"messages": messages,
		"options": map[string]interface{}{
			"temperature": 0.2,
			"stop":        []string{"<|im_start|>", "<|im_end|>", "<|endoftext|>"},
			"num_predict": 2048,
		},
	}

	body, _ := json.Marshal(payload)
	url := strings.TrimRight(baseURL, "/") + "/api/chat"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama %d (%s): %s", resp.StatusCode, model, truncate(string(respBody), 200))
	}

	var result struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("ollama decode: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("ollama: %s", result.Error)
	}
	content := result.Message.Content
	// Don't reject responses that contain only thinking tags — let the gateway strip them
	if strings.TrimSpace(content) == "" {
		return "(no response)", nil
	}
	return content, nil
}

func parseBool(raw string, fallback bool) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func parseList(raw string) []string {
	parts := strings.Split(raw, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return dedupeStrings(items)
}

func dedupeStrings(items []string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func parsePositiveInt(raw string, fallback int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	var value int
	if _, err := fmt.Sscanf(raw, "%d", &value); err != nil || value <= 0 {
		return fallback
	}
	return value
}

func isAnthropicModelToken(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.ContainsAny(raw, " \t") {
		return false
	}
	return strings.HasPrefix(raw, "claude-")
}

func isXAIModelToken(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.ContainsAny(raw, " \t") {
		return false
	}
	for _, r := range raw {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			continue
		}
		switch r {
		case '-', '_', '.':
			continue
		default:
			return false
		}
	}
	return true
}
