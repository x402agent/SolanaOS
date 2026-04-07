// Package agent — redact.go masks sensitive data in logs and outputs.
// Adapted from Hermes Agent's redact.py.
package agent

import (
	"regexp"
	"strings"
)

var (
	// Solana private keys (base58, 64-88 chars)
	reBase58Key = regexp.MustCompile(`[1-9A-HJ-NP-Za-km-z]{64,88}`)
	// API keys and bearer tokens
	reAPIToken = regexp.MustCompile(`(?i)(sk-[a-zA-Z0-9_-]{20,}|hch-v3-[a-zA-Z0-9_-]+|clh_[a-zA-Z0-9_-]+|Bearer\s+\S{20,})`)
	// Environment variable secrets
	reEnvSecret = regexp.MustCompile(`(?i)(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|API_KEY)\s*=\s*\S+`)
	// Telegram group chat IDs
	reTelegramGroup = regexp.MustCompile(`-100\d{10,13}`)
	// Seed phrases (12 or 24 lowercase words)
	reSeedPhrase = regexp.MustCompile(`(?i)\b(abandon|ability|able|about|above)\b[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+[\s,]+\w+`)
)

// Redact masks sensitive patterns in text for safe logging.
func Redact(text string) string {
	result := text

	// Mask long base58 strings (likely private keys)
	result = reBase58Key.ReplaceAllStringFunc(result, func(match string) string {
		if len(match) < 64 {
			return match
		}
		return match[:4] + "..." + match[len(match)-4:]
	})

	// Mask API tokens
	result = reAPIToken.ReplaceAllStringFunc(result, func(match string) string {
		if len(match) > 12 {
			return match[:8] + "****"
		}
		return "****"
	})

	// Mask env var secrets
	result = reEnvSecret.ReplaceAllStringFunc(result, func(match string) string {
		parts := strings.SplitN(match, "=", 2)
		if len(parts) == 2 {
			return parts[0] + "=****"
		}
		return match
	})

	// Mask Telegram group IDs
	result = reTelegramGroup.ReplaceAllString(result, "-100****")

	// Mask seed phrases
	result = reSeedPhrase.ReplaceAllString(result, "[SEED_PHRASE_REDACTED]")

	return result
}

// RedactForLog is a convenience wrapper that only redacts if the config flag is set.
func RedactForLog(text string, enabled bool) string {
	if !enabled {
		return text
	}
	return Redact(text)
}
