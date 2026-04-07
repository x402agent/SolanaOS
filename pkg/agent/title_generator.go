// Package agent — title_generator.go creates short session titles from conversation content.
// Adapted from Hermes Agent's title_generator.py.
package agent

import (
	"strings"
	"unicode"
)

// GenerateTitle creates a short descriptive title from conversation content.
// Returns a max-length title derived from the first substantive user message.
func GenerateTitle(userMessage string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = 50
	}

	// Clean the message
	text := strings.TrimSpace(userMessage)
	if text == "" {
		return "Untitled Session"
	}

	// Remove common prefixes
	for _, prefix := range []string{"hey ", "hi ", "hello ", "please ", "can you ", "could you "} {
		lower := strings.ToLower(text)
		if strings.HasPrefix(lower, prefix) {
			text = text[len(prefix):]
			break
		}
	}

	// Take first sentence or line
	for _, sep := range []string{"\n", ". ", "? ", "! "} {
		if idx := strings.Index(text, sep); idx > 0 && idx < maxLen*2 {
			text = text[:idx]
			break
		}
	}

	// Capitalize first letter
	text = strings.TrimSpace(text)
	if len(text) > 0 {
		runes := []rune(text)
		runes[0] = unicode.ToUpper(runes[0])
		text = string(runes)
	}

	// Truncate
	if len(text) > maxLen {
		text = text[:maxLen-3] + "..."
	}

	if text == "" {
		return "Untitled Session"
	}

	return text
}
