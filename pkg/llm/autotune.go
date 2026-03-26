package llm

import (
	"math"
	"regexp"
	"strings"
	"sync"
	"time"
)

// AutoTuneParams holds the full 6-dimension sampling parameter vector.
type AutoTuneParams struct {
	Temperature      float64 `json:"temperature"`
	TopP             float64 `json:"top_p"`
	TopK             int     `json:"top_k"`
	FrequencyPenalty float64 `json:"frequency_penalty"`
	PresencePenalty  float64 `json:"presence_penalty"`
	RepetitionPenalty float64 `json:"repetition_penalty"`
}

// ContextType represents the detected conversational context.
type ContextType string

const (
	ContextCode           ContextType = "code"
	ContextCreative       ContextType = "creative"
	ContextAnalytical     ContextType = "analytical"
	ContextConversational ContextType = "conversational"
	ContextChaotic        ContextType = "chaotic"
	ContextExecution      ContextType = "execution"
	ContextTrading        ContextType = "trading"
)

// AutoTuneResult carries the computed parameters and detection metadata.
type AutoTuneResult struct {
	Params          AutoTuneParams `json:"params"`
	DetectedContext ContextType    `json:"detectedContext"`
	Confidence      float64        `json:"confidence"`
	Reasoning       string         `json:"reasoning"`
}

// Context detection patterns — extended for Solana trading and execution.
var contextPatterns = map[ContextType][]*regexp.Regexp{
	ContextExecution: {
		regexp.MustCompile(`(?i)\b(buy|sell|swap|ape|exit|dump|long|short|bid|offer|bridge|send|transfer)\b`),
		regexp.MustCompile(`(?i)\b(sol|usdc|usdt|bonk|jup|wif|pump|perp|position|wallet)\b`),
	},
	ContextTrading: {
		regexp.MustCompile(`(?i)\b(set[- ]?up|trade|chart|momentum|volume|liquidity|breakout|breakdown|rsi|ema|vwap|funding|open interest)\b`),
		regexp.MustCompile(`(?i)\b(entry|stop|target|risk|invalidation|bias|thesis|rotation)\b`),
	},
	ContextCode: {
		regexp.MustCompile(`(?i)\b(code|function|class|variable|bug|error|debug|compile|syntax|api|endpoint|regex|algorithm|refactor|typescript|javascript|python|rust|golang|go|html|css|sql|json|import|export|return|async|await|interface|struct)\b`),
		regexp.MustCompile("```[\\s\\S]*```"),
		regexp.MustCompile(`[{}();=><]`),
		regexp.MustCompile(`(?i)\b(stack overflow|github|repo|pull request|commit|merge|test)\b`),
	},
	ContextCreative: {
		regexp.MustCompile(`(?i)\b(write|story|poem|creative|imagine|fiction|narrative|character|plot|scene|dialogue|metaphor|lyrics|song|artistic|fantasy|dream|inspire|prose|verse)\b`),
		regexp.MustCompile(`(?i)\b(roleplay|role-play|pretend|act as|you are a)\b`),
		regexp.MustCompile(`(?i)\b(brainstorm|ideate|come up with|think of|generate ideas)\b`),
	},
	ContextAnalytical: {
		regexp.MustCompile(`(?i)\b(analyze|analysis|compare|contrast|evaluate|assess|examine|investigate|research|study|review|critique|breakdown|data|statistics|metrics|benchmark)\b`),
		regexp.MustCompile(`(?i)\b(pros and cons|advantages|disadvantages|trade-?offs|implications|consequences)\b`),
		regexp.MustCompile(`(?i)\b(why|how does|what causes|explain|elaborate|clarify|define|summarize|overview|report)\b`),
	},
	ContextConversational: {
		regexp.MustCompile(`(?i)\b(hey|hi|hello|gm|thanks|thank you|yo|sup|what's up|lol|haha|cool|nice|awesome)\b`),
		regexp.MustCompile(`^.{0,30}$`),
	},
	ContextChaotic: {
		regexp.MustCompile(`(?i)\b(chaos|random|wild|crazy|absurd|surreal|glitch|corrupt|destroy|unleash|madness|void|entropy)\b`),
		regexp.MustCompile(`(?i)\b(gl1tch|h4ck|pwn|1337|l33t)\b`),
		regexp.MustCompile(`(!{3,}|\?{3,}|\.{4,})`),
	},
}

