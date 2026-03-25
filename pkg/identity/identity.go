// Package identity provides sender identity resolution for MawdBot.
// Adapted from PicoClaw — canonical "platform:id" format with legacy compat.
package identity

import (
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
)

// Canonical builds a canonical sender ID from platform and ID.
func Canonical(platform, id string) string {
	return platform + ":" + id
}

// Parse splits a canonical ID into platform and ID parts.
func Parse(canonical string) (platform, id string) {
	idx := strings.Index(canonical, ":")
	if idx < 0 {
		return "", canonical
	}
	return canonical[:idx], canonical[idx+1:]
}

// MatchAllowed checks if a SenderInfo matches an allowlist entry.
// Supports both new canonical format ("platform:id") and
// legacy formats ("@username", "123456", "123456|username").
func MatchAllowed(sender bus.SenderInfo, allowed string) bool {
	allowed = strings.TrimPrefix(allowed, "@")

	// Direct canonical match
	if sender.CanonicalID != "" && sender.CanonicalID == allowed {
		return true
	}

	// Platform ID match
	if sender.PlatformID != "" && sender.PlatformID == allowed {
		return true
	}

	// Username match
	if sender.Username != "" && sender.Username == allowed {
		return true
	}

	// Legacy compound "id|username" format
	if idx := strings.Index(allowed, "|"); idx > 0 {
		allowedID := allowed[:idx]
		allowedUser := allowed[idx+1:]
		if sender.PlatformID == allowedID || sender.Username == allowedUser {
			return true
		}
	}

	return false
}
