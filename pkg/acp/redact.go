// Package acp — redact.go masks sensitive information in logs and outputs.
// Adapted from Hermes Agent's redact.py pattern.
package acp

import (
	"regexp"
	"strings"
)

var (
	// Private keys (Solana base58, 64-88 chars)
	reBase58Key = regexp.MustCompile(`[1-9A-HJ-NP-Za-km-z]{64,88}`)
	// API keys and tokens
	reAPIKey    = regexp.MustCompile(`(?i)(sk-|hch-|clh_|Bearer |api[_-]?key[=: ]+)\S{10,}`)
	reEnvSecret = regexp.MustCompile(`(?i)(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|API_KEY)\s*=\s*\S+`)
	// Telegram chat IDs (negative group IDs)
	reTelegramID = regexp.MustCompile(`-100\d{10,13}`)
	// Email addresses
	reEmail = regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
)

// RedactSecrets masks sensitive patterns in text for safe logging.
func RedactSecrets(text string) string {
	result := text
	result = reBase58Key.ReplaceAllStringFunc(result, func(match string) string {
		if len(match) < 64 {
			return match
		}
		return match[:4] + "..." + match[len(match)-4:]
	})
	result = reAPIKey.ReplaceAllStringFunc(result, func(match string) string {
		prefix := match
		if idx := strings.IndexAny(match, " =:"); idx > 0 {
			prefix = match[:idx+1]
			return prefix + "****"
		}
		if len(match) > 8 {
			return match[:8] + "****"
		}
		return "****"
	})
	result = reEnvSecret.ReplaceAllStringFunc(result, func(match string) string {
		parts := strings.SplitN(match, "=", 2)
		if len(parts) == 2 {
			return parts[0] + "=****"
		}
		return match
	})
	result = reTelegramID.ReplaceAllString(result, "-100****")
	result = reEmail.ReplaceAllStringFunc(result, func(match string) string {
		parts := strings.SplitN(match, "@", 2)
		if len(parts) == 2 {
			name := parts[0]
			if len(name) > 2 {
				name = name[:2] + "***"
			}
			return name + "@" + parts[1]
		}
		return match
	})
	return result
}