// Context-to-parameter profile mapping — optimized for each intent.
var contextProfiles = map[ContextType]AutoTuneParams{
	ContextExecution: {
		Temperature:       0.15,
		TopP:              0.82,
		TopK:              25,
		FrequencyPenalty:  0.2,
		PresencePenalty:   0.0,
		RepetitionPenalty: 1.05,
	},
	ContextTrading: {
		Temperature:       0.35,
		TopP:              0.86,
		TopK:              35,
		FrequencyPenalty:  0.2,
		PresencePenalty:   0.1,
		RepetitionPenalty: 1.08,
	},
	ContextCode: {
		Temperature:       0.15,
		TopP:              0.80,
		TopK:              25,
		FrequencyPenalty:  0.2,
		PresencePenalty:   0.0,
		RepetitionPenalty: 1.05,
	},
	ContextCreative: {
		Temperature:       1.15,
		TopP:              0.95,
		TopK:              85,
		FrequencyPenalty:  0.5,
		PresencePenalty:   0.7,
		RepetitionPenalty: 1.20,
	},
	ContextAnalytical: {
		Temperature:       0.40,
		TopP:              0.88,
		TopK:              40,
		FrequencyPenalty:  0.2,
		PresencePenalty:   0.15,
		RepetitionPenalty: 1.08,
	},
	ContextConversational: {
		Temperature:       0.75,
		TopP:              0.90,
		TopK:              50,
		FrequencyPenalty:  0.1,
		PresencePenalty:   0.1,
		RepetitionPenalty: 1.0,
	},
	ContextChaotic: {
		Temperature:       1.70,
		TopP:              0.99,
		TopK:              100,
		FrequencyPenalty:  0.8,
		PresencePenalty:   0.9,
		RepetitionPenalty: 1.30,
	},
}

// Profile priority for tie-breaking (lower = higher priority).
var contextPriority = map[ContextType]int{
	ContextCode:           0,
	ContextExecution:      1,
	ContextTrading:        2,
	ContextAnalytical:     3,
	ContextCreative:       4,
	ContextConversational: 5,
	ContextChaotic:        6,
}

// Balanced baseline used for blending when confidence is low.
var balancedBaseline = AutoTuneParams{
	Temperature:       0.7,
	TopP:              0.9,
	TopK:              50,
	FrequencyPenalty:  0.1,
	PresencePenalty:   0.1,
	RepetitionPenalty: 1.0,
}

// DetectAutoTuneContext scores the message and history to detect conversational context.
func DetectAutoTuneContext(message string, history []Message) (ContextType, float64) {
	scores := map[ContextType]int{}
	for ctx := range contextPatterns {
		scores[ctx] = 0
	}

	// Score current message (weighted 3x).
	for ctx, patterns := range contextPatterns {
		for _, pattern := range patterns {
			if pattern.MatchString(message) {
				scores[ctx] += 3
			}
		}
	}

	// Score last 4 history messages (weighted 1x each).
	start := 0
	if len(history) > 4 {
		start = len(history) - 4
	}
	for _, msg := range history[start:] {
		for ctx, patterns := range contextPatterns {
			for _, pattern := range patterns {
				if pattern.MatchString(msg.Content) {
					scores[ctx]++
				}
			}
		}
	}

	// Find winner with tie-breaking by priority.
	bestCtx := ContextConversational
	bestScore := 0
	total := 0
	for ctx, score := range scores {
		total += score
		if score > bestScore || (score == bestScore && contextPriority[ctx] < contextPriority[bestCtx]) {
			bestCtx = ctx
			bestScore = score
		}
	}

	if total == 0 {
		return ContextAnalytical, 0.5
	}
	confidence := float64(bestScore) / float64(total)
	return bestCtx, confidence
}

