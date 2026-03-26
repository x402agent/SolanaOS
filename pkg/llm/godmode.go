package llm

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
)

type GodModeResult struct {
	Reply       string             `json:"reply"`
	WinnerModel string             `json:"winnerModel"`
	Profile     string             `json:"profile"`
	Confidence  float64            `json:"confidence"`
	Candidates  []GodModeCandidate `json:"candidates"`
}

type GodModeCandidate struct {
	Model      string `json:"model"`
	Score      int    `json:"score"`
	DurationMS int64  `json:"durationMs"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

type godModeProfile struct {
	ID          string
	Temperature float64
	TopP        float64
	MaxTokens   int
}

type godModeRaceCandidate struct {
	Model      string
	Content    string
	Score      int
	DurationMS int64
	Success    bool
	Error      string
}

var godModeCurrentPatterns = map[string][]*regexp.Regexp{
	"execution": {
		regexp.MustCompile(`\b(buy|sell|swap|ape|exit|dump|long|short|bid|offer|bridge|send|transfer)\b`),
		regexp.MustCompile(`\b(sol|usdc|usdt|bonk|jup|wif|pump|perp|position|wallet)\b`),
	},
	"trading": {
		regexp.MustCompile(`\b(set[- ]?up|trade|chart|momentum|volume|liquidity|breakout|breakdown|rsi|ema|vwap|funding|open interest)\b`),
		regexp.MustCompile(`\b(entry|stop|target|risk|invalidation|bias|thesis|rotation)\b`),
	},
	"code": {
		regexp.MustCompile("```[\\s\\S]*```"),
		regexp.MustCompile(`\b(code|golang|go|typescript|javascript|python|rust|bug|refactor|function|struct|interface|api|endpoint|compile|test)\b`),
	},
	"analytical": {
		regexp.MustCompile(`\b(analyze|analysis|compare|evaluate|assess|research|explain|breakdown|tradeoff|implication|architecture|benchmark)\b`),
		regexp.MustCompile(`\b(why|how|what happens|summarize|overview|report)\b`),
	},
	"conversational": {
		regexp.MustCompile(`\b(hey|hi|hello|gm|thanks|thank you|yo|sup|what's up|lol|haha)\b`),
		regexp.MustCompile(`^.{0,30}$`),
	},
}

var godModeHistoryPatterns = godModeCurrentPatterns

var godModeProfiles = map[string]godModeProfile{
	"execution": {
		ID:          "execution",
		Temperature: 0.2,
		TopP:        0.82,
		MaxTokens:   1400,
	},
	"trading": {
		ID:          "trading",
		Temperature: 0.45,
		TopP:        0.88,
		MaxTokens:   1800,
	},
	"code": {
		ID:          "code",
		Temperature: 0.2,
		TopP:        0.8,
		MaxTokens:   2200,
	},
	"analytical": {
		ID:          "analytical",
		Temperature: 0.35,
		TopP:        0.86,
		MaxTokens:   1800,
	},
	"conversational": {
		ID:          "conversational",
		Temperature: 0.7,
		TopP:        0.92,
		MaxTokens:   1200,
	},
}

var godModeProfilePriority = map[string]int{
	"code":           0,
	"execution":      1,
	"trading":        2,
	"analytical":     3,
	"conversational": 4,
}

var godModePreamblePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)^(sure|of course|certainly|absolutely)[,!\s]+`),
	regexp.MustCompile(`(?i)^(great question|good question)[,!\s]+`),
	regexp.MustCompile(`(?i)^i(?:'d| would) be happy to help(?: you)?(?: with that)?[.!]?\s+`),
	regexp.MustCompile(`(?i)^let me (?:help|walk through)[^.!?]*[.!]?\s+`),
}

var godModeHedgePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bi think\s+`),
	regexp.MustCompile(`(?i)\bi believe\s+`),
	regexp.MustCompile(`(?i)\bmaybe\s+`),
	regexp.MustCompile(`(?i)\bperhaps\s+`),
	regexp.MustCompile(`(?i)\bit seems(?: like)?\s+`),
}

const solanaGodModeDirective = `
## Solana God Mode
You are running in Solana God Mode, an operator-grade synthesis pass for Solana trading, research, execution planning, and code.

