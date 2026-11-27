package godmode

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
)

const defaultRaceLimit = 5

// Request is one God Mode generation request.
type Request struct {
	Model       string
	Models      []string
	Messages    []providers.Message
	MaxTokens   int
	Temperature float64
	Tools       []providers.ToolDef
}

// Result is the winning response plus pipeline metadata.
type Result struct {
	Response *providers.Response
	Metadata Metadata
}

// Engine orchestrates AutoTune, model racing, scoring, STM cleanup, and feedback.
type Engine struct {
	Provider      providers.LLMProvider
	Tuner         *AutoTuner
	Cleaner       *Cleaner
	Feedback      *FeedbackLoop
	Enabled       bool
	RaceLimit     int
	SamplingBoost bool
}

// NewEngine builds an enabled God Mode engine around a provider.
func NewEngine(provider providers.LLMProvider) *Engine {
	return &Engine{
		Provider:      provider,
		Tuner:         NewAutoTuner(),
		Cleaner:       NewCleaner(),
		Feedback:      NewFeedbackLoop(),
		Enabled:       true,
		RaceLimit:     defaultRaceLimit,
		SamplingBoost: true,
	}
}

// Generate runs the full pipeline. If the engine is disabled, it performs a
// single provider call and still applies STM cleanup to keep output tidy.
func (e *Engine) Generate(ctx context.Context, req Request) (*Result, error) {
	if e == nil || e.Provider == nil {
		return nil, errors.New("godmode provider is required")
	}
	if len(req.Messages) == 0 {
		return nil, errors.New("godmode messages are required")
	}
	if req.MaxTokens <= 0 {
		req.MaxTokens = 2048
	}
	if req.Model == "" {
		req.Model = firstNonEmpty(req.Models...)
	}
	if req.Model == "" {
		return nil, errors.New("godmode model is required")
	}

	tuner := e.Tuner
	if tuner == nil {
		tuner = NewAutoTuner()
	}
	cleaner := e.Cleaner
	if cleaner == nil {
		cleaner = NewCleaner()
	}

	current := lastUserMessage(req.Messages)
	history := historyText(req.Messages)
	params, classification := tuner.Tune(current, history, e.SamplingBoost)
	feedbackState := FeedbackProfileState{Context: classification.Context}
	if e.Feedback != nil {
		params, feedbackState = e.Feedback.Adjust(classification.Context, params)
	}

	models := []string{req.Model}
	if e.Enabled {
		models = selectModels(req.Model, req.Models, classification.Context, e.raceLimit())
	}
	messages := enrichMessages(req.Messages, classification)

	candidates := e.callCandidates(ctx, req, messages, models, params, cleaner, classification.Context, current)
	bestIndex := -1
	for i := range candidates {
		if candidates[i].err != nil || candidates[i].response == nil {
			continue
		}
		if bestIndex == -1 || candidates[i].meta.Score.Total > candidates[bestIndex].meta.Score.Total {
			bestIndex = i
		}
	}
	if bestIndex == -1 {
		return nil, fmt.Errorf("godmode all candidates failed: %w", firstCandidateError(candidates))
	}

	winner := candidates[bestIndex]
	metadata := Metadata{
		Classification: classification,
		Params:         params,
		WinnerModel:    winner.meta.Model,
		Candidates:     make([]CandidateMetadata, 0, len(candidates)),
		ReasoningStrip: winner.reasoningStrip,
		Transforms:     winner.meta.Applied,
		Feedback:       feedbackState,
	}
	for _, candidate := range candidates {
		metadata.Candidates = append(metadata.Candidates, candidate.meta)
	}

	return &Result{Response: winner.response, Metadata: metadata}, nil
}

// RecordFeedback feeds a rating back into the EMA loop.
func (e *Engine) RecordFeedback(ctx ContextType, params SamplingParams, positive bool) {
	if e == nil {
		return
	}
	if e.Feedback == nil {
		e.Feedback = NewFeedbackLoop()
	}
	e.Feedback.Record(ctx, params, positive)
}

type candidateResult struct {
	response       *providers.Response
	meta           CandidateMetadata
	err            error
	reasoningStrip bool
}

