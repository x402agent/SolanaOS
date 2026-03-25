package daemon

import (
	"strings"
	"testing"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/llm"
	"github.com/x402agent/Solana-Os-Go/pkg/pumplaunch"
)

func TestExtractAsterSymbol(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "show my aster open orders for eth", want: "ETHUSDT"},
		{input: "show my aster trades for btc", want: "BTCUSDT"},
		{input: "close sol on aster", want: "SOLUSDT"},
		{input: "long doge on aster 10%", want: "DOGEUSDT"},
		{input: "show my aster account", want: ""},
	}

	for _, tt := range tests {
		got := extractAsterSymbol(tt.input)
		if got != tt.want {
			t.Fatalf("extractAsterSymbol(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNaturalTradeSide(t *testing.T) {
	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{input: "long btc on aster", want: "buy", ok: true},
		{input: "buy eth on aster", want: "buy", ok: true},
		{input: "short sol on aster", want: "sell", ok: true},
		{input: "sell doge perp", want: "sell", ok: true},
		{input: "show my aster positions", want: "", ok: false},
	}

	for _, tt := range tests {
		got, ok := naturalTradeSide(tt.input)
		if got != tt.want || ok != tt.ok {
			t.Fatalf("naturalTradeSide(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.ok)
		}
	}
}

func TestParseCommandTelegramBotSuffix(t *testing.T) {
	cmd, args := parseCommand("/status@NemoClaw_solanabot extra")
	if cmd != "/status" {
		t.Fatalf("parseCommand bot suffix cmd = %q, want %q", cmd, "/status")
	}
	if len(args) != 1 || args[0] != "extra" {
		t.Fatalf("parseCommand bot suffix args = %#v, want %#v", args, []string{"extra"})
	}
}

func TestParseCommandBangPrefix(t *testing.T) {
	cmd, args := parseCommand("!token bonk")
	if cmd != "!token" {
		t.Fatalf("parseCommand bang cmd = %q, want %q", cmd, "!token")
	}
	if len(args) != 1 || args[0] != "bonk" {
		t.Fatalf("parseCommand bang args = %#v, want %#v", args, []string{"bonk"})
	}
}

func TestExtractModelSelection(t *testing.T) {
	tests := []struct {
		input       string
		wantBackend string
		wantModel   string
		wantOK      bool
	}{
		{input: "openrouter minimax/minimax-m2.7", wantBackend: "openrouter", wantModel: "minimax/minimax-m2.7", wantOK: true},
		{input: "anthropic claude-sonnet-4-6", wantBackend: "anthropic", wantModel: "claude-sonnet-4-6", wantOK: true},
		{input: "xai grok-4-1-fast", wantBackend: "xai", wantModel: "grok-4-1-fast", wantOK: true},
		{input: "ANTHROPIC_MODEL=claude-opus-4-6", wantBackend: "anthropic", wantModel: "claude-opus-4-6", wantOK: true},
		{input: "OLLAMA_MODEL=minimax-m2.7:cloud", wantBackend: "ollama", wantModel: "minimax-m2.7:cloud", wantOK: true},
		{input: "ollama minimax-m2.7:cloud", wantBackend: "ollama", wantModel: "minimax-m2.7:cloud", wantOK: true},
		{input: "minimax-m2.7:cloud", wantBackend: "ollama", wantModel: "minimax-m2.7:cloud", wantOK: true},
		{input: "XAI_MODEL=grok-4.20-multi-agent-beta-0309", wantBackend: "xai", wantModel: "grok-4.20-multi-agent-beta-0309", wantOK: true},
		{input: "grok-4-1-fast", wantBackend: "xai", wantModel: "grok-4-1-fast", wantOK: true},
		{input: "claude-haiku-4-5", wantBackend: "anthropic", wantModel: "claude-haiku-4-5", wantOK: true},
		{input: "not a model", wantOK: false},
	}

	for _, tt := range tests {
		backend, model, ok := extractModelSelection(tt.input)
		if backend != tt.wantBackend || model != tt.wantModel || ok != tt.wantOK {
			t.Fatalf("extractModelSelection(%q) = (%q, %q, %v), want (%q, %q, %v)",
				tt.input, backend, model, ok, tt.wantBackend, tt.wantModel, tt.wantOK)
		}
	}
}

func TestExtractNaturalModelSwitchMimoAndOmni(t *testing.T) {
	presets := [3]string{"model-1", "model-2", "model-3"}

	got, ok := extractNaturalModelSwitch("switch to mimo", presets)
	if !ok || got != 4 {
		t.Fatalf("extractNaturalModelSwitch(mimo) = (%d, %v), want (4, true)", got, ok)
	}

	got, ok = extractNaturalModelSwitch("switch to omni", presets)
	if !ok || got != 5 {
		t.Fatalf("extractNaturalModelSwitch(omni) = (%d, %v), want (5, true)", got, ok)
	}
}

func TestExtractNaturalVideoPrompt(t *testing.T) {
	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{
			input: "make a 15-second video showing SolanaOS as a sentient trading terminal",
			want:  "SolanaOS as a sentient trading terminal",
			ok:    true,
		},
		{
			input: "can you generate a video of a cyberpunk Solana trading rig in the rain",
			want:  "a cyberpunk Solana trading rig in the rain",
			ok:    true,
		},
		{
			input: "how do I make a video prompt for Grok",
			want:  "",
			ok:    false,
		},
	}

	for _, tt := range tests {
		got, ok := extractNaturalVideoPrompt(tt.input)
		if got != tt.want || ok != tt.ok {
			t.Fatalf("extractNaturalVideoPrompt(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.ok)
		}
	}
}

func TestExtractNaturalImagePrompt(t *testing.T) {
	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{
			input: "generate an image of a neon lobster trader staring at a Solana terminal",
			want:  "a neon lobster trader staring at a Solana terminal",
			ok:    true,
		},
		{
			input: "draw a clean poster for SolanaOS with terminal green accents",
			want:  "a clean poster for SolanaOS with terminal green accents",
			ok:    true,
		},
		{
			input: "what image model are you using",
			want:  "",
			ok:    false,
		},
	}

	for _, tt := range tests {
		got, ok := extractNaturalImagePrompt(tt.input)
		if got != tt.want || ok != tt.ok {
			t.Fatalf("extractNaturalImagePrompt(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.ok)
		}
	}
}

func TestExtractNaturalImageEditPrompt(t *testing.T) {
	got, ok := extractNaturalImageEditPrompt("edit this into a cyberpunk trading poster", true)
	if !ok || got != "edit this into a cyberpunk trading poster" {
		t.Fatalf("extractNaturalImageEditPrompt() = (%q, %v)", got, ok)
	}

	if got, ok := extractNaturalImageEditPrompt("edit this into a cyberpunk trading poster", false); ok || got != "" {
		t.Fatalf("extractNaturalImageEditPrompt(no media) = (%q, %v), want (\"\", false)", got, ok)
	}
}

func TestExtractSpotTradeIntent(t *testing.T) {
	tests := []struct {
		input      string
		wantSide   string
		wantToken  string
		wantAmount string
		wantOK     bool
	}{
		{input: "buy bonk 0.1 sol", wantSide: "buy", wantToken: "bonk", wantAmount: "0.1", wantOK: true},
		{input: "sell bonk 50%", wantSide: "sell", wantToken: "bonk", wantAmount: "50%", wantOK: true},
		{input: "buy jup with 0.25 sol", wantSide: "buy", wantToken: "jup", wantAmount: "0.25", wantOK: true},
		{input: "sell ray from my wallet 25%", wantSide: "sell", wantToken: "ray", wantAmount: "25%", wantOK: true},
		{input: "buy btc on aster 10%", wantOK: false},
	}

	for _, tt := range tests {
		side, token, amount, ok := extractSpotTradeIntent(tt.input)
		if side != tt.wantSide || token != tt.wantToken || amount != tt.wantAmount || ok != tt.wantOK {
			t.Fatalf("extractSpotTradeIntent(%q) = (%q, %q, %q, %v), want (%q, %q, %q, %v)",
				tt.input, side, token, amount, ok, tt.wantSide, tt.wantToken, tt.wantAmount, tt.wantOK)
		}
	}
}

func TestParseSellAmountSpec(t *testing.T) {
	raw, ui, err := parseSellAmountSpec("50%", 12, 12000000, 6)
	if err != nil {
		t.Fatalf("parseSellAmountSpec percent error = %v", err)
	}
	if raw != 6000000 || ui != 6 {
		t.Fatalf("parseSellAmountSpec percent = (%d, %.6f), want (%d, %.6f)", raw, ui, 6000000, 6.0)
	}

	raw, ui, err = parseSellAmountSpec("1.25", 12, 12000000, 6)
	if err != nil {
		t.Fatalf("parseSellAmountSpec absolute error = %v", err)
	}
	if raw != 1250000 || ui != 1.25 {
		t.Fatalf("parseSellAmountSpec absolute = (%d, %.6f), want (%d, %.6f)", raw, ui, 1250000, 1.25)
	}
}

func TestLooksLikeGitHubCreateIntent(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{input: "create a github repo for a private next.js starter", want: true},
		{input: "make a new github for a todo app", want: true},
		{input: "build me a repo for a stripe demo", want: true},
		{input: "spin up a repository for a telegram bot", want: true},
		{input: "show my github sessions", want: false},
		{input: "github session status", want: false},
		{input: "github log", want: false},
	}

	for _, tt := range tests {
		got := looksLikeGitHubCreateIntent(tt.input)
		if got != tt.want {
			t.Fatalf("looksLikeGitHubCreateIntent(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestPersonalityPresetByKey(t *testing.T) {
	preset, ok := personalityPresetByKey("degen")
	if !ok {
		t.Fatalf("expected degen preset")
	}
	if preset.Key != "degen" {
		t.Fatalf("unexpected preset key: %q", preset.Key)
	}
}

func TestPersonalitySummaryResponse(t *testing.T) {
	d := &Daemon{}
	got := d.personalitySummaryResponse(operatorPreference{
		PreferredName: "8Bit",
		Personality:   "operator",
	})
	for _, want := range []string{"8Bit", "operator", "/personality name"} {
		if !strings.Contains(strings.ToLower(got), strings.ToLower(want)) {
			t.Fatalf("summary missing %q:\n%s", want, got)
		}
	}
}

func TestStatusResponseIncludesOperatorProfile(t *testing.T) {
	d := &Daemon{}
	store := &operatorPreferenceStore{
		Users: map[string]operatorPreference{
			"42": {PreferredName: "8Bit", Personality: "analyst"},
		},
	}
	d.operatorPrefs = store
	got := d.statusResponse(busMessage("telegram", "42"))
	for _, want := range []string{"Runtime", "Wallet + Chain", "Perps + Accounts", "Memory + Skills", "Operator Profile", "8Bit", "Analyst"} {
		if !strings.Contains(got, want) {
			t.Fatalf("status missing %q:\n%s", want, got)
		}
	}
}

func TestFormatPumpLaunchStatusCompactStripsRawError(t *testing.T) {
	got := formatPumpLaunchStatusCompact(&pumplaunch.State{
		Status: "error",
		Error:  "Program failed to complete: custom program error: 0x1771",
	}, true, "manual")
	if strings.Contains(got, "0x1771") || strings.Contains(got, "Program failed") {
		t.Fatalf("compact status leaked raw error: %q", got)
	}
	if !strings.Contains(got, "last launch failed") {
		t.Fatalf("compact status missing summary: %q", got)
	}
}

func TestTelegramPlaceholderText(t *testing.T) {
	d := &Daemon{}
	d.llm = nil

	msg := bus.InboundMessage{
		Channel: "telegram",
		Sender: bus.SenderInfo{
			DisplayName: "8Bit",
		},
	}
	if got := d.telegramPlaceholderText(msg, "/status", "/status", true); !strings.Contains(strings.ToLower(got), "runtime status") {
		t.Fatalf("status placeholder = %q, want runtime status copy", got)
	}
	if got := d.telegramPlaceholderText(msg, "/foo", "/foo", true); got != "" {
		t.Fatalf("unexpected placeholder for unknown fast command: %q", got)
	}
	if got := d.telegramPlaceholderText(msg, "/claude", "/claude sessions", true); !strings.Contains(strings.ToLower(got), "claude code session") {
		t.Fatalf("claude placeholder = %q, want Claude Code session copy", got)
	}
	if got := d.telegramPlaceholderText(msg, "/claude", "/claude commit", true); !strings.Contains(strings.ToLower(got), "commit pass") {
		t.Fatalf("claude commit placeholder = %q, want commit copy", got)
	}
	if got := d.telegramPlaceholderText(msg, "", "tell me about sol", false); got != "" {
		t.Fatalf("unexpected placeholder without llm configured: %q", got)
	}
}

func TestConversationResetUsesMessageSessionKey(t *testing.T) {
	d := &Daemon{llm: llm.New()}

	got := d.processCommand(bus.InboundMessage{
		Channel: "telegram",
		ChatID:  "123/456",
		Content: "/new",
	})
	if !strings.Contains(strings.ToLower(got), "fresh start") {
		t.Fatalf("unexpected reset response: %q", got)
	}
}

func TestProcessCommandClaudeUsage(t *testing.T) {
	d := &Daemon{}

	got := d.processCommand(bus.InboundMessage{
		Channel: "telegram",
		ChatID:  "123/456",
		Content: "/claude",
	})
	for _, want := range []string{"/claude start", "/claude sessions", "/claude continue", "/claude commit"} {
		if !strings.Contains(got, want) {
			t.Fatalf("claude usage missing %q:\n%s", want, got)
		}
	}
}

func TestRewriteXCommandAliases(t *testing.T) {
	d := &Daemon{}

	msg, direct, handled := d.rewriteXCommand(bus.InboundMessage{
		Channel: "x",
		Content: "@mawdbot !hot 4h",
	}, "", nil)
	if !handled {
		t.Fatal("expected X command to be handled")
	}
	if direct != "" {
		t.Fatalf("expected rewrite, got direct response %q", direct)
	}
	if msg.Content != "/trending_tf 4h" {
		t.Fatalf("rewritten content = %q, want %q", msg.Content, "/trending_tf 4h")
	}

	msg, direct, handled = d.rewriteXCommand(bus.InboundMessage{
		Channel: "x",
		Content: "!wallet 9xQeWvG816bUx9EP7nxmBvHLHnQJg3Y4VqA8m3i1xQe",
	}, "", nil)
	if !handled || direct != "" {
		t.Fatalf("wallet rewrite = (%v, %q), want handled rewrite", handled, direct)
	}
	if msg.Content != "/wallet_basic 9xQeWvG816bUx9EP7nxmBvHLHnQJg3Y4VqA8m3i1xQe" {
		t.Fatalf("wallet rewrite = %q", msg.Content)
	}
}

func TestProcessCommandXHelp(t *testing.T) {
	d := &Daemon{}

	got := d.processCommand(bus.InboundMessage{
		Channel: "x",
		Content: "!help",
	})
	for _, want := range []string{"X gateway live", "!token", "!claude", "Owner-only"} {
		if !strings.Contains(got, want) {
			t.Fatalf("x help missing %q:\n%s", want, got)
		}
	}
}

func TestProcessCommandXOwnerOnlyDenied(t *testing.T) {
	d := &Daemon{}

	got := d.processCommand(bus.InboundMessage{
		Channel: "x",
		Content: "!buy bonk 0.1",
		Sender: bus.SenderInfo{
			Username: "notowner",
		},
	})
	if !strings.Contains(strings.ToLower(got), "owner-only") {
		t.Fatalf("unexpected owner gate response: %q", got)
	}
}

func TestProcessCommandTwitterUsage(t *testing.T) {
	d := &Daemon{}

	got := d.processCommand(bus.InboundMessage{
		Channel: "telegram",
		Content: "/twitter",
	})
	for _, want := range []string{"/twitter status", "/twitter post", "/twitter reply"} {
		if !strings.Contains(got, want) {
			t.Fatalf("twitter usage missing %q:\n%s", want, got)
		}
	}
}

func TestTrimLeadingMentions(t *testing.T) {
	got := trimLeadingMentions("@mawdbot @other !token bonk")
	if got != "!token bonk" {
		t.Fatalf("trimLeadingMentions = %q, want %q", got, "!token bonk")
	}
}

func TestSplitCodingSessionPromptArgs(t *testing.T) {
	sessionID, prompt := splitCodingSessionPromptArgs([]string{"a1b2c3d4e5f6", "add", "tests"})
	if sessionID != "a1b2c3d4e5f6" {
		t.Fatalf("session id = %q, want %q", sessionID, "a1b2c3d4e5f6")
	}
	if prompt != "add tests" {
		t.Fatalf("prompt = %q, want %q", prompt, "add tests")
	}

	sessionID, prompt = splitCodingSessionPromptArgs([]string{"add", "tests"})
	if sessionID != "" {
		t.Fatalf("session id = %q, want empty", sessionID)
	}
	if prompt != "add tests" {
		t.Fatalf("prompt = %q, want %q", prompt, "add tests")
	}
}

func TestConversationalResponseContextTelegram(t *testing.T) {
	d := &Daemon{}
	got := d.conversationalResponseContext(bus.InboundMessage{Channel: "telegram"})
	for _, want := range []string{"Response Style", "Telegram replies", "continue/that/it"} {
		if !strings.Contains(got, want) {
			t.Fatalf("conversation context missing %q:\n%s", want, got)
		}
	}
}

func TestOperatorPreferenceContextIsStyleOverride(t *testing.T) {
	d := &Daemon{}
	d.operatorPrefs = &operatorPreferenceStore{
		Users: map[string]operatorPreference{
			"42": {
				PreferredName: "8Bit",
				Personality:   "degen",
			},
		},
	}

	got := d.operatorPreferenceContext(busMessage("telegram", "42"))
	for _, want := range []string{"Active Personality Override", "preserving the identity", "SOUL.md", "8Bit"} {
		if !strings.Contains(got, want) {
			t.Fatalf("operatorPreferenceContext missing %q:\n%s", want, got)
		}
	}
}

func busMessage(channel, senderID string) bus.InboundMessage {
	return bus.InboundMessage{
		Channel:  channel,
		SenderID: senderID,
		ChatID:   senderID,
	}
}
