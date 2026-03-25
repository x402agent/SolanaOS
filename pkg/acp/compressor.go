// Package acp — context compressor for managing context window limits.
// Adapted from Hermes Agent's context_compressor.py pattern.
//
// When the conversation exceeds a token threshold, middle turns are
// summarized by an auxiliary LLM call, preserving the most recent
// turns and system context intact.
package acp

import (
	"context"
	"fmt"
	"strings"
)

// Message represents a conversation turn.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompressorConfig controls when and how compression triggers.
type CompressorConfig struct {
	// Threshold is the fraction of max context at which compression triggers (0.0-1.0).
	// Default: 0.85
	Threshold float64

	// MaxContextTokens is the model's context window size.
	MaxContextTokens int

	// PreserveRecent is how many recent messages to keep uncompressed.
	// Default: 6
	PreserveRecent int

	// SummaryModel is the model to use for summarization.
	SummaryModel string

	// SummarizeFunc is called to generate a summary of the compressed turns.
	// If nil, compression is skipped.
	SummarizeFunc func(ctx context.Context, messages []Message) (string, error)
}

// DefaultCompressorConfig returns sensible defaults.
func DefaultCompressorConfig() CompressorConfig {
	return CompressorConfig{
		Threshold:        0.85,
		MaxContextTokens: 128000,
		PreserveRecent:   6,
		SummaryModel:     "google/gemini-3-flash-preview",
	}
}

// EstimateTokens gives a rough token count for a message (4 chars ≈ 1 token).
func EstimateTokens(content string) int {
	return len(content) / 4
}

// EstimateMessagesTokens totals the estimated tokens for a slice of messages.
func EstimateMessagesTokens(messages []Message) int {
	total := 0
	for _, m := range messages {
		total += EstimateTokens(m.Content) + 4 // role overhead
	}
	return total
}

// ShouldCompress returns true if the messages exceed the threshold.
func ShouldCompress(cfg CompressorConfig, messages []Message) bool {
	tokens := EstimateMessagesTokens(messages)
	limit := int(float64(cfg.MaxContextTokens) * cfg.Threshold)
	return tokens > limit
}

// Compress replaces middle messages with a summary, preserving the first
// message (system prompt) and the last PreserveRecent messages.
//
// Returns the compressed message slice and whether compression occurred.
func Compress(ctx context.Context, cfg CompressorConfig, messages []Message) ([]Message, bool, error) {
	if !ShouldCompress(cfg, messages) {
		return messages, false, nil
	}

	if cfg.SummarizeFunc == nil {
		return messages, false, nil
	}

	if len(messages) <= cfg.PreserveRecent+2 {
		// Too few messages to compress meaningfully
		return messages, false, nil
	}

	// Keep first message (system) and last N messages
	preserveStart := 1 // first message (system prompt)
	preserveEnd := cfg.PreserveRecent
	if preserveEnd > len(messages)-2 {
		preserveEnd = len(messages) - 2
	}

	middleStart := preserveStart
	middleEnd := len(messages) - preserveEnd

	if middleEnd <= middleStart {
		return messages, false, nil
	}

	middle := messages[middleStart:middleEnd]

	summary, err := cfg.SummarizeFunc(ctx, middle)
	if err != nil {
		return messages, false, fmt.Errorf("compression summary failed: %w", err)
	}

	// Build compressed message list
	compressed := make([]Message, 0, 2+preserveEnd)
	compressed = append(compressed, messages[0]) // system prompt
	compressed = append(compressed, Message{
		Role: "system",
		Content: fmt.Sprintf("[Context compressed: %d turns summarized]\n\n%s",
			len(middle), strings.TrimSpace(summary)),
	})
	compressed = append(compressed, messages[middleEnd:]...) // recent messages

	return compressed, true, nil
}
