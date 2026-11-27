package godmode

import (
	"regexp"
	"strings"
	"unicode"
)

var wordPattern = regexp.MustCompile(`[A-Za-z0-9_]{4,}`)

// ScoreResponse computes a 100-point quality score for winner selection.
func ScoreResponse(content, query string, ctx ContextType) ScoreBreakdown {
	breakdown := ScoreBreakdown{
		Length:      scoreLength(content),
		Structure:   scoreStructure(content),
		Directness:  scoreDirectness(content),
		Relevance:   scoreRelevance(content, query),
		Specificity: scoreSpecificity(content, ctx),
	}
	breakdown.Total = breakdown.Length + breakdown.Structure + breakdown.Directness + breakdown.Relevance + breakdown.Specificity
	if breakdown.Total > 100 {
		breakdown.Total = 100
	}
	return breakdown
}

func scoreLength(content string) int {
	n := len(strings.TrimSpace(content))
	if n <= 0 {
		return 0
	}
	score := n / 50
	if score > 20 {
		score = 20
	}
	if score < 1 {
		return 1
	}
	return score
}

func scoreStructure(content string) int {
	lines := strings.Split(content, "\n")
	score := 0
	inCode := false
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if strings.HasPrefix(line, "```") {
			score += 5
			inCode = !inCode
			continue
		}
		if inCode {
			continue
		}
		switch {
		case strings.HasPrefix(line, "#"):
			score += 3
		case strings.HasPrefix(line, "- "), strings.HasPrefix(line, "* "):
			score += 2
		case len(line) >= 3 && unicode.IsDigit(rune(line[0])) && strings.Contains(line[:minInt(len(line), 4)], "."):
			score += 2
		case strings.HasPrefix(line, "|") && strings.HasSuffix(line, "|"):
			score += 2
		}
	}
	if score > 20 {
		return 20
	}
	return score
}

func scoreDirectness(content string) int {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return 0
	}
	for _, pattern := range preamblePatterns {
		if pattern.MatchString(trimmed) {
			return 8
		}
	}
	return 15
}

func scoreRelevance(content, query string) int {
	queryWords := uniqueWords(query)
	if len(queryWords) == 0 {
		return 10
	}
	contentWords := uniqueWords(content)
	matches := 0
	for word := range queryWords {
		if contentWords[word] {
			matches++
		}
	}
	score := int(float64(matches) / float64(len(queryWords)) * 20)
	if score > 20 {
		return 20
	}
	return score
}

func scoreSpecificity(content string, ctx ContextType) int {
	lower := strings.ToLower(content)
	var markers []string
	switch ctx {
	case ContextTrading, ContextExecution:
		markers = []string{"entry", "stop", "target", "risk", "confidence", "invalidation", "thesis", "liquidity", "funding"}
	case ContextCode:
		markers = []string{"```", "func ", "package ", "test", "error", "return", "type ", "interface", "go test"}
	case ContextAnalytical:
		markers = []string{"because", "tradeoff", "assumption", "evidence", "alternative", "risk", "impact", "method"}
	case ContextCreative:
		markers = []string{"concept", "voice", "tone", "variation", "name", "copy", "hook", "style"}
	case ContextConversational:
		markers = []string{"you", "that", "next", "here", "yes", "no"}
	default:
		markers = []string{"specific", "next", "risk", "constraint", "result"}
	}
	score := 0
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			score += 4
		}
	}
	if score > 25 {
		return 25
	}
	return score
}

func uniqueWords(text string) map[string]bool {
	words := wordPattern.FindAllString(strings.ToLower(text), -1)
	out := make(map[string]bool, len(words))
	for _, word := range words {
		out[word] = true
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
