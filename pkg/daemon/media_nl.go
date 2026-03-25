package daemon

import (
	"regexp"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
)

var (
	naturalVideoPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?is)^(?:can you|could you|please|pls|use grok to|hand off to grok to|send this to grok to)\s+(.+)$`),
		regexp.MustCompile(`(?is)^(?:make|create|generate|render|produce)(?: me)?\s+(?:a|an)\s+(?:short\s+)?(?:\d{1,2}(?:-|\s)?second\s+)?(?:video|clip|animation)\b(?:\s+(?:of|showing|about|where))?[:\s-]*(.+)$`),
		regexp.MustCompile(`(?is)^(?:video|clip|animation)\b[:\s-]*(.+)$`),
		regexp.MustCompile(`(?is)^animate\s+(.+)$`),
	}
	naturalImagePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?is)^(?:can you|could you|please|pls|use grok to|hand off to grok to|send this to grok to)\s+(.+)$`),
		regexp.MustCompile(`(?is)^(?:make|create|generate|render|produce|design)(?: me)?\s+(?:a|an)\s+(?:image|picture|photo|illustration|poster|wallpaper|piece of art|artwork)\b(?:\s+(?:of|showing|about|where))?[:\s-]*(.+)$`),
		regexp.MustCompile(`(?is)^(?:image|picture|art|artwork|illustration|poster)\b[:\s-]*(.+)$`),
		regexp.MustCompile(`(?is)^(?:draw|illustrate)\s+(.+)$`),
	}
)

func (d *Daemon) maybeHandleMediaGenerationText(msg bus.InboundMessage, content string) (string, bool) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return "", false
	}

	if prompt, ok := extractNaturalImageEditPrompt(trimmed, len(msg.Media) > 0); ok {
		if !d.llm.IsXAIConfigured() {
			return "❌ xAI is not configured. Set `XAI_API_KEY` first.", true
		}
		return d.xaiImageEditResponse(msg, []string{prompt}), true
	}
	if prompt, ok := extractNaturalVideoPrompt(trimmed); ok {
		if !d.llm.IsXAIConfigured() {
			return "❌ xAI is not configured. Set `XAI_API_KEY` first.", true
		}
		return d.xaiVideoResponse([]string{prompt}), true
	}
	if prompt, ok := extractNaturalImagePrompt(trimmed); ok {
		if !d.llm.IsXAIConfigured() {
			return "❌ xAI is not configured. Set `XAI_API_KEY` first.", true
		}
		return d.xaiImageResponse([]string{prompt}), true
	}
	return "", false
}

func extractNaturalVideoPrompt(content string) (string, bool) {
	return extractNaturalMediaPrompt(content, naturalVideoPatterns, []string{
		"video",
		"clip",
		"animation",
		"animate",
		"b-roll",
	})
}

func extractNaturalImagePrompt(content string) (string, bool) {
	return extractNaturalMediaPrompt(content, naturalImagePatterns, []string{
		"image",
		"picture",
		"photo",
		"illustration",
		"poster",
		"artwork",
		"art",
		"draw",
		"illustrate",
	})
}

func extractNaturalImageEditPrompt(content string, hasMedia bool) (string, bool) {
	if !hasMedia {
		return "", false
	}
	lower := strings.ToLower(strings.TrimSpace(content))
	if lower == "" {
		return "", false
	}
	if !containsAny(lower, "edit", "restyle", "modify", "transform", "turn this into", "make this", "change this", "rework this") {
		return "", false
	}
	prompt := cleanupMediaPrompt(content)
	prompt = strings.TrimPrefix(prompt, "/edit")
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "", false
	}
	return prompt, true
}

func extractNaturalMediaPrompt(content string, patterns []*regexp.Regexp, keywords []string) (string, bool) {
	content = strings.TrimSpace(content)
	if content == "" {
		return "", false
	}
	for _, pattern := range patterns {
		match := pattern.FindStringSubmatch(content)
		if len(match) != 2 {
			continue
		}
		candidate := strings.TrimSpace(match[1])
		// The first pattern strips polite lead-ins only. Re-run extraction on the remainder.
		if strings.EqualFold(candidate, content) {
			continue
		}
		if prompt, ok := extractNaturalMediaPrompt(candidate, patterns[1:], keywords); ok {
			return prompt, true
		}
		candidate = cleanupMediaPrompt(candidate)
		if candidate != "" {
			return candidate, true
		}
	}

	lower := strings.ToLower(content)
	if !containsAny(lower, keywords...) {
		return "", false
	}
	return "", false
}

func cleanupMediaPrompt(content string) string {
	content = strings.TrimSpace(content)
	content = strings.Trim(content, "`")
	content = strings.Trim(content, `"`)
	content = strings.Trim(content, "'")
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, ">") {
		content = strings.TrimSpace(strings.TrimPrefix(content, ">"))
	}
	return content
}
