package daemon

import (
	"fmt"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/pumpfun"
)

// ─── /sniper ─────────────────────────────────────────────────────────────────
//
//   /sniper               — show status
//   /sniper start         — start the mayhem sniper bot
//   /sniper stop          — stop it
//   /sniper logs [N]      — last N log lines (default 20)
//   /sniper config        — show current .env (secrets redacted)
//   /sniper set KEY VALUE — write a .env key
//   /sniper help          — this message

func (d *Daemon) sniperResponse(args []string) string {
	if d.pumpfunMgr == nil {
		return "⚠️ PumpFun bot manager is not initialised."
	}

	sub := ""
	if len(args) > 0 {
		sub = strings.ToLower(args[0])
	}

	switch sub {
	case "", "status":
		s := d.pumpfunMgr.Status(pumpfun.KindSniper)
		return pumpfun.MarshalStatus(s)

	case "start":
		cfg := pumpfun.BotConfig{Env: d.pumpfunEnvFromConfig()}
		if err := d.pumpfunMgr.Start(pumpfun.KindSniper, cfg); err != nil {
			return fmt.Sprintf("❌ Could not start sniper: %v", err)
		}
		return "🔫 Pump.fun Mayhem Sniper started.\n\nUse `/sniper logs` to watch activity or `/sniper stop` to halt."

	case "stop":
		if err := d.pumpfunMgr.Stop(pumpfun.KindSniper); err != nil {
			return fmt.Sprintf("❌ %v", err)
		}
		return "⛔ Pump.fun Mayhem Sniper stopped."

	case "logs":
		n := 20
		if len(args) > 1 {
			fmt.Sscanf(args[1], "%d", &n)
		}
		lines := d.pumpfunMgr.Logs(pumpfun.KindSniper, n)
		if len(lines) == 0 {
			return "📭 No logs yet."
		}
		return "```\n" + strings.Join(lines, "\n") + "\n```"

	case "config":
		cfg, err := d.pumpfunMgr.ConfigJSON(pumpfun.KindSniper)
		if err != nil {
			return fmt.Sprintf("⚠️ %v\n\nCreate a `.env` file in `bots/pumpfun-mayhem-sniper-main/` with:\n```\nGEYSER_RPC=wss://...\nPRIVATE_KEY=...\nRPC_ENDPOINT=https://...\nBUY_AMOUNT=0.01\nSLIPPAGE=10\nTAKE_PROFIT=20\nSTOP_LOSS=15\nTIME_OUT=60\nCHECK_DEV_BUY=true\nMIN_DEV_BUY_AMOUNT=0.5\nMAYHEM_MODE_ONLY=false\n```", err)
		}
		var b strings.Builder
		b.WriteString("⚙️ *Sniper .env config*\n```\n")
		for k, v := range cfg {
			b.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		}
		b.WriteString("```")
		return b.String()

	case "set":
		if len(args) < 3 {
			return "Usage: `/sniper set KEY VALUE`"
		}
		key, val := strings.ToUpper(args[1]), strings.Join(args[2:], " ")
		if err := d.pumpfunMgr.SetConfig(pumpfun.KindSniper, map[string]string{key: val}); err != nil {
			return fmt.Sprintf("❌ %v", err)
		}
		return fmt.Sprintf("✅ Sniper config updated: `%s` = `%s`\n\nRestart the bot for changes to take effect: `/sniper stop` → `/sniper start`", key, val)

	default:
		return d.sniperHelp()
	}
}

func (d *Daemon) sniperHelp() string {
	return `🔫 *Pump.fun Mayhem Sniper*

Snipes new pump.fun tokens via Geyser WebSocket. Supports Mayhem Mode filtering and dev-buy validation.

**Commands:**
` + "`/sniper`" + ` — show status
` + "`/sniper start`" + ` — start the bot
` + "`/sniper stop`" + ` — stop the bot
` + "`/sniper logs [N]`" + ` — last N log lines (default 20)
` + "`/sniper config`" + ` — show .env (secrets redacted)
` + "`/sniper set KEY VAL`" + ` — update a .env key

**Key config vars:**
• ` + "`GEYSER_RPC`" + ` — Geyser WebSocket endpoint
• ` + "`PRIVATE_KEY`" + ` — wallet private key (base58)
• ` + "`BUY_AMOUNT`" + ` — SOL per trade (in SOL, e.g. 0.1)
• ` + "`TAKE_PROFIT`" + ` — % gain to auto-sell
• ` + "`STOP_LOSS`" + ` — % loss to auto-sell
• ` + "`TIME_OUT`" + ` — max hold seconds before forced exit
• ` + "`MAYHEM_MODE_ONLY`" + ` — only snipe Mayhem Mode tokens
• ` + "`CHECK_DEV_BUY`" + ` — require dev to invest ≥ MIN_DEV_BUY_AMOUNT`
}

// ─── /aibot ──────────────────────────────────────────────────────────────────
//
//   /aibot               — show status
//   /aibot start         — start the AI trading bot (Express on :3001)
//   /aibot stop          — stop it
//   /aibot logs [N]      — last N log lines
//   /aibot config        — show current .env
//   /aibot set KEY VALUE — write a .env key
//   /aibot help          — this message