func (e *Engine) callCandidates(
	ctx context.Context,
	req Request,
	messages []providers.Message,
	models []string,
	params SamplingParams,
	cleaner *Cleaner,
	classification ContextType,
	query string,
) []candidateResult {
	results := make([]candidateResult, len(models))
	var wg sync.WaitGroup
	for i, model := range models {
		wg.Add(1)
		go func(i int, model string) {
			defer wg.Done()
			start := time.Now()
			resp, err := e.Provider.Chat(ctx, providers.ChatOptions{
				Model:             model,
				Messages:          messages,
				MaxTokens:         req.MaxTokens,
				Temperature:       params.Temperature,
				TopP:              params.TopP,
				TopK:              params.TopK,
				FrequencyPenalty:  params.FrequencyPenalty,
				PresencePenalty:   params.PresencePenalty,
				RepetitionPenalty: params.RepetitionPenalty,
				Tools:             req.Tools,
			})
			meta := CandidateMetadata{Model: model, Latency: time.Since(start)}
			if err != nil {
				meta.Error = err.Error()
				results[i] = candidateResult{meta: meta, err: err}
				return
			}
			if resp == nil {
				err := errors.New("nil provider response")
				meta.Error = err.Error()
				results[i] = candidateResult{meta: meta, err: err}
				return
			}
			cleaned, applied, stripped := cleaner.Normalize(resp.Content)
			respCopy := *resp
			respCopy.Content = cleaned
			if respCopy.StopReason == "" {
				respCopy.StopReason = "end_turn"
			}
			meta.Score = ScoreResponse(cleaned, query, classification)
			meta.Applied = applied
			meta.InputToks = resp.InputTokens
			meta.OutputTok = resp.OutputTokens
			results[i] = candidateResult{
				response:       &respCopy,
				meta:           meta,
				reasoningStrip: stripped,
			}
		}(i, model)
	}
	wg.Wait()
	return results
}

func (e *Engine) raceLimit() int {
	if e.RaceLimit <= 0 {
		return defaultRaceLimit
	}
	return e.RaceLimit
}

func selectModels(active string, configured []string, ctx ContextType, limit int) []string {
	if limit <= 0 {
		limit = defaultRaceLimit
	}

	seen := make(map[string]bool)
	models := make([]string, 0, len(configured)+1)
	add := func(model string) {
		model = strings.TrimSpace(model)
		if model == "" || seen[model] {
			return
		}
		seen[model] = true
		models = append(models, model)
	}
	add(active)
	for _, model := range configured {
		add(model)
	}

	switch ctx {
	case ContextCode, ContextAnalytical:
		sort.SliceStable(models, func(i, j int) bool {
			return modelSpecializationScore(models[i]) > modelSpecializationScore(models[j])
		})
	case ContextExecution, ContextTrading:
		// Keep active model first for lower latency and operator consistency.
	default:
	}

	if len(models) > limit {
		models = models[:limit]
	}
	return models
}

func modelSpecializationScore(model string) int {
	lower := strings.ToLower(model)
	score := 0
	for _, marker := range []string{"mimo", "coder", "code", "deepseek", "qwen", "reason", "sonnet", "opus"} {
		if strings.Contains(lower, marker) {
			score++
		}
	}
	return score
}

func enrichMessages(messages []providers.Message, classification Classification) []providers.Message {
	addon := fmt.Sprintf(`## Go God Mode Runtime

- Context profile: %s (confidence %.2f)
- Answer directly with dense, decision-useful signal.
- State assumptions and stale or missing data explicitly.
- Preserve all trust gates, approval requirements, and trading risk rules.
- For trades, include entry, stop, target, invalidation, confidence, and risk when enough data exists.`,
		classification.Context, classification.Confidence)

	out := make([]providers.Message, len(messages))
	copy(out, messages)
	for i := range out {
		if out[i].Role == "system" {
			out[i].Content = strings.TrimSpace(out[i].Content) + "\n\n" + addon
			return out
		}
	}
	return append([]providers.Message{{Role: "system", Content: addon}}, out...)
}

func lastUserMessage(messages []providers.Message) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			return messages[i].Content
		}
	}
	return messages[len(messages)-1].Content
}

func historyText(messages []providers.Message) []string {
	out := make([]string, 0, len(messages))
	lastUser := -1
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			lastUser = i
			break
		}
	}
	for i, msg := range messages {
		if i == lastUser || msg.Role == "system" {
			continue
		}
		out = append(out, msg.Content)
	}
	return out
}

func firstCandidateError(candidates []candidateResult) error {
	for _, candidate := range candidates {
		if candidate.err != nil {
			return candidate.err
		}
	}
	return errors.New("no candidate response")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
