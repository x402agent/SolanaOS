// Package godmode provides ClawdBot's inference-time quality pipeline.
package godmode

import "time"

// ContextType is the coarse request profile used for sampling and scoring.
type ContextType string

const (
	ContextCode           ContextType = "code"
	ContextExecution      ContextType = "execution"
	ContextTrading        ContextType = "trading"
	ContextAnalytical     ContextType = "analytical"
	ContextCreative       ContextType = "creative"
	ContextConversational ContextType = "conversational"
	ContextChaotic        ContextType = "chaotic"
)

// SamplingParams are provider sampling controls after AutoTune and feedback.
type SamplingParams struct {
	Temperature       float64 `json:"temperature"`
	TopP              float64 `json:"top_p"`
	TopK              int     `json:"top_k"`
	FrequencyPenalty  float64 `json:"frequency_penalty"`
	PresencePenalty   float64 `json:"presence_penalty"`
	RepetitionPenalty float64 `json:"repetition_penalty"`
}

// Classification describes the context detector result.
type Classification struct {
	Context    ContextType         `json:"context"`
	Confidence float64             `json:"confidence"`
	Scores     map[ContextType]int `json:"scores,omitempty"`
}

// ScoreBreakdown is the response quality score used to pick race winners.
type ScoreBreakdown struct {
	Total       int `json:"total"`
	Length      int `json:"length"`
	Structure   int `json:"structure"`
	Directness  int `json:"directness"`
	Relevance   int `json:"relevance"`
	Specificity int `json:"specificity"`
}

// CandidateMetadata records one model attempt in a race.
type CandidateMetadata struct {
	Model     string         `json:"model"`
	Score     ScoreBreakdown `json:"score,omitempty"`
	Error     string         `json:"error,omitempty"`
	Latency   time.Duration  `json:"latency"`
	Applied   []string       `json:"applied,omitempty"`
	InputToks int            `json:"input_tokens,omitempty"`
	OutputTok int            `json:"output_tokens,omitempty"`
}

// Metadata captures the pipeline decisions for observability.
type Metadata struct {
	Classification Classification       `json:"classification"`
	Params         SamplingParams       `json:"params"`
	WinnerModel    string               `json:"winner_model"`
	Candidates     []CandidateMetadata  `json:"candidates"`
	ReasoningStrip bool                 `json:"reasoning_strip"`
	Transforms     []string             `json:"transforms"`
	Feedback       FeedbackProfileState `json:"feedback,omitempty"`
}
