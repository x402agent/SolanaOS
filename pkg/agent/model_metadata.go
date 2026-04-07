// Package agent — model_metadata.go provides model catalog and pricing info.
// Adapted from Hermes Agent's model_metadata.py and usage_pricing.py.
package agent

import "fmt"

// ModelInfo describes an LLM model's capabilities and pricing.
type ModelInfo struct {
	ID             string  // e.g. "anthropic/claude-opus-4.6"
	DisplayName    string  // e.g. "Claude Opus 4.6"
	Provider       string  // "openrouter", "anthropic", "xai", "ollama"
	ContextWindow  int     // max tokens
	InputPrice     float64 // $ per 1M input tokens
	OutputPrice    float64 // $ per 1M output tokens
	SupportsVision bool
	SupportsTools  bool
	IsLocal        bool // ollama models
}

// UsageStats tracks token consumption and cost for a session.
type UsageStats struct {
	InputTokens     int
	OutputTokens    int
	ReasoningTokens int
	TotalTokens     int
	TotalCost       float64
	ModelID         string
	Turns           int
}

// AddTurn records a turn's usage.
func (u *UsageStats) AddTurn(input, output, reasoning int) {
	u.InputTokens += input
	u.OutputTokens += output
	u.ReasoningTokens += reasoning
	u.TotalTokens += input + output + reasoning
	u.Turns++

	model := KnownModels[u.ModelID]
	if model.InputPrice > 0 {
		u.TotalCost += float64(input) / 1_000_000 * model.InputPrice
		u.TotalCost += float64(output) / 1_000_000 * model.OutputPrice
	}
}

// CostString returns a formatted cost string.
func (u *UsageStats) CostString() string {
	if u.TotalCost < 0.01 {
		return "<$0.01"
	}
	return "$" + formatFloat(u.TotalCost)
}

func formatFloat(f float64) string {
	s := ""
	if f < 0.1 {
		s = fmt.Sprintf("%.4f", f)
	} else if f < 1 {
		s = fmt.Sprintf("%.3f", f)
	} else {
		s = fmt.Sprintf("%.2f", f)
	}
	return s
}

// KnownModels is the catalog of supported models with pricing.
var KnownModels = map[string]ModelInfo{
	// Anthropic
	"anthropic/claude-opus-4.6": {
		ID: "anthropic/claude-opus-4.6", DisplayName: "Claude Opus 4.6",
		Provider: "anthropic", ContextWindow: 200000,
		InputPrice: 15.0, OutputPrice: 75.0,
		SupportsVision: true, SupportsTools: true,
	},
	"anthropic/claude-sonnet-4.6": {
		ID: "anthropic/claude-sonnet-4.6", DisplayName: "Claude Sonnet 4.6",
		Provider: "anthropic", ContextWindow: 200000,
		InputPrice: 3.0, OutputPrice: 15.0,
		SupportsVision: true, SupportsTools: true,
	},
	"anthropic/claude-haiku-4.5": {
		ID: "anthropic/claude-haiku-4.5", DisplayName: "Claude Haiku 4.5",
		Provider: "anthropic", ContextWindow: 200000,
		InputPrice: 0.80, OutputPrice: 4.0,
		SupportsVision: true, SupportsTools: true,
	},

	// OpenRouter popular models
	"openai/gpt-5.4-nano": {
		ID: "openai/gpt-5.4-nano", DisplayName: "GPT-5.4 Nano",
		Provider: "openrouter", ContextWindow: 128000,
		InputPrice: 0.10, OutputPrice: 0.40,
		SupportsVision: true, SupportsTools: true,
	},
	"minimax/minimax-m2.7": {
		ID: "minimax/minimax-m2.7", DisplayName: "MiniMax M2.7",
		Provider: "openrouter", ContextWindow: 1000000,
		InputPrice: 0.10, OutputPrice: 0.30,
		SupportsVision: false, SupportsTools: true,
	},
	"xiaomi/mimo-v2-pro": {
		ID: "xiaomi/mimo-v2-pro", DisplayName: "Mimo v2 Pro",
		Provider: "openrouter", ContextWindow: 128000,
		InputPrice: 0.0, OutputPrice: 0.0,
		SupportsVision: false, SupportsTools: true,
	},
	"google/gemini-3-flash-preview": {
		ID: "google/gemini-3-flash-preview", DisplayName: "Gemini 3 Flash",
		Provider: "openrouter", ContextWindow: 1000000,
		InputPrice: 0.15, OutputPrice: 0.60,
		SupportsVision: true, SupportsTools: true,
	},

	// xAI
	"xai/grok-4-1-fast": {
		ID: "xai/grok-4-1-fast", DisplayName: "Grok 4.1 Fast",
		Provider: "xai", ContextWindow: 131072,
		InputPrice: 3.0, OutputPrice: 15.0,
		SupportsVision: true, SupportsTools: true,
	},

	// Ollama (local, free)
	"8bit/DeepSolana": {
		ID: "8bit/DeepSolana", DisplayName: "DeepSolana",
		Provider: "ollama", ContextWindow: 128000,
		InputPrice: 0.0, OutputPrice: 0.0,
		SupportsVision: false, SupportsTools: false,
		IsLocal: true,
	},
}

// GetModelInfo returns info for a model ID, or a default if unknown.
func GetModelInfo(modelID string) ModelInfo {
	if info, ok := KnownModels[modelID]; ok {
		return info
	}
	return ModelInfo{
		ID:            modelID,
		DisplayName:   modelID,
		Provider:      "unknown",
		ContextWindow: 128000,
		SupportsTools: true,
	}
}
