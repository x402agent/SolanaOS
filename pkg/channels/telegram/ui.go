package telegram

import (
	"fmt"
	"strings"

	"github.com/mymmrac/telego"
	tu "github.com/mymmrac/telego/telegoutil"
)

const (
	telegramCallbackPrefix = "tg"
	telegramCallbackMenu   = "menu"
	telegramCallbackCmd    = "cmd"
	telegramCallbackHint   = "hint"
)

func telegramCallbackData(action, value string) string {
	return telegramCallbackPrefix + ":" + strings.TrimSpace(action) + ":" + strings.TrimSpace(value)
}

func parseTelegramCallbackData(data string) (action, value string, ok bool) {
	parts := strings.SplitN(strings.TrimSpace(data), ":", 3)
	if len(parts) != 3 || parts[0] != telegramCallbackPrefix {
		return "", "", false
	}
	action = strings.TrimSpace(parts[1])
	value = strings.TrimSpace(parts[2])
	if action == "" || value == "" {
		return "", "", false
	}
	return action, value, true
}

func telegramMenuButton(label, page string) telego.InlineKeyboardButton {
	return tu.InlineKeyboardButton(label).WithCallbackData(telegramCallbackData(telegramCallbackMenu, page))
}

func telegramCommandButton(label, command string) telego.InlineKeyboardButton {
	return tu.InlineKeyboardButton(label).WithCallbackData(telegramCallbackData(telegramCallbackCmd, command))
}

func telegramHintButton(label, hint string) telego.InlineKeyboardButton {
	return tu.InlineKeyboardButton(label).WithCallbackData(telegramCallbackData(telegramCallbackHint, hint))
}