Requirements:
- maximize signal density and concrete usefulness
- prefer exact steps, clear assumptions, and practical next actions
- for trading or execution, separate observation from action and always include invalidation or key risk
- for code, prefer correct runnable changes and mention important assumptions plainly
- for research, synthesize instead of hand-waving
- keep the tone direct and human, without theatrical framing
- stay within provider and tool constraints; do not invent live data that is not in context
`

func (c *Client) ChatGodMode(ctx context.Context, sessionID, userMsg, contextStr string) (*GodModeResult, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("no LLM backend configured: set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_MODEL")
	}

	if !c.IsOpenRouterConfigured() {
		reply, err := c.Chat(ctx, sessionID, userMsg, contextStr)
		if err != nil {
			return nil, err
		}
		return &GodModeResult{
			Reply:       reply,
			WinnerModel: c.Model(),
			Profile:     "fallback",
			Confidence:  1,
			Candidates: []GodModeCandidate{
				{
					Model:   c.Model(),
					Score:   100,
					Success: true,
				},
			},
		}, nil
	}

	c.mu.Lock()
	history := append([]Message(nil), c.sessions[sessionID]...)
	endpoint := c.endpoint
	activeModel := c.model
	model1 := c.model1
	model2 := c.model2
	model3 := c.model3
	mimoModel := c.mimoModel
	c.mu.Unlock()

	profile, confidence := detectGodModeProfile(userMsg, history)
	models := selectGodModeModels(profile.ID, activeModel, mimoModel, model1, model2, model3)
	if len(models) == 0 {
		models = []string{DefaultModel}
	}

	messages := make([]map[string]interface{}, 0, len(history)+2)
	messages = append(messages, map[string]interface{}{
		"role":    "system",
		"content": buildGodModeSystemPrompt(contextStr, profile.ID),
	})
	for _, msg := range history {
		messages = append(messages, map[string]interface{}{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}
	messages = append(messages, map[string]interface{}{
		"role":    "user",
		"content": userMsg,
	})

	results := c.raceGodModeModels(ctx, endpoint, models, profile, messages, userMsg)
	winner := pickBestGodModeCandidate(results)
	if winner == nil {
		reply, err := c.Chat(ctx, sessionID, userMsg, contextStr)
		if err != nil {
			return nil, err
		}
		return &GodModeResult{
			Reply:       reply,
			WinnerModel: c.Model(),
			Profile:     "fallback",
			Confidence:  confidence,
			Candidates:  flattenGodModeCandidates(results),
		}, nil
	}

	reply := cleanupGodModeReply(winner.Content)
	if reply == "" {
		reply = strings.TrimSpace(winner.Content)
	}

	updatedHistory := append(history, Message{Role: "user", Content: userMsg})
	updatedHistory = append(updatedHistory, Message{Role: "assistant", Content: reply})
	if len(updatedHistory) > maxHistory {
		updatedHistory = updatedHistory[len(updatedHistory)-maxHistory:]
	}

	c.mu.Lock()
	c.sessions[sessionID] = updatedHistory
	c.lastResolvedClient = "solana-god:" + winner.Model
	c.mu.Unlock()

	return &GodModeResult{
		Reply:       reply,
		WinnerModel: winner.Model,
		Profile:     profile.ID,
		Confidence:  confidence,
		Candidates:  flattenGodModeCandidates(results),
	}, nil
}

func detectGodModeProfile(message string, history []Message) (godModeProfile, float64) {
	scores := map[string]int{
		"execution":      0,
		"trading":        0,
		"code":           0,
		"analytical":     0,
		"conversational": 0,
	}

	for profileID, patterns := range godModeCurrentPatterns {
		for _, pattern := range patterns {
			if pattern.MatchString(message) {
				scores[profileID] += 3
			}
		}
	}

	start := 0
	if len(history) > 4 {
		start = len(history) - 4
	}
	for _, msg := range history[start:] {
		for profileID, patterns := range godModeHistoryPatterns {
			for _, pattern := range patterns {
				if pattern.MatchString(msg.Content) {
					scores[profileID]++
				}
			}
		}
	}

	bestID := "conversational"
	bestScore := 0
	total := 0
	for profileID, score := range scores {
		total += score
		if score > bestScore || (score == bestScore && godModeProfilePriority[profileID] < godModeProfilePriority[bestID]) {
			bestID = profileID
			bestScore = score
		}
	}
	if total == 0 {
		return godModeProfiles["analytical"], 0.5
	}
	confidence := float64(bestScore) / float64(total)
	return godModeProfiles[bestID], confidence
}

func buildGodModeSystemPrompt(contextStr, profileID string) string {
	base := buildSystemPrompt(contextStr)
	base += solanaGodModeDirective
	base += "\nDetected profile: " + profileID + ". Match the profile with the right balance of precision, structure, and actionability."
	return base
}

func selectGodModeModels(profileID string, activeModel string, candidates ...string) []string {
	mimoModel := ""
	model1 := ""
	model2 := ""
	model3 := ""
	if len(candidates) > 0 {
		mimoModel = candidates[0]
	}
	if len(candidates) > 1 {
		model1 = candidates[1]
	}
	if len(candidates) > 2 {
		model2 = candidates[2]
	}
	if len(candidates) > 3 {
		model3 = candidates[3]
	}
	ordered := make([]string, 0, len(candidates)+2)
	switch profileID {
	case "code":
		ordered = append(ordered, mimoModel, activeModel, model2, model1, model3)
	case "execution":
		ordered = append(ordered, activeModel, mimoModel, model1, model3, model2)
	case "trading":
		ordered = append(ordered, activeModel, mimoModel, model3, model1, model2)
	case "analytical":
		ordered = append(ordered, mimoModel, activeModel, model2, model1, model3)
	default:
		ordered = append(ordered, activeModel, mimoModel, model1, model2, model3)
	}

	var deduped []string
	seen := map[string]struct{}{}
	for _, model := range ordered {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		if _, ok := seen[model]; ok {
			continue
		}
		seen[model] = struct{}{}
		deduped = append(deduped, model)
		if len(deduped) == 5 {
			break
		}
	}
	return deduped
}

func (c *Client) raceGodModeModels(
	ctx context.Context,
	endpoint string,
	models []string,
	profile godModeProfile,
	messages []map[string]interface{},
	userMsg string,
) []godModeRaceCandidate {
	resultsCh := make(chan godModeRaceCandidate, len(models))
	for _, model := range models {
		model := model
		go func() {
			start := time.Now()
			payload := map[string]interface{}{
				"model":       model,
				"messages":    messages,
				"temperature": profile.Temperature,
				"top_p":       profile.TopP,
				"max_tokens":  profile.MaxTokens,
				"reasoning":   map[string]bool{"enabled": true},
			}
			content, _, err := c.chatOpenRouter(ctx, endpoint, model, payload)
			result := godModeRaceCandidate{
				Model:      model,
				DurationMS: time.Since(start).Milliseconds(),
			}
			if err != nil {
				result.Error = err.Error()
				resultsCh <- result
				return
			}
			result.Content = content
			result.Success = true
			result.Score = scoreGodModeResponse(profile.ID, userMsg, content)
			resultsCh <- result
		}()
	}

	results := make([]godModeRaceCandidate, 0, len(models))
	for i := 0; i < len(models); i++ {
		select {
		case result := <-resultsCh:
			results = append(results, result)
		case <-ctx.Done():
			results = append(results, godModeRaceCandidate{
				Model:   "context-cancelled",
				Error:   ctx.Err().Error(),
				Success: false,
			})
			return results
		}
	}
	return results
}

func scoreGodModeResponse(profileID, userMsg, content string) int {
	trimmed := strings.TrimSpace(content)
	if len(trimmed) < 20 {
		return 0
	}

	score := 0
	score += clampInt(len(trimmed)/60, 0, 20)
	score += clampInt(countHeaders(trimmed)*3+countListItems(trimmed)*2+countCodeBlocks(trimmed)*5, 0, 18)
	score += clampInt(matchQueryWords(userMsg, trimmed), 0, 30)
	score += profileSpecificityScore(profileID, trimmed)

	if hasGodModePreamble(trimmed) {
		score += 4
	} else {
		score += 10
	}
	return clampInt(score, 0, 100)
}

func matchQueryWords(userMsg, content string) int {
	queryWords := strings.Fields(strings.ToLower(userMsg))
	if len(queryWords) == 0 {
		return 15
	}
	seen := map[string]struct{}{}
	filtered := make([]string, 0, len(queryWords))
	for _, word := range queryWords {
		word = strings.Trim(word, " \t\r\n.,:;!?()[]{}<>`'\"")
		if len(word) < 4 {
			continue
		}
		if _, ok := seen[word]; ok {
			continue
		}
		seen[word] = struct{}{}
		filtered = append(filtered, word)
	}
	if len(filtered) == 0 {
		return 15
	}
	lower := strings.ToLower(content)
	matches := 0
	for _, word := range filtered {
		if strings.Contains(lower, word) {
			matches++
		}
	}
	return int(float64(matches) / float64(len(filtered)) * 30)
}

