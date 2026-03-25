// Package commands provides the chat command registry for SolanaOS.
// Adapted from PicoClaw — slash commands dispatched from chat input.
package commands

import "context"

type Definition struct {
	Name        string
	Description string
	Aliases     []string
	Handler     func(ctx context.Context, args string) (string, error)
}

type Registry struct {
	defs map[string]*Definition
}

func NewRegistry(builtins []Definition) *Registry {
	r := &Registry{defs: make(map[string]*Definition)}
	for i := range builtins {
		r.Register(&builtins[i])
	}
	return r
}

func (r *Registry) Register(def *Definition) {
	r.defs[def.Name] = def
	for _, alias := range def.Aliases {
		r.defs[alias] = def
	}
}

func (r *Registry) Get(name string) (*Definition, bool) {
	d, ok := r.defs[name]
	return d, ok
}

func (r *Registry) List() []*Definition {
	seen := make(map[string]bool)
	var result []*Definition
	for _, d := range r.defs {
		if !seen[d.Name] {
			seen[d.Name] = true
			result = append(result, d)
		}
	}
	return result
}

// BuiltinDefinitions returns the default SolanaOS chat commands.
func BuiltinDefinitions() []Definition {
	return []Definition{
		{Name: "start", Description: "Welcome and command overview"},
		{Name: "help", Description: "Show the clean command map", Aliases: []string{"?", "h"}},
		{Name: "menu", Description: "Show Telegram quick actions"},
		{Name: "status", Description: "Agent, OODA, and TamaGOchi status", Aliases: []string{"s"}},
		{Name: "memory", Description: "Show Honcho memory profile and context"},
		{Name: "recall", Description: "Query long-term memory in natural language"},
		{Name: "remember", Description: "Save a durable fact to memory"},
		{Name: "memory_sessions", Description: "Show recent Honcho memory sessions"},
		{Name: "honcho_status", Description: "Show Honcho queue and bridge status"},
		{Name: "honcho_context", Description: "Show current Honcho session context"},
		{Name: "honcho_conclusions", Description: "List Honcho trading conclusions"},
		{Name: "dream", Description: "Trigger Honcho memory consolidation"},
		{Name: "profile", Description: "Show your synthesized operator profile"},
		{Name: "card", Description: "Show your Honcho peer card facts"},
		{Name: "wallet", Description: "Wallet address and SOL balance"},
		{Name: "buy", Description: "Buy a Solana token from the wallet"},
		{Name: "sell", Description: "Sell a Solana token back to SOL"},
		{Name: "launch", Description: "Pump launch status or action", Aliases: []string{"pump"}},
		{Name: "pet", Description: "TamaGOchi pet status"},
		{Name: "trending", Description: "Trending Solana tokens"},
		{Name: "scanner", Description: "Run pump.fun scanner and send digest", Aliases: []string{"scan", "pumpscan"}},
		{Name: "token_help", Description: "Show Solana Tracker data commands", Aliases: []string{"solhelp"}},
		{Name: "perps", Description: "Aster perpetuals snapshot", Aliases: []string{"aster"}},
		{Name: "positions", Description: "Show open perp positions across venues"},
		{Name: "hl", Description: "Show Hyperliquid account overview"},
		{Name: "hl_positions", Description: "Show Hyperliquid positions"},
		{Name: "hl_open", Description: "Open a Hyperliquid perp position"},
		{Name: "hl_close", Description: "Close a Hyperliquid perp position"},
		{Name: "aster_account", Description: "Show Aster account overview"},
		{Name: "aster_positions", Description: "Show Aster perp positions"},
		{Name: "aster_open", Description: "Open an Aster perp position"},
		{Name: "aster_close", Description: "Close an Aster perp position"},
		{Name: "trades", Description: "Recent trade history", Aliases: []string{"t"}},
		{Name: "research", Description: "Deep research a token mint", Aliases: []string{"res"}},
		{Name: "miner", Description: "Bitaxe miner status and control", Aliases: []string{"hashrate", "btc", "mining"}},
		{Name: "model", Description: "Show or switch active AI backend/model"},
		{Name: "apikey", Description: "Show or swap OpenRouter API key live", Aliases: []string{"key", "setkey"}},
		{Name: "restart", Description: "Restart the daemon process", Aliases: []string{"reboot"}},
		{Name: "update", Description: "Rebuild from source and restart", Aliases: []string{"rebuild"}},
		{Name: "mimo", Description: "Chat with Xiaomi Mimo reasoning mode"},
		{Name: "personality", Description: "Set reply style and preferred name", Aliases: []string{"persona"}},
		{Name: "github", Description: "Create a GitHub repo from a natural-language brief"},
		{Name: "skills", Description: "Browse installed skills"},
		{Name: "new", Description: "Reset conversation history", Aliases: []string{"reset"}},
		{Name: "sandbox", Description: "Manage E2B cloud sandbox", Aliases: []string{"sbx"}},
		{Name: "run", Description: "Run Python code in sandbox", Aliases: []string{"exec"}},
		{Name: "shell", Description: "Run shell command in sandbox"},
		{Name: "sandbox_kill", Description: "Terminate active sandbox", Aliases: []string{"sbx_kill"}},
		{Name: "sandbox_list", Description: "List all active sandboxes", Aliases: []string{"sbx_list"}},
		{Name: "remote", Description: "Remote control Mac via Claude Code", Aliases: []string{"remotecontrol", "rc"}},
		{Name: "rug", Description: "Rug check a token (risk score, holders, security)", Aliases: []string{"rugcheck", "safety"}},
		{Name: "scope", Description: "Memescope: graduating and graduated tokens", Aliases: []string{"memescope"}},
	}
}