func (d *Daemon) aibotResponse(args []string) string {
	if d.pumpfunMgr == nil {
		return "⚠️ PumpFun bot manager is not initialised."
	}

	sub := ""
	if len(args) > 0 {
		sub = strings.ToLower(args[0])
	}

	switch sub {
	case "", "status":
		s := d.pumpfunMgr.Status(pumpfun.KindAIBot)
		return pumpfun.MarshalStatus(s)

	case "start":
		cfg := pumpfun.BotConfig{Env: d.pumpfunEnvFromConfig()}
		if err := d.pumpfunMgr.Start(pumpfun.KindAIBot, cfg); err != nil {
			return fmt.Sprintf("❌ Could not start AI bot: %v", err)
		}
		return "🤖 Pump.fun AI Trading Bot started (HTTP :3001).\n\nUse `/aibot logs` to watch or `/aibot stop` to halt."

	case "stop":
		if err := d.pumpfunMgr.Stop(pumpfun.KindAIBot); err != nil {
			return fmt.Sprintf("❌ %v", err)
		}
		return "⛔ Pump.fun AI Trading Bot stopped."

	case "logs":
		n := 20
		if len(args) > 1 {
			fmt.Sscanf(args[1], "%d", &n)
		}
		lines := d.pumpfunMgr.Logs(pumpfun.KindAIBot, n)
		if len(lines) == 0 {
			return "📭 No logs yet."
		}
		return "```\n" + strings.Join(lines, "\n") + "\n```"

	case "config":
		cfg, err := d.pumpfunMgr.ConfigJSON(pumpfun.KindAIBot)
		if err != nil {
			return fmt.Sprintf("⚠️ %v\n\nCreate a `.env` file in `bots/pumpfun-mayhem-ai-trading-bot-main/` with:\n```\nPORT=3001\nAI_ENABLED=true\nSOLANA_PRIVATE_KEY=...\nSOLANA_RPC_URL=https://...\n```", err)
		}
		var b strings.Builder
		b.WriteString("⚙️ *AI Bot .env config*\n```\n")
		for k, v := range cfg {
			b.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		}
		b.WriteString("```")
		return b.String()

	case "set":
		if len(args) < 3 {
			return "Usage: `/aibot set KEY VALUE`"
		}
		key, val := strings.ToUpper(args[1]), strings.Join(args[2:], " ")
		if err := d.pumpfunMgr.SetConfig(pumpfun.KindAIBot, map[string]string{key: val}); err != nil {
			return fmt.Sprintf("❌ %v", err)
		}
		return fmt.Sprintf("✅ AI bot config updated: `%s` = `%s`\n\nRestart the bot for changes to take effect: `/aibot stop` → `/aibot start`", key, val)

	default:
		return d.aibotHelp()
	}
}

func (d *Daemon) aibotHelp() string {
	return `🤖 *Pump.fun AI Trading Bot*

AI-powered trading bot with Express HTTP API on port 3001. Provides real-time market analysis and pattern recognition.

**Commands:**
` + "`/aibot`" + ` — show status
` + "`/aibot start`" + ` — start the bot
` + "`/aibot stop`" + ` — stop the bot
` + "`/aibot logs [N]`" + ` — last N log lines (default 20)
` + "`/aibot config`" + ` — show .env (secrets redacted)
` + "`/aibot set KEY VAL`" + ` — update a .env key

**Key config vars:**
• ` + "`PORT`" + ` — HTTP server port (default 3001)
• ` + "`AI_ENABLED`" + ` — set true to activate AI trading loop
• ` + "`SOLANA_PRIVATE_KEY`" + ` — wallet private key (base58)
• ` + "`SOLANA_RPC_URL`" + ` — Solana RPC endpoint

**API endpoints (when running):**
• ` + "`GET  http://localhost:3001/api/health`" + `
• ` + "`POST http://localhost:3001/api/trading`" + ``
}

// ─── /bots ───────────────────────────────────────────────────────────────────
// Combined overview of both bots.

func (d *Daemon) botsResponse() string {
	if d.pumpfunMgr == nil {
		return "⚠️ PumpFun bot manager is not initialised."
	}
	statuses := d.pumpfunMgr.StatusAll()
	var b strings.Builder
	b.WriteString("🔫🤖 *Pump.fun Bots*\n\n")
	for _, s := range statuses {
		b.WriteString(pumpfun.MarshalStatus(s))
		b.WriteString("\n\n")
	}
	b.WriteString("Use `/sniper help` or `/aibot help` for individual controls.")
	return strings.TrimSpace(b.String())
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// pumpfunEnvFromConfig extracts relevant Solana/RPC settings from the daemon
// config and passes them to the bot subprocesses so they inherit the operator's
// existing keys without needing a separate .env.
func (d *Daemon) pumpfunEnvFromConfig() map[string]string {
	env := map[string]string{}
	if d.cfg == nil {
		return env
	}
	// Solana RPC — used by both bots
	if v := d.cfg.Solana.SolanaTrackerRPCURL; v != "" {
		env["RPC_ENDPOINT"] = v
		env["SOLANA_RPC_URL"] = v
	}
	if v := d.cfg.Solana.SolanaTrackerWSSURL; v != "" {
		env["RPC_WEBSOCKET_ENDPOINT"] = v
		env["GEYSER_RPC"] = v
	}
	// Wallet private key — bots inherit PRIVATE_KEY / SOLANA_PRIVATE_KEY from
	// the process environment if set; we just ensure they propagate correctly.
	// (The bots source their own .env files too.)
	return env
}