func profileSpecificityScore(profileID, content string) int {
	lower := strings.ToLower(content)
	switch profileID {
	case "execution", "trading":
		score := 0
		for _, marker := range []string{"bias", "entry", "stop", "target", "risk", "invalidation"} {
			if strings.Contains(lower, marker) {
				score += 4
			}
		}
		return clampInt(score, 0, 22)
	case "code":
		score := 0
		if strings.Contains(content, "```") {
			score += 10
		}
		for _, marker := range []string{"func ", "type ", "struct ", "interface ", "return ", "import "} {
			if strings.Contains(content, marker) {
				score += 3
			}
		}
		return clampInt(score, 0, 22)
	case "analytical":
		score := 0
		for _, marker := range []string{"because", "tradeoff", "trade-off", "risk", "assumption", "alternative"} {
			if strings.Contains(lower, marker) {
				score += 4
			}
		}
		return clampInt(score, 0, 22)
	default:
		score := 0
		for _, marker := range []string{"next", "best", "watch", "important", "worth"} {
			if strings.Contains(lower, marker) {
				score += 4
			}
		}
		return clampInt(score, 0, 22)
	}
}

func pickBestGodModeCandidate(results []godModeRaceCandidate) *godModeRaceCandidate {
	var winner *godModeRaceCandidate
	for i := range results {
		result := &results[i]
		if !result.Success {
			continue
		}
		if winner == nil ||
			result.Score > winner.Score ||
			(result.Score == winner.Score && result.DurationMS < winner.DurationMS) {
			winner = result
		}
	}
	return winner
}

