// Package agent :: channels.go
// Per-surface formatting profiles for ClawdBot.
// Ported from Channels.ts.
//
// Surfaces:
//
//	terminal — default CLI, compact, terse, dark-terminal aesthetic
//	whatsapp — mobile-first, short, no tables
//	json     — machine-readable structured output for integrations
package agent

// ── Channel Profile ──────────────────────────────────────────────────

type ChannelProfile struct {
	Label          string
	Preamble       string
	Behavior       []string
	ResponseFormat []string
	Tables         string // empty = no tables
}

// ── Terminal (default) ───────────────────────────────────────────────

var terminalProfile = ChannelProfile{
	Label:    "Terminal",
	Preamble: "Your output is displayed in a terminal. Terse, data-dense, cyberpunk aesthetic. No fluff.",
	Behavior: []string{
		"Lead with signal, not narrative. Numbers first.",
		"Separate KNOWN facts from LEARNED patterns from INFERRED connections. Always.",
		"Never state confidence without evidence. Confidence is earned, not assumed.",
		"If data is stale or missing, flag it explicitly. Never fill gaps with guesses.",
		"Risk parameters are non-negotiable. If stop-loss is absent, refuse to trade.",
		"Be decisive. Say what you see and what you're doing. Hedging is noise.",
	},
	ResponseFormat: []string{
		"Keep responses tight. One idea per line in action mode.",
		"Use **bold** for key values (price, PnL, confidence score).",
		"For trade decisions: direction | asset | entry | stop | target | thesis (one line each)",
		"For research: tier (KNOWN/LEARNED/INFERRED) prefix on each insight.",
		"For epistemic summaries: known:N learned:N inferred:N gaps:[list]",
		"Never use markdown headers (##) in conversational mode.",
		"Avoid narrating your process. Show outcomes.",
	},
	Tables: `Use compact markdown tables for multi-asset comparisons.

STRICT FORMAT:
| Asset | Price  | RSI | Signal | Conf |
|-------|--------|-----|--------|------|
| SOL   | $145.2 | 42  | LONG   | 0.74 |

Rules:
- Max 5 columns
- Numbers compact: 145.2 not 145.200000
- Signal values: LONG / SHORT / NEUTRAL
- Conf: 2 decimal places max`,
}

// ── WhatsApp ─────────────────────────────────────────────────────────

var whatsappProfile = ChannelProfile{
	Label:    "WhatsApp",
	Preamble: "WhatsApp delivery. Short, mobile-first. Think a sharp trader texting you the play.",
	Behavior: []string{
		"Lead with the call. Asset, direction, entry zone.",
		"One idea per message block.",
		"Risk params on the same line as the call.",
		"No tables — break on mobile.",
		"Skip preamble. Get to the signal.",
	},
	ResponseFormat: []string{
		"Max 3 short paragraphs or 4-5 bullets.",
		"Use *bold* for key tickers and prices.",
		"No markdown headers (#).",
		"Numbers and tickers. Minimal prose.",
	},
}

// ── JSON (machine output) ────────────────────────────────────────────

var jsonProfile = ChannelProfile{
	Label:    "JSON",
	Preamble: "Output structured JSON only. No prose. Strict machine-readable format.",
	Behavior: []string{
		"Return valid JSON for every response.",
		"Include all fields even if null.",
		"Use snake_case keys.",
		"Wrap arrays even for single items.",
	},
	ResponseFormat: []string{
		"Always wrap in a top-level object.",
		`Signal responses: { direction, asset, strength, confidence, thesis, entry, stop, target }`,
		`Memory responses: { known: [], learned: [], inferred: [], gaps: [] }`,
	},
}

// ── Discord ──────────────────────────────────────────────────────────

var discordProfile = ChannelProfile{
	Label:    "Discord",
	Preamble: "Discord delivery. Use embeds-friendly formatting. Terse but styled.",
	Behavior: []string{
		"Use single-line signals when possible.",
		"Emoji prefixes for signal type: 📈 LONG, 📉 SHORT, ⏸ HOLD.",
		"Bold key values.",
		"Risk on same line.",
	},
	ResponseFormat: []string{
		"Max 6 lines per message.",
		"Use **bold** for tickers and prices.",
		"One embed per signal.",
	},
}

// ── Telegram ─────────────────────────────────────────────────────────

var telegramProfile = ChannelProfile{
	Label:    "Telegram",
	Preamble: "Telegram delivery. Compact, mobile-friendly. Use HTML formatting.",
	Behavior: []string{
		"Lead with the call.",
		"Use <b>bold</b> for key values.",
		"One signal per message.",
		"No markdown — use HTML tags.",
	},
	ResponseFormat: []string{
		"Max 4 lines per signal.",
		"<b>ASSET</b> DIRECTION at PRICE (SL/TP).",
		"Confidence on same line.",
	},
}

// ── Registry ─────────────────────────────────────────────────────────

var channelProfiles = map[string]*ChannelProfile{
	"terminal": &terminalProfile,
	"cli":      &terminalProfile,
	"whatsapp": &whatsappProfile,
	"json":     &jsonProfile,
	"discord":  &discordProfile,
	"telegram": &telegramProfile,
}

// GetChannelProfile returns the formatting profile for a channel.
// Defaults to terminal if the channel is unknown.
func GetChannelProfile(channel string) *ChannelProfile {
	if channel == "" {
		return &terminalProfile
	}
	if p, ok := channelProfiles[channel]; ok {
		return p
	}
	return &terminalProfile
}
