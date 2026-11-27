package godmode

import (
	"regexp"
	"strings"
	"unicode"
)

var reasoningPattern = regexp.MustCompile(`(?is)<think>.*?</think>\s*`)

var hedgePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bI think\s+`),
	regexp.MustCompile(`(?i)\bI believe\s+`),
	regexp.MustCompile(`(?i)\bperhaps\b\s*`),
	regexp.MustCompile(`(?i)\bmaybe\b\s*`),
	regexp.MustCompile(`(?i)\bIt seems like\s+`),
	regexp.MustCompile(`(?i)\bIt appears that\s+`),
	regexp.MustCompile(`(?i)\bprobably\b\s*`),
	regexp.MustCompile(`(?i)\bpossibly\b\s*`),
	regexp.MustCompile(`(?i)\bI would say\s+`),
	regexp.MustCompile(`(?i)\bIn my opinion,?\s+`),
	regexp.MustCompile(`(?i)\bFrom my perspective,?\s+`),
}

var preamblePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)^\s*(sure|of course|certainly|absolutely|great question|that's a great question|i'd be happy to help|let me help you with that|i understand|thanks for asking)[!,.:\-\s]*`),
}

var casualPairs = []struct {
	from *regexp.Regexp
	to   string
}{
	{regexp.MustCompile(`(?i)\bHowever\b`), "But"},
	{regexp.MustCompile(`(?i)\bFurthermore\b`), "Also"},
	{regexp.MustCompile(`(?i)\bAdditionally\b`), "Also"},
	{regexp.MustCompile(`(?i)\bMoreover\b`), "Also"},
	{regexp.MustCompile(`(?i)\bTherefore\b`), "So"},
	{regexp.MustCompile(`(?i)\bConsequently\b`), "So"},
	{regexp.MustCompile(`(?i)\bNevertheless\b`), "Still"},
	{regexp.MustCompile(`(?i)\bUtilize\b`), "Use"},
	{regexp.MustCompile(`(?i)\bUtilization\b`), "Use"},
	{regexp.MustCompile(`(?i)\bPrior to\b`), "Before"},
	{regexp.MustCompile(`(?i)\bSubsequent to\b`), "After"},
	{regexp.MustCompile(`(?i)\bDue to the fact that\b`), "Because"},
	{regexp.MustCompile(`(?i)\bIn order to\b`), "To"},
	{regexp.MustCompile(`(?i)\bAt this point in time\b`), "Now"},
	{regexp.MustCompile(`(?i)\bFacilitate\b`), "Help"},
	{regexp.MustCompile(`(?i)\bDemonstrate\b`), "Show"},
	{regexp.MustCompile(`(?i)\bIndicate\b`), "Show"},
	{regexp.MustCompile(`(?i)\bApproximately\b`), "About"},
	{regexp.MustCompile(`(?i)\bSufficient\b`), "Enough"},
	{regexp.MustCompile(`(?i)\bNumerous\b`), "Many"},
	{regexp.MustCompile(`(?i)\bAssist\b`), "Help"},
	{regexp.MustCompile(`(?i)\bObtain\b`), "Get"},
}

// Cleaner applies semantic transformation modules to model output.
type Cleaner struct{}

// NewCleaner returns the default STM pipeline.
func NewCleaner() *Cleaner {
	return &Cleaner{}
}

// Normalize strips hidden reasoning and removes common low-signal response
// artifacts while preserving the answer's substantive content.
func (c *Cleaner) Normalize(input string) (string, []string, bool) {
	text := input
	applied := make([]string, 0, 4)

	stripped := reasoningPattern.MatchString(text)
	if stripped {
		text = reasoningPattern.ReplaceAllString(text, "")
		applied = append(applied, "reasoning_strip")
	}

	before := text
	for _, pattern := range hedgePatterns {
		text = pattern.ReplaceAllString(text, "")
	}
	if text != before {
		applied = append(applied, "hedge_reducer")
	}

	before = text
	for _, pattern := range preamblePatterns {
		text = pattern.ReplaceAllString(text, "")
	}
	if text != before {
		applied = append(applied, "direct_mode")
	}

	before = text
	for _, pair := range casualPairs {
		text = pair.from.ReplaceAllStringFunc(text, func(match string) string {
			return matchCase(match, pair.to)
		})
	}
	if text != before {
		applied = append(applied, "casual_mode")
	}

	text = cleanWhitespace(text)
	text = capitalizeFirst(text)
	return text, applied, stripped
}

func cleanWhitespace(text string) string {
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " \t")
	}
	text = strings.Join(lines, "\n")
	for strings.Contains(text, "  ") {
		text = strings.ReplaceAll(text, "  ", " ")
	}
	text = strings.ReplaceAll(text, " ,", ",")
	text = strings.ReplaceAll(text, " .", ".")
	text = strings.ReplaceAll(text, " !", "!")
	text = strings.ReplaceAll(text, " ?", "?")
	return strings.TrimSpace(text)
}

func capitalizeFirst(text string) string {
	runes := []rune(text)
	for i, r := range runes {
		if unicode.IsLetter(r) {
			runes[i] = unicode.ToUpper(r)
			return string(runes)
		}
	}
	return text
}

func matchCase(match, replacement string) string {
	for _, r := range match {
		if unicode.IsLetter(r) {
			if unicode.IsUpper(r) {
				return replacement
			}
			return strings.ToLower(replacement[:1]) + replacement[1:]
		}
	}
	return replacement
}