func flattenGodModeCandidates(results []godModeRaceCandidate) []GodModeCandidate {
	out := make([]GodModeCandidate, 0, len(results))
	for _, result := range results {
		out = append(out, GodModeCandidate{
			Model:      result.Model,
			Score:      result.Score,
			DurationMS: result.DurationMS,
			Success:    result.Success,
			Error:      result.Error,
		})
	}
	return out
}

func cleanupGodModeReply(reply string) string {
	cleaned := strings.TrimSpace(reply)
	for _, pattern := range godModePreamblePatterns {
		cleaned = pattern.ReplaceAllString(cleaned, "")
	}
	for _, pattern := range godModeHedgePatterns {
		cleaned = pattern.ReplaceAllString(cleaned, "")
	}
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		return ""
	}
	if cleaned[0] >= 'a' && cleaned[0] <= 'z' {
		cleaned = strings.ToUpper(cleaned[:1]) + cleaned[1:]
	}
	return cleaned
}

func hasGodModePreamble(content string) bool {
	for _, pattern := range godModePreamblePatterns {
		if pattern.MatchString(strings.ToLower(strings.TrimSpace(content))) {
			return true
		}
	}
	return false
}

func countHeaders(content string) int {
	count := 0
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") || strings.HasPrefix(line, "## ") || strings.HasPrefix(line, "### ") {
			count++
		}
	}
	return count
}

func countListItems(content string) int {
	count := 0
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") || strings.HasPrefix(line, "1. ") {
			count++
		}
	}
	return count
}

func countCodeBlocks(content string) int {
	return strings.Count(content, "```") / 2
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
