// Package autoreply sanitizes inbound and outbound chat text for user-facing
// channels. It adapts the old TypeScript auto-reply/session text helpers into
// the Go runtime used by Telegram, SolanaOS Control, and daemon chat flows.
package autoreply

import (
	"encoding/json"
	"strings"
)

type ThinkingLevel string

const (
	ThinkingNone   ThinkingLevel = "none"
	ThinkingLow    ThinkingLevel = "low"
	ThinkingMedium ThinkingLevel = "medium"
	ThinkingHigh   ThinkingLevel = "high"
)

var ThinkingLevels = []ThinkingLevel{
	ThinkingNone,
	ThinkingLow,
	ThinkingMedium,
	ThinkingHigh,
}

// ExtractThinkingContent removes internal reasoning blocks from visible text and
// returns both the extracted reasoning and the cleaned user-visible text.
func ExtractThinkingContent(text string) (thinking string, visible string) {
	visible = strings.TrimSpace(text)
	var collected []string

	for _, pair := range [][2]string{
		{"<thinking>", "</thinking>"},
		{"<analysis>", "</analysis>"},
		{"```thinking", "```"},
		{"```analysis", "```"},
	} {
		var extracted []string
		visible, extracted = stripTaggedBlocks(visible, pair[0], pair[1])
		collected = append(collected, extracted...)
	}

	return strings.TrimSpace(strings.Join(collected, "\n\n")), strings.TrimSpace(visible)
}

func StripThinkingTags(text string) string {
	_, visible := ExtractThinkingContent(text)
	return visible
}

func FormatThinkingLevels() string {
	parts := make([]string, 0, len(ThinkingLevels))
	for _, level := range ThinkingLevels {
		parts = append(parts, string(level))
	}
	return strings.Join(parts, ", ")
}

func NormalizeThinkLevel(raw string) ThinkingLevel {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(ThinkingLow):
		return ThinkingLow
	case string(ThinkingMedium):
		return ThinkingMedium
	case string(ThinkingHigh):
		return ThinkingHigh
	default:
		return ThinkingNone
	}
}

func NormalizeVerboseLevel(raw string) string {
	if strings.EqualFold(strings.TrimSpace(raw), "on") {
		return "on"
	}
	return "off"
}

func ResolveThinkingDefaultForModel(_ string) ThinkingLevel {
	return ThinkingNone
}

// StripInboundMetadata removes obvious transport/system metadata prefixes from
// user messages while leaving the human-authored message body intact.
func StripInboundMetadata(text string) string {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	start := 0
	for start < len(lines) {
		line := strings.TrimSpace(lines[start])
		if line == "" {
			start++
			continue
		}
		if isInboundMetadataLine(line) {
			start++
			continue
		}
		break
	}
	return strings.TrimSpace(strings.Join(lines[start:], "\n"))
}

// StripAssistantInternalScaffolding removes leaked assistant-only scaffolding
// from the final answer that reaches user channels.
func StripAssistantInternalScaffolding(text string) string {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	start := 0
	for start < len(lines) {
		line := strings.TrimSpace(lines[start])
		if line == "" {
			start++
			continue
		}
		lower := strings.ToLower(line)
		switch {
		case strings.HasPrefix(lower, "analysis:"),
			strings.HasPrefix(lower, "thinking:"),
			strings.HasPrefix(lower, "reasoning:"),
			strings.HasPrefix(lower, "internal:"),
			lower == "assistant:",
			lower == "reply:",
			lower == "response:":
			start++
			continue
		}
		break
	}
	return strings.TrimSpace(strings.Join(lines[start:], "\n"))
}

// StripEnvelope unwraps simple assistant envelopes such as JSON response
// wrappers or role prefixes.
func StripEnvelope(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}

	var payload map[string]any
	if json.Unmarshal([]byte(text), &payload) == nil {
		for _, key := range []string{"reply", "response", "message", "content", "text"} {
			if value, ok := payload[key].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
	}

	for _, prefix := range []string{"assistant:", "reply:", "response:"} {
		if strings.HasPrefix(strings.ToLower(text), prefix) {
			return strings.TrimSpace(text[len(prefix):])
		}
	}

	return text
}

func WrapEnvelope(text string) string {
	return strings.TrimSpace(text)
}

func VisibleAssistantText(text string) string {
	text = StripEnvelope(text)
	text = StripThinkingTags(text)
	text = StripAssistantInternalScaffolding(text)
	text = strings.TrimSpace(text)
	if text == "" {
		return "..."
	}
	return text
}

func SanitizeInboundUserText(text string) string {
	text = StripEnvelope(text)
	text = StripInboundMetadata(text)
	return strings.TrimSpace(text)
}

func stripTaggedBlocks(text, openTag, closeTag string) (string, []string) {
	var blocks []string
	for {
		lower := strings.ToLower(text)
		start := strings.Index(lower, strings.ToLower(openTag))
		if start < 0 {
			return text, blocks
		}
		afterOpen := start + len(openTag)
		end := strings.Index(lower[afterOpen:], strings.ToLower(closeTag))
		if end < 0 {
			return text, blocks
		}
		end += afterOpen
		block := strings.TrimSpace(text[afterOpen:end])
		if block != "" {
			blocks = append(blocks, block)
		}
		text = strings.TrimSpace(text[:start] + text[end+len(closeTag):])
	}
}

func isInboundMetadataLine(line string) bool {
	lower := strings.ToLower(strings.TrimSpace(line))
	for _, prefix := range []string{
		"sender:",
		"from:",
		"chat:",
		"channel:",
		"thread:",
		"message id:",
		"message-id:",
		"metadata:",
		"source:",
		"platform:",
		"telegram:",
		"discord:",
		"slack:",
	} {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return strings.HasPrefix(lower, "[telegram]") ||
		strings.HasPrefix(lower, "[discord]") ||
		strings.HasPrefix(lower, "[system]") ||
		strings.HasPrefix(lower, "[meta]")
}