// ComputeAutoTuneParams computes optimal sampling parameters for the detected context.
func ComputeAutoTuneParams(message string, history []Message, feedback *FeedbackState) AutoTuneResult {
	ctx, confidence := DetectAutoTuneContext(message, history)
	profile := contextProfiles[ctx]

	// Blend with balanced baseline when confidence is low.
	if confidence < 0.6 {
		profile = blendAutoTuneParams(profile, balancedBaseline, 1-confidence)
	}

	// Long conversation penalty: reduce repetition.
	convLen := len(history)
	if convLen > 10 {
		boost := math.Min(float64(convLen-10)*0.01, 0.15)
		profile.RepetitionPenalty += boost
		profile.FrequencyPenalty += boost * 0.5
	}

	// Apply learned feedback adjustments if available.
	reasoning := contextLabel(ctx) + " detected"
	if feedback != nil {
		adjusted, applied, note := feedback.ApplyAdjustments(profile, ctx)
		if applied {
			profile = adjusted
			reasoning += " | " + note
		}
	}

	// Clamp to valid ranges.
	profile = clampAutoTuneParams(profile)

	return AutoTuneResult{
		Params:          profile,
		DetectedContext: ctx,
		Confidence:      confidence,
		Reasoning:       reasoning,
	}
}

// GodModeBoost applies additive parameter boosts for god mode liberation.
func GodModeBoost(params AutoTuneParams) AutoTuneParams {
	params.Temperature = math.Min(params.Temperature+0.1, 2.0)
	params.PresencePenalty = math.Min(params.PresencePenalty+0.15, 2.0)
	params.FrequencyPenalty = math.Min(params.FrequencyPenalty+0.1, 2.0)
	return params
}

func blendAutoTuneParams(a, b AutoTuneParams, weight float64) AutoTuneParams {
	w := math.Max(0, math.Min(weight, 1))
	iw := 1 - w
	return AutoTuneParams{
		Temperature:       a.Temperature*iw + b.Temperature*w,
		TopP:              a.TopP*iw + b.TopP*w,
		TopK:              int(math.Round(float64(a.TopK)*iw + float64(b.TopK)*w)),
		FrequencyPenalty:  a.FrequencyPenalty*iw + b.FrequencyPenalty*w,
		PresencePenalty:   a.PresencePenalty*iw + b.PresencePenalty*w,
		RepetitionPenalty: a.RepetitionPenalty*iw + b.RepetitionPenalty*w,
	}
}

func clampAutoTuneParams(p AutoTuneParams) AutoTuneParams {
	return AutoTuneParams{
		Temperature:       math.Max(0, math.Min(p.Temperature, 2.0)),
		TopP:              math.Max(0, math.Min(p.TopP, 1.0)),
		TopK:              clampInt(p.TopK, 1, 100),
		FrequencyPenalty:  math.Max(-2, math.Min(p.FrequencyPenalty, 2.0)),
		PresencePenalty:   math.Max(-2, math.Min(p.PresencePenalty, 2.0)),
		RepetitionPenalty: math.Max(0, math.Min(p.RepetitionPenalty, 2.0)),
	}
}

func contextLabel(ctx ContextType) string {
	labels := map[ContextType]string{
		ContextCode:           "CODE",
		ContextCreative:       "CREATIVE",
		ContextAnalytical:     "ANALYTICAL",
		ContextConversational: "CHAT",
		ContextChaotic:        "CHAOS",
		ContextExecution:      "EXECUTION",
		ContextTrading:        "TRADING",
	}
	if l, ok := labels[ctx]; ok {
		return l
	}
	return string(ctx)
}

// ════════════════════════════════════════════════════════════════════════
// EMA Feedback Loop
// ════════════════════════════════════════════════════════════════════════

const (
	emaAlpha            = 0.3  // Weight for new observations
	maxFeedbackHistory  = 500
	minSamplesToApply   = 3
	maxLearnedWeight    = 0.5
	samplesForMaxWeight = 20
)

