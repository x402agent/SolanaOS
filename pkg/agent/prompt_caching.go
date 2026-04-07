// Package agent — prompt_caching.go manages stable prompt prefixes for Anthropic cache hits.
// Adapted from Hermes Agent's prompt_caching.py.
//
// Anthropic charges less for cached prompt prefixes. To maximize cache hits,
// the system prompt should remain stable across turns. Dynamic context
// (Honcho, skills, live data) goes in a separate section that changes per turn.
package agent

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// CachedPrompt splits the system prompt into a stable prefix (cacheable)
// and a dynamic suffix (changes per turn).
type CachedPrompt struct {
	StablePrefix string // identity + skills guidance + memory guidance
	DynamicSuffix string // Honcho context + live data + session-specific info
	PrefixHash   string // SHA-256 of prefix for cache key tracking
}

// BuildCachedPrompt assembles a prompt with a stable cacheable prefix.
func BuildCachedPrompt(identity, memoryGuidance, skillsGuidance string, dynamicSections ...string) CachedPrompt {
	var prefix strings.Builder
	prefix.WriteString(identity)
	if memoryGuidance != "" {
		prefix.WriteString("\n\n")
		prefix.WriteString(memoryGuidance)
	}
	if skillsGuidance != "" {
		prefix.WriteString("\n\n")
		prefix.WriteString(skillsGuidance)
	}

	stablePrefix := strings.TrimSpace(prefix.String())
	dynamicSuffix := strings.TrimSpace(strings.Join(dynamicSections, "\n\n"))

	hash := sha256.Sum256([]byte(stablePrefix))

	return CachedPrompt{
		StablePrefix:  stablePrefix,
		DynamicSuffix: dynamicSuffix,
		PrefixHash:    fmt.Sprintf("%x", hash[:8]),
	}
}

// FullPrompt returns the complete system prompt.
func (cp CachedPrompt) FullPrompt() string {
	if cp.DynamicSuffix == "" {
		return cp.StablePrefix
	}
	return cp.StablePrefix + "\n\n" + cp.DynamicSuffix
}

// IsPrefixUnchanged returns true if the prefix hash matches a previous value.
func (cp CachedPrompt) IsPrefixUnchanged(previousHash string) bool {
	return cp.PrefixHash == previousHash
}
