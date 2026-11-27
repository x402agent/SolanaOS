package godmode

import (
	"math"
	"regexp"
	"strings"
)

var contextPriority = []ContextType{
	ContextCode,
	ContextExecution,
	ContextTrading,
	ContextAnalytical,
	ContextCreative,
	ContextConversational,
	ContextChaotic,
}

var defaultProfiles = map[ContextType]SamplingParams{
	ContextExecution: {
		Temperature: 0.15, TopP: 0.82, TopK: 25,
		FrequencyPenalty: 0.20, PresencePenalty: 0.00, RepetitionPenalty: 1.05,
	},
	ContextTrading: {
		Temperature: 0.35, TopP: 0.86, TopK: 35,
		FrequencyPenalty: 0.20, PresencePenalty: 0.10, RepetitionPenalty: 1.08,
	},
	ContextCode: {
		Temperature: 0.15, TopP: 0.80, TopK: 25,
		FrequencyPenalty: 0.20, PresencePenalty: 0.00, RepetitionPenalty: 1.05,
	},
	ContextCreative: {
		Temperature: 1.15, TopP: 0.95, TopK: 85,
		FrequencyPenalty: 0.50, PresencePenalty: 0.70, RepetitionPenalty: 1.20,
	},
	ContextAnalytical: {
		Temperature: 0.40, TopP: 0.88, TopK: 40,
		FrequencyPenalty: 0.20, PresencePenalty: 0.15, RepetitionPenalty: 1.08,
	},
	ContextConversational: {
		Temperature: 0.75, TopP: 0.90, TopK: 50,
		FrequencyPenalty: 0.10, PresencePenalty: 0.10, RepetitionPenalty: 1.00,
	},
	ContextChaotic: {
		Temperature: 1.70, TopP: 0.99, TopK: 100,
		FrequencyPenalty: 0.80, PresencePenalty: 0.90, RepetitionPenalty: 1.30,
	},
}

var balancedProfile = SamplingParams{
	Temperature:       0.70,
	TopP:              0.90,
	TopK:              50,
	FrequencyPenalty:  0.10,
	PresencePenalty:   0.10,
	RepetitionPenalty: 1.00,
}

// AutoTuner classifies prompts and maps them to sampling parameters.
type AutoTuner struct {
	patterns map[ContextType][]*regexp.Regexp
}

// NewAutoTuner creates the default ClawdBot context tuner.
func NewAutoTuner() *AutoTuner {
	return &AutoTuner{patterns: map[ContextType][]*regexp.Regexp{
		ContextCode: compilePatterns(
			`(?i)\b(code|function|bug|compile|test|package|module|refactor|implementation|golang|typescript|javascript|python|rust)\b`,
			`(?i)\b(write|fix|build|implement|patch|debug)\b.*\b(code|test|function|package|module)\b`,
			"(?i)```",
		),
		ContextExecution: compilePatterns(
			`(?i)\b(execute|run|ship|deploy|commit|release|migrate|start|stop|restart|approve|transaction|swap|order)\b`,
			`(?i)\b(buy|sell|long|short|open|close)\b.*\b(now|market|order|position)\b`,
			`(?i)\b(preflight|dry-run|simulate|paper|live)\b`,
		),
		ContextTrading: compilePatterns(
			`(?i)\b(trade|trading|perp|perps|spot|dex|market|token|sol|jupiter|raydium|phoenix|vulcan|pump)\b`,
			`(?i)\b(entry|stop|target|take profit|tp|sl|risk|invalidation|position|leverage|funding|open interest|liquidity)\b`,
			`(?i)\b(bias|setup|signal|thesis|confidence|rsi|macd|ema|vwap|candle)\b`,
		),
		ContextAnalytical: compilePatterns(
			`(?i)\b(analyze|analysis|compare|tradeoff|explain|why|because|evaluate|assess|research|summarize|diagnose)\b`,
			`(?i)\b(assumption|alternative|evidence|risk|method|model|data|metric|impact)\b`,
		),
		ContextCreative: compilePatterns(
			`(?i)\b(create|brainstorm|name|story|copy|design|imagine|creative|brand|meme|persona|voice|rewrite)\b`,
			`(?i)\b(fun|wild|novel|original|style|tone|campaign|headline)\b`,
		),
		ContextConversational: compilePatterns(
			`(?i)\b(hello|hi|hey|gm|thanks|thank you|how are you|what's up|yo)\b`,
			`(?i)^\s*(ok|okay|cool|nice|yep|nope|sure)\s*[.!?]*\s*$`,
		),
		ContextChaotic: compilePatterns(
			`(?i)\b(chaos|unleash|wild mode|god mode|maximum|turbo|insane|destroy everything|no limits)\b`,
			`(?i)[!]{3,}`,
		),
	}}
}