func telegramDashboardPage(page string) (string, *telego.InlineKeyboardMarkup, bool) {
	switch strings.ToLower(strings.TrimSpace(page)) {
	case "", "main", "home":
		return `**Telegram Control Center**

Use the buttons for common actions. All slash commands still work, and you can keep using natural language for trading, research, GitHub repo creation, and coding tasks.`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Scanner", "/scanner"),
					telegramCommandButton("Trending", "/trending"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Status", "/status"),
					telegramCommandButton("Memory", "/memory"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Wallet", "/wallet"),
					telegramMenuButton("Memory", "memory"),
				),
				tu.InlineKeyboardRow(
					telegramMenuButton("Trading", "trading"),
					telegramMenuButton("Mining", "mining"),
				),
				tu.InlineKeyboardRow(
					telegramMenuButton("AI", "ai"),
					telegramMenuButton("System", "system"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Pet", "/pet"),
					telegramCommandButton("Trades", "/trades"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Help", "/help"),
					telegramCommandButton("Reset", "/new"),
				),
			), true
	case "trading":
		return `**Trading Shortcuts**

Tap for snapshots and status. For executions, type naturally:
- "buy 0.2 SOL of BONK"
- "sell 50% of WIF"
- "research <mint>"`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Trending", "/trending"),
					telegramCommandButton("Perps", "/perps"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Positions", "/positions"),
					telegramCommandButton("HL", "/hl"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Launch", "/launch"),
					telegramCommandButton("Aster", "/aster_account"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Trades", "/trades"),
					telegramMenuButton("Scanner", "scanner"),
				),
				tu.InlineKeyboardRow(
					telegramHintButton("Trade tip", "Try: buy 0.1 SOL of BONK"),
					telegramHintButton("Research tip", "Try: research <token mint>"),
				),
				tu.InlineKeyboardRow(telegramMenuButton("Back", "main")),
			), true
	case "scanner":
		return `**Pump.fun Token Scanner**

Scans pump.fun for top 100 trending tokens via GeckoTerminal + Solana Tracker + Helius RPC. Classifies by tier and sends a digest here.

Data sources: GeckoTerminal (free), Solana Tracker (keyed), Helius RPC (on-chain bonding curves), DexScreener (fallback).

Results written to pump.md. Remote trigger runs hourly.`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Run Scanner", "/scanner"),
					telegramCommandButton("Trending", "/trending"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Scope", "/scope"),
					telegramCommandButton("Rug Check", "/rug"),
				),
				tu.InlineKeyboardRow(
					telegramHintButton("Scan tip", "Scanner runs hourly via Claude dispatch + every 30m locally"),
					telegramHintButton("Trade tip", "After scan: buy 0.1 SOL of <symbol>"),
				),
				tu.InlineKeyboardRow(telegramMenuButton("Back", "trading")),
			), true
	case "ai":
		return `**AI + Coding**

Use these for model control, API key management, skills, and direct Claude Code session control. Paste an OpenRouter key (sk-or-v1-...) in chat to hot-swap it live. Switch models naturally: "use mimo" or "OPENROUTER_MODEL=xiaomi/mimo-v2-pro".`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Model", "/model"),
					telegramCommandButton("API Key", "/apikey"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Skills", "/skills"),
					telegramCommandButton("Mimo", "/mimo"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Claude", "/claude help"),
					telegramCommandButton("Sessions", "/claude sessions"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Commit", "/claude commit"),
					telegramCommandButton("Status", "/claude status"),
				),
				tu.InlineKeyboardRow(
					telegramHintButton("Key tip", "Paste sk-or-v1-... to swap key live"),
					telegramHintButton("Model tip", "Try: use mimo, or OPENROUTER_MODEL=vendor/model"),
				),
				tu.InlineKeyboardRow(
					telegramHintButton("GitHub tip", "Try: make a new github for a telegram bot"),
					telegramHintButton("Claude tip", "Try: /claude start in /tmp/app add auth and tests"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Help", "/help all"),
					telegramCommandButton("Reset", "/new"),
				),
				tu.InlineKeyboardRow(telegramMenuButton("Back", "main")),
			), true
	case "memory":
		return `**Memory + Operator Profile**

These shortcuts expose the Honcho-backed memory features already wired into SolanaOS. Use them to inspect your learned operator profile, current session context, and durable trading conclusions.`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Memory", "/memory"),
					telegramCommandButton("Recall", "/recall my current strategy"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Sessions", "/memory_sessions"),
					telegramCommandButton("Queue", "/honcho_status"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Profile", "/profile"),
					telegramCommandButton("Card", "/card"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Context", "/honcho_context"),
					telegramCommandButton("Conclusions", "/honcho_conclusions"),
				),
				tu.InlineKeyboardRow(telegramCommandButton("Dream", "/dream")),
				tu.InlineKeyboardRow(
					telegramHintButton("Remember tip", "Try: /remember I prefer spot over perps"),
					telegramHintButton("Recall tip", "Try: /recall what risk tolerance have I shown"),
				),
				tu.InlineKeyboardRow(telegramMenuButton("Back", "main")),
			), true
	case "mining":
		return `⛏️ **Mining Control**

Monitor and control your Bitaxe Gamma 602 Bitcoin solo miner. Use buttons for quick actions or type commands directly.`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Status", "/miner"),
					telegramCommandButton("Restart", "/miner restart"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Freq 400", "/miner freq 400"),
					telegramCommandButton("Freq 500", "/miner freq 500"),
					telegramCommandButton("Freq 575", "/miner freq 575"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Fan Auto", "/miner fan 0"),
					telegramCommandButton("Fan 75%", "/miner fan 75"),
					telegramCommandButton("Fan 100%", "/miner fan 100"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Help", "/miner help"),
				),
				tu.InlineKeyboardRow(telegramMenuButton("Back", "main")),
			), true
	case "system":
		return `**System**

Common status and reset actions live here. The reply keyboard stays available for fast taps, and you can always type commands directly.`, tu.InlineKeyboard(
				tu.InlineKeyboardRow(
					telegramCommandButton("Status", "/status"),
					telegramCommandButton("Wallet", "/wallet"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Remote", "/remote"),
					telegramCommandButton("Claude", "/claude"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Pet", "/pet"),
					telegramCommandButton("Help", "/help"),
				),
				tu.InlineKeyboardRow(
					telegramCommandButton("Menu", "/menu"),
					telegramCommandButton("Reset", "/new"),
				),
				tu.InlineKeyboardRow(telegramMenuButton("Back", "main")),
			), true
	default:
		return "", nil, false
	}
}

func telegramDashboardIntro() string {
	return "Quick actions are pinned below. Use the reply keyboard for fast taps, the inline dashboard for structured navigation, or just talk to the bot naturally."
}

func telegramCallbackAck(action, value string) string {
	switch action {
	case telegramCallbackCmd:
		return fmt.Sprintf("Running %s", value)
	case telegramCallbackMenu:
		return "Menu updated"
	default:
		return ""
	}
}