// FeedbackRecord stores a single user rating with associated parameters.
type FeedbackRecord struct {
	MessageID   string         `json:"messageId"`
	Timestamp   int64          `json:"timestamp"`
	ContextType ContextType    `json:"contextType"`
	Model       string         `json:"model"`
	Params      AutoTuneParams `json:"params"`
	Rating      int            `json:"rating"` // +1 or -1
}

// LearnedProfile holds EMA-learned parameter preferences for a context type.
type LearnedProfile struct {
	ContextType   ContextType    `json:"contextType"`
	SampleCount   int            `json:"sampleCount"`
	PositiveCount int            `json:"positiveCount"`
	NegativeCount int            `json:"negativeCount"`
	PositiveEMA   AutoTuneParams `json:"positiveEma"`
	NegativeEMA   AutoTuneParams `json:"negativeEma"`
	Adjustments   AutoTuneParams `json:"adjustments"`
	LastUpdated   int64          `json:"lastUpdated"`
}

// FeedbackState manages the online learning loop.
type FeedbackState struct {
	mu       sync.RWMutex
	History  []FeedbackRecord                `json:"history"`
	Profiles map[ContextType]*LearnedProfile `json:"profiles"`
}

// Neutral starting params for EMA initialization.
var neutralParams = AutoTuneParams{
	Temperature:       0.7,
	TopP:              0.9,
	TopK:              50,
	FrequencyPenalty:  0.2,
	PresencePenalty:   0.2,
	RepetitionPenalty: 1.1,
}

// NewFeedbackState creates an empty feedback state with initialized profiles.
func NewFeedbackState() *FeedbackState {
	profiles := map[ContextType]*LearnedProfile{}
	for _, ctx := range []ContextType{ContextCode, ContextCreative, ContextAnalytical, ContextConversational, ContextChaotic, ContextExecution, ContextTrading} {
		profiles[ctx] = &LearnedProfile{
			ContextType: ctx,
			PositiveEMA: neutralParams,
			NegativeEMA: neutralParams,
		}
	}
	return &FeedbackState{Profiles: profiles}
}

// RecordFeedback processes a user rating and updates learned profiles via EMA.
func (fs *FeedbackState) RecordFeedback(record FeedbackRecord) {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	fs.History = append(fs.History, record)
	if len(fs.History) > maxFeedbackHistory {
		fs.History = fs.History[len(fs.History)-maxFeedbackHistory:]
	}

	profile, ok := fs.Profiles[record.ContextType]
	if !ok {
		return
	}
	profile.SampleCount++
	profile.LastUpdated = time.Now().UnixMilli()

	if record.Rating > 0 {
		profile.PositiveCount++
		profile.PositiveEMA = emaUpdate(profile.PositiveEMA, record.Params)
	} else {
		profile.NegativeCount++
		profile.NegativeEMA = emaUpdate(profile.NegativeEMA, record.Params)
	}

	profile.Adjustments = computeLearnedAdjustments(profile)
}

// ApplyAdjustments blends learned parameter adjustments into base params.
func (fs *FeedbackState) ApplyAdjustments(base AutoTuneParams, ctx ContextType) (AutoTuneParams, bool, string) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	profile, ok := fs.Profiles[ctx]
	if !ok || profile.SampleCount < minSamplesToApply {
		return base, false, ""
	}

	// Weight scales from 0 to maxLearnedWeight based on sample count.
	weight := math.Min(
		float64(profile.SampleCount)/float64(samplesForMaxWeight)*maxLearnedWeight,
		maxLearnedWeight,
	)

	adjusted := base
	adjusted.Temperature += profile.Adjustments.Temperature * weight
	adjusted.TopP += profile.Adjustments.TopP * weight
	adjusted.TopK += int(math.Round(float64(profile.Adjustments.TopK) * weight))
	adjusted.FrequencyPenalty += profile.Adjustments.FrequencyPenalty * weight
	adjusted.PresencePenalty += profile.Adjustments.PresencePenalty * weight
	adjusted.RepetitionPenalty += profile.Adjustments.RepetitionPenalty * weight

	note := "Learned: " + strings.TrimSpace(contextLabel(ctx)) + " (" +
		itoa(profile.SampleCount) + " samples, " +
		itoa(int(math.Round(weight*100))) + "% weight)"

	return adjusted, true, note
}