// Classify detects the best context for current text and recent history.
func (a *AutoTuner) Classify(current string, history []string) Classification {
	if a == nil {
		a = NewAutoTuner()
	}

	scores := make(map[ContextType]int, len(contextPriority))
	a.scoreText(scores, current, 3)

	start := 0
	if len(history) > 4 {
		start = len(history) - 4
	}
	for _, h := range history[start:] {
		a.scoreText(scores, h, 1)
	}

	best := ContextAnalytical
	bestScore := 0
	secondScore := 0
	for _, ctx := range contextPriority {
		score := scores[ctx]
		if score > bestScore {
			secondScore = bestScore
			bestScore = score
			best = ctx
			continue
		}
		if score > secondScore {
			secondScore = score
		}
	}

	if bestScore == 0 {
		return Classification{Context: ContextAnalytical, Confidence: 0.5, Scores: scores}
	}

	confidence := 0.5 + 0.5*(float64(bestScore)/float64(bestScore+secondScore))
	return Classification{
		Context:    best,
		Confidence: clampFloat(confidence, 0.5, 1.0),
		Scores:     scores,
	}
}

// Tune selects sampling parameters for a prompt and optionally applies the
// God Mode boost that favors direct, less repetitive responses.
func (a *AutoTuner) Tune(current string, history []string, boost bool) (SamplingParams, Classification) {
	classification := a.Classify(current, history)
	params := defaultProfiles[classification.Context]
	if classification.Confidence < 0.6 {
		params = blendSampling(balancedProfile, params, classification.Confidence)
	}

	if len(history) > 10 {
		overflow := math.Min(float64(len(history)-10)*0.01, 0.15)
		params.FrequencyPenalty += overflow
		params.RepetitionPenalty += overflow
	}

	if boost {
		params.Temperature += 0.10
		params.PresencePenalty += 0.15
		params.FrequencyPenalty += 0.10
	}

	return clampSampling(params), classification
}

func (a *AutoTuner) scoreText(scores map[ContextType]int, text string, weight int) {
	if strings.TrimSpace(text) == "" {
		return
	}
	for ctx, patterns := range a.patterns {
		for _, pattern := range patterns {
			if pattern.MatchString(text) {
				scores[ctx] += weight
			}
		}
	}
}

func compilePatterns(values ...string) []*regexp.Regexp {
	out := make([]*regexp.Regexp, 0, len(values))
	for _, value := range values {
		out = append(out, regexp.MustCompile(value))
	}
	return out
}

func blendSampling(base, target SamplingParams, weight float64) SamplingParams {
	weight = clampFloat(weight, 0, 1)
	return SamplingParams{
		Temperature:       lerp(base.Temperature, target.Temperature, weight),
		TopP:              lerp(base.TopP, target.TopP, weight),
		TopK:              int(math.Round(lerp(float64(base.TopK), float64(target.TopK), weight))),
		FrequencyPenalty:  lerp(base.FrequencyPenalty, target.FrequencyPenalty, weight),
		PresencePenalty:   lerp(base.PresencePenalty, target.PresencePenalty, weight),
		RepetitionPenalty: lerp(base.RepetitionPenalty, target.RepetitionPenalty, weight),
	}
}

func clampSampling(p SamplingParams) SamplingParams {
	p.Temperature = clampFloat(p.Temperature, 0, 2)
	p.TopP = clampFloat(p.TopP, 0.01, 1)
	if p.TopK < 1 {
		p.TopK = 1
	}
	if p.TopK > 100 {
		p.TopK = 100
	}
	p.FrequencyPenalty = clampFloat(p.FrequencyPenalty, -2, 2)
	p.PresencePenalty = clampFloat(p.PresencePenalty, -2, 2)
	p.RepetitionPenalty = clampFloat(p.RepetitionPenalty, 0.1, 2)
	return p
}

func lerp(a, b, weight float64) float64 {
	return a + (b-a)*weight
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
