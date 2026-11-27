package godmode

import (
	"sync"
	"time"
)

const (
	defaultFeedbackAlpha = 0.30
	defaultMaxRecords    = 500
	minFeedbackSamples   = 3
	fullFeedbackSamples  = 20
	maxFeedbackInfluence = 0.50
)

// FeedbackRecord stores one binary rating for an answer profile.
type FeedbackRecord struct {
	Context  ContextType    `json:"context"`
	Params   SamplingParams `json:"params"`
	Positive bool           `json:"positive"`
	At       time.Time      `json:"at"`
}

// FeedbackProfileState is a read-only snapshot of learned feedback state.
type FeedbackProfileState struct {
	Context       ContextType `json:"context,omitempty"`
	Positive      int         `json:"positive"`
	Negative      int         `json:"negative"`
	Total         int         `json:"total"`
	AppliedWeight float64     `json:"applied_weight"`
}

type feedbackProfile struct {
	pos       SamplingParams
	neg       SamplingParams
	positive  int
	negative  int
	posInited bool
	negInited bool
}

// FeedbackLoop nudges sampling params toward positively rated profiles.
type FeedbackLoop struct {
	mu       sync.RWMutex
	alpha    float64
	max      int
	profiles map[ContextType]*feedbackProfile
	records  []FeedbackRecord
}

// NewFeedbackLoop creates an EMA-based online feedback loop.
func NewFeedbackLoop() *FeedbackLoop {
	return &FeedbackLoop{
		alpha:    defaultFeedbackAlpha,
		max:      defaultMaxRecords,
		profiles: make(map[ContextType]*feedbackProfile),
	}
}

// Record adds one binary rating.
func (f *FeedbackLoop) Record(ctx ContextType, params SamplingParams, positive bool) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()

	profile := f.profiles[ctx]
	if profile == nil {
		profile = &feedbackProfile{}
		f.profiles[ctx] = profile
	}

	params = clampSampling(params)
	if positive {
		profile.positive++
		if !profile.posInited {
			profile.pos = params
			profile.posInited = true
		} else {
			profile.pos = emaSampling(profile.pos, params, f.alpha)
		}
	} else {
		profile.negative++
		if !profile.negInited {
			profile.neg = params
			profile.negInited = true
		} else {
			profile.neg = emaSampling(profile.neg, params, f.alpha)
		}
	}

	f.records = append(f.records, FeedbackRecord{
		Context:  ctx,
		Params:   params,
		Positive: positive,
		At:       time.Now(),
	})
	if len(f.records) > f.max {
		copy(f.records, f.records[len(f.records)-f.max:])
		f.records = f.records[:f.max]
	}
}

// Adjust applies learned feedback to a parameter profile.
func (f *FeedbackLoop) Adjust(ctx ContextType, params SamplingParams) (SamplingParams, FeedbackProfileState) {
	state := FeedbackProfileState{Context: ctx}
	if f == nil {
		return clampSampling(params), state
	}

	f.mu.RLock()
	profile := f.profiles[ctx]
	if profile == nil {
		f.mu.RUnlock()
		return clampSampling(params), state
	}
	pos := profile.pos
	neg := profile.neg
	positive := profile.positive
	negative := profile.negative
	posInited := profile.posInited
	negInited := profile.negInited
	f.mu.RUnlock()

	total := positive + negative
	state.Positive = positive
	state.Negative = negative
	state.Total = total
	if total < minFeedbackSamples || !posInited || !negInited {
		return clampSampling(params), state
	}

	weight := maxFeedbackInfluence * clampFloat(float64(total)/float64(fullFeedbackSamples), 0, 1)
	state.AppliedWeight = weight
	adjustment := diffSampling(pos, neg)
	adjustment = scaleSampling(adjustment, 0.5*weight)
	return clampSampling(addSampling(params, adjustment)), state
}

// Records returns a copy of the bounded feedback history.
func (f *FeedbackLoop) Records() []FeedbackRecord {
	if f == nil {
		return nil
	}
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := make([]FeedbackRecord, len(f.records))
	copy(out, f.records)
	return out
}

func emaSampling(current, next SamplingParams, alpha float64) SamplingParams {
	return SamplingParams{
		Temperature:       lerp(current.Temperature, next.Temperature, alpha),
		TopP:              lerp(current.TopP, next.TopP, alpha),
		TopK:              int(lerp(float64(current.TopK), float64(next.TopK), alpha)),
		FrequencyPenalty:  lerp(current.FrequencyPenalty, next.FrequencyPenalty, alpha),
		PresencePenalty:   lerp(current.PresencePenalty, next.PresencePenalty, alpha),
		RepetitionPenalty: lerp(current.RepetitionPenalty, next.RepetitionPenalty, alpha),
	}
}

func diffSampling(a, b SamplingParams) SamplingParams {
	return SamplingParams{
		Temperature:       a.Temperature - b.Temperature,
		TopP:              a.TopP - b.TopP,
		TopK:              a.TopK - b.TopK,
		FrequencyPenalty:  a.FrequencyPenalty - b.FrequencyPenalty,
		PresencePenalty:   a.PresencePenalty - b.PresencePenalty,
		RepetitionPenalty: a.RepetitionPenalty - b.RepetitionPenalty,
	}
}

func scaleSampling(p SamplingParams, scale float64) SamplingParams {
	return SamplingParams{
		Temperature:       p.Temperature * scale,
		TopP:              p.TopP * scale,
		TopK:              int(float64(p.TopK) * scale),
		FrequencyPenalty:  p.FrequencyPenalty * scale,
		PresencePenalty:   p.PresencePenalty * scale,
		RepetitionPenalty: p.RepetitionPenalty * scale,
	}
}

func addSampling(a, b SamplingParams) SamplingParams {
	return SamplingParams{
		Temperature:       a.Temperature + b.Temperature,
		TopP:              a.TopP + b.TopP,
		TopK:              a.TopK + b.TopK,
		FrequencyPenalty:  a.FrequencyPenalty + b.FrequencyPenalty,
		PresencePenalty:   a.PresencePenalty + b.PresencePenalty,
		RepetitionPenalty: a.RepetitionPenalty + b.RepetitionPenalty,
	}
}
