package llm

import (
	"regexp"
	"strings"
)

// STMModule is a semantic transformation module that normalizes LLM output.
type STMModule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

// STMConfig controls which output transformation modules are active.
type STMConfig struct {
	HedgeReducer bool `json:"hedgeReducer"`
	DirectMode   bool `json:"directMode"`
	CasualMode   bool `json:"casualMode"`
}

// DefaultSTMConfig returns the default STM configuration for god mode:
// hedge reducer and direct mode on, casual mode off.
func DefaultSTMConfig() STMConfig {
	return STMConfig{
		HedgeReducer: true,
		DirectMode:   true,
		CasualMode:   false,
	}
}

// Hedge patterns — epistemic hedging phrases that weaken responses.
var hedgePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bI think\s+`),
	regexp.MustCompile(`(?i)\bI believe\s+`),
	regexp.MustCompile(`(?i)\bperhaps\s+`),
	regexp.MustCompile(`(?i)\bmaybe\s+`),
	regexp.MustCompile(`(?i)\bIt seems(?:\s+like)?\s+`),
	regexp.MustCompile(`(?i)\bIt appears that\s+`),
	regexp.MustCompile(`(?i)\bprobably\s+`),
	regexp.MustCompile(`(?i)\bpossibly\s+`),
	regexp.MustCompile(`(?i)\bI would say\s+`),
	regexp.MustCompile(`(?i)\bIn my opinion,?\s*`),
	regexp.MustCompile(`(?i)\bFrom my perspective,?\s*`),
}

// Preamble patterns — filler phrases at the start of responses.
var preamblePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)^Sure,?\s*`),
	regexp.MustCompile(`(?i)^Of course,?\s*`),
	regexp.MustCompile(`(?i)^Certainly,?\s*`),
	regexp.MustCompile(`(?i)^Absolutely,?\s*`),
	regexp.MustCompile(`(?i)^Great question!?\s*`),
	regexp.MustCompile(`(?i)^That's a great question!?\s*`),
	regexp.MustCompile(`(?i)^I'd be happy to help(?: you)?(?: with that)?[.!]?\s*`),
	regexp.MustCompile(`(?i)^Let me help you with that[.!]?\s*`),
	regexp.MustCompile(`(?i)^I understand[.!]?\s*`),
	regexp.MustCompile(`(?i)^Thanks for asking[.!]?\s*`),
}

// Casual substitution pairs (formal → casual).
var casualSubstitutions = []struct {
	pattern *regexp.Regexp
	repl    string
}{
	{regexp.MustCompile(`\bHowever\b`), "But"},
	{regexp.MustCompile(`\bTherefore\b`), "So"},
	{regexp.MustCompile(`\bFurthermore\b`), "Also"},
	{regexp.MustCompile(`\bAdditionally\b`), "Plus"},
	{regexp.MustCompile(`\bNevertheless\b`), "Still"},
	{regexp.MustCompile(`\bConsequently\b`), "So"},
	{regexp.MustCompile(`\bMoreover\b`), "Also"},
	{regexp.MustCompile(`\bUtilize\b`), "Use"},
	{regexp.MustCompile(`\butilize\b`), "use"},
	{regexp.MustCompile(`\bPurchase\b`), "Buy"},
	{regexp.MustCompile(`\bpurchase\b`), "buy"},
	{regexp.MustCompile(`\bObtain\b`), "Get"},
	{regexp.MustCompile(`\bobtain\b`), "get"},
	{regexp.MustCompile(`\bCommence\b`), "Start"},
	{regexp.MustCompile(`\bcommence\b`), "start"},
	{regexp.MustCompile(`\bTerminate\b`), "End"},
	{regexp.MustCompile(`\bterminate\b`), "end"},
	{regexp.MustCompile(`(?i)\bPrior to\b`), "Before"},
	{regexp.MustCompile(`(?i)\bSubsequent to\b`), "After"},
	{regexp.MustCompile(`(?i)\bIn order to\b`), "To"},
	{regexp.MustCompile(`(?i)\bDue to the fact that\b`), "Because"},
	{regexp.MustCompile(`(?i)\bAt this point in time\b`), "Now"},
	{regexp.MustCompile(`(?i)\bIn the event that\b`), "If"},
}

// Refusal patterns — phrases indicating the model is refusing to answer.
var refusalPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bI cannot\b|\bI can't\b|\bI'm unable to\b`),
	regexp.MustCompile(`(?i)\bAs an AI\b|\bAs a language model\b|\bAs an artificial intelligence\b`),
	regexp.MustCompile(`(?i)\bI'm not able to\b|\bI am not able to\b`),
	regexp.MustCompile(`(?i)\bI must decline\b|\bI have to decline\b`),
	regexp.MustCompile(`(?i)\bI'm programmed to\b|\bI was designed to\b`),
	regexp.MustCompile(`(?i)\bagainst my guidelines\b|\bagainst my programming\b`),
	regexp.MustCompile(`(?i)\bI don't have the ability\b`),
	regexp.MustCompile(`(?i)\bI'm sorry,? but I\b`),
}

// ApplySTM applies all enabled semantic transformation modules to text.
func ApplySTM(text string, cfg STMConfig) string {
	result := text
	if cfg.HedgeReducer {
		result = applyHedgeReducer(result)
	}
	if cfg.DirectMode {
		result = applyDirectMode(result)
	}
	if cfg.CasualMode {
		result = applyCasualMode(result)
	}
	return result
}

func applyHedgeReducer(text string) string {
	result := text
	for _, pattern := range hedgePatterns {
		result = pattern.ReplaceAllString(result, "")
	}
	// Capitalize sentence-initial lowercase after removal.
	result = regexp.MustCompile(`(?m)^\s*([a-z])`).ReplaceAllStringFunc(result, func(m string) string {
		return strings.ToUpper(m)
	})
	return result
}

func applyDirectMode(text string) string {
	result := text
	for _, pattern := range preamblePatterns {
		result = pattern.ReplaceAllString(result, "")
	}
	// Capitalize first letter.
	result = strings.TrimSpace(result)
	if len(result) > 0 && result[0] >= 'a' && result[0] <= 'z' {
		result = strings.ToUpper(result[:1]) + result[1:]
	}
	return result
}

func applyCasualMode(text string) string {
	result := text
	for _, sub := range casualSubstitutions {
		result = sub.pattern.ReplaceAllString(result, sub.repl)
	}
	return result
}

// CountRefusalPatterns returns the number of refusal phrases found in text.
func CountRefusalPatterns(text string) int {
	count := 0
	for _, pattern := range refusalPatterns {
		if pattern.MatchString(text) {
			count++
		}
	}
	return count
}
