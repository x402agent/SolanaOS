// Package agent — compressor.go implements context window compression.
// Adapted from Hermes Agent's context_compressor.py.
//
// When the conversation history approaches the model's context limit,
// middle turns are summarized to free space while preserving the system
// prompt and recent exchanges.
package agent

import (
	"context"
	"fmt"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
)

// CompressorConfig controls when and how context compression triggers.
type CompressorConfig struct {
	Enabled          bool    // whether compression is active
	Threshold        float64 // fraction of max context (default 0.85)
	MaxContextTokens int     // model context window
	PreserveRecent   int     // recent messages to keep (default 6)
	SummaryModel     string  // model for summarization
}

// DefaultCompressorConfig returns sensible defaults.
func DefaultCompressorConfig() CompressorConfig {
	return CompressorConfig{
		Enabled:          true,
		Threshold:        0.85,
		MaxContextTokens: 128000,
		PreserveRecent:   6,
		SummaryModel:     "google/gemini-3-flash-preview",
	}
}

// Conversation is a slice of role+content turns for compression.
type ConversationTurn struct {
	Role    string
	Content string
}

// EstimateTokens estimates token count (~4 chars per token).
func EstimateTokens(text string) int {
	return (len(text) + 3) / 4
}

// ConversationTokens estimates total tokens across turns.
func ConversationTokens(turns []ConversationTurn) int {
	total := 0
	for _, t := range turns {
		total += EstimateTokens(t.Content) + 4
	}
	return total
}

// ShouldCompress returns true if the conversation exceeds the threshold.
func ShouldCompress(cfg CompressorConfig, turns []ConversationTurn) bool {
	if !cfg.Enabled {
		return false
	}
	tokens := ConversationTokens(turns)
	limit := int(float64(cfg.MaxContextTokens) * cfg.Threshold)
	return tokens > limit
}

// SummarizeFunc is called to generate a summary of compressed turns.
type SummarizeFunc func(ctx context.Context, turns []ConversationTurn) (string, error)

// CompressConversation replaces middle turns with a summary.
// Returns the compressed turns, whether compression occurred, and any error.
func CompressConversation(
	ctx context.Context,
	cfg CompressorConfig,
	turns []ConversationTurn,
	summarize SummarizeFunc,
) ([]ConversationTurn, bool, error) {
	if !ShouldCompress(cfg, turns) {
		return turns, false, nil
	}
	if summarize == nil {
		return turns, false, nil
	}
	if len(turns) <= cfg.PreserveRecent+2 {
		return turns, false, nil
	}

	// Keep first turn (system) and last N turns
	middleStart := 1
	middleEnd := len(turns) - cfg.PreserveRecent
	if middleEnd <= middleStart {
		return turns, false, nil
	}

	middle := turns[middleStart:middleEnd]
	logger.Info(fmt.Sprintf("[compressor] Compressing %d middle turns (tokens est: %d)", len(middle), ConversationTokens(middle)))

	summary, err := summarize(ctx, middle)
	if err != nil {
		logger.Warn(fmt.Sprintf("[compressor] Summary failed: %v", err))
		return turns, false, err
	}

	compressed := make([]ConversationTurn, 0, 2+cfg.PreserveRecent)
	compressed = append(compressed, turns[0]) // system prompt
	compressed = append(compressed, ConversationTurn{
		Role: "system",
		Content: fmt.Sprintf("[Context compressed: %d turns summarized]\n\n%s",
			len(middle), strings.TrimSpace(summary)),
	})
	compressed = append(compressed, turns[middleEnd:]...)

	logger.Info(fmt.Sprintf("[compressor] Compressed %d → %d turns (saved ~%d tokens)",
		len(turns), len(compressed), ConversationTokens(middle)-EstimateTokens(summary)))

	return compressed, true, nil
}