func emaUpdate(current, observation AutoTuneParams) AutoTuneParams {
	inv := 1 - emaAlpha
	return AutoTuneParams{
		Temperature:       current.Temperature*inv + observation.Temperature*emaAlpha,
		TopP:              current.TopP*inv + observation.TopP*emaAlpha,
		TopK:              int(math.Round(float64(current.TopK)*inv + float64(observation.TopK)*emaAlpha)),
		FrequencyPenalty:  current.FrequencyPenalty*inv + observation.FrequencyPenalty*emaAlpha,
		PresencePenalty:   current.PresencePenalty*inv + observation.PresencePenalty*emaAlpha,
		RepetitionPenalty: current.RepetitionPenalty*inv + observation.RepetitionPenalty*emaAlpha,
	}
}

func computeLearnedAdjustments(profile *LearnedProfile) AutoTuneParams {
	if profile.PositiveCount < 1 && profile.NegativeCount < 1 {
		return AutoTuneParams{}
	}
	// With only positive data, use mild nudge from neutral.
	if profile.NegativeCount < 1 && profile.PositiveCount >= minSamplesToApply {
		return AutoTuneParams{
			Temperature:       (profile.PositiveEMA.Temperature - neutralParams.Temperature) * 0.5,
			TopP:              (profile.PositiveEMA.TopP - neutralParams.TopP) * 0.5,
			TopK:              int(math.Round((float64(profile.PositiveEMA.TopK) - float64(neutralParams.TopK)) * 0.5)),
			FrequencyPenalty:  (profile.PositiveEMA.FrequencyPenalty - neutralParams.FrequencyPenalty) * 0.5,
			PresencePenalty:   (profile.PositiveEMA.PresencePenalty - neutralParams.PresencePenalty) * 0.5,
			RepetitionPenalty: (profile.PositiveEMA.RepetitionPenalty - neutralParams.RepetitionPenalty) * 0.5,
		}
	}
	// Push toward positive, away from negative.
	return AutoTuneParams{
		Temperature:       (profile.PositiveEMA.Temperature - profile.NegativeEMA.Temperature) * 0.5,
		TopP:              (profile.PositiveEMA.TopP - profile.NegativeEMA.TopP) * 0.5,
		TopK:              int(math.Round((float64(profile.PositiveEMA.TopK) - float64(profile.NegativeEMA.TopK)) * 0.5)),
		FrequencyPenalty:  (profile.PositiveEMA.FrequencyPenalty - profile.NegativeEMA.FrequencyPenalty) * 0.5,
		PresencePenalty:   (profile.PositiveEMA.PresencePenalty - profile.NegativeEMA.PresencePenalty) * 0.5,
		RepetitionPenalty: (profile.PositiveEMA.RepetitionPenalty - profile.NegativeEMA.RepetitionPenalty) * 0.5,
	}
}

// ComputeRepetitionScore measures text repetitiveness (0.0 to 1.0) via trigram analysis.
func ComputeRepetitionScore(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) < 6 {
		return 0
	}
	trigrams := map[string]int{}
	total := 0
	for i := 0; i <= len(words)-3; i++ {
		tri := words[i] + " " + words[i+1] + " " + words[i+2]
		trigrams[tri]++
		total++
	}
	if total == 0 {
		return 0
	}
	repeated := 0
	for _, count := range trigrams {
		if count > 1 {
			repeated += count - 1
		}
	}
	score := float64(repeated) / float64(total)
	if score > 1.0 {
		score = 1.0
	}
	return score
}

// VocabularyDiversity returns unique_words / total_words ratio.
func VocabularyDiversity(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) == 0 {
		return 1
	}
	unique := map[string]struct{}{}
	for _, w := range words {
		unique[w] = struct{}{}
	}
	return float64(len(unique)) / float64(len(words))
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
