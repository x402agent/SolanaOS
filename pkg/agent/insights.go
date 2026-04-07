// Package agent — insights.go extracts actionable insights from conversations.
// Adapted from Hermes Agent's insights.py.
//
// Insights are structured observations that can be stored in Honcho as conclusions
// or in the local vault as lessons/decisions.
package agent

import (
	"strings"
	"time"
)

// InsightType categorizes the insight.
type InsightType string

const (
	InsightPreference InsightType = "preference"    // user preference ("prefers spot over perps")
	InsightCorrection InsightType = "correction"     // user corrected the agent
	InsightFact       InsightType = "fact"           // durable fact ("BTC address is bc1q...")
	InsightStrategy   InsightType = "strategy"       // trading strategy insight
	InsightRisk       InsightType = "risk_profile"   // risk tolerance observation
	InsightWorkflow   InsightType = "workflow"       // repeated workflow pattern
	InsightToken      InsightType = "token_interest" // token the user watches/trades
)

// Insight is a structured observation from a conversation.
type Insight struct {
	Type      InsightType `json:"type"`
	Content   string      `json:"content"`
	Source    string      `json:"source"`     // "telegram", "cli", "gateway"
	SessionID string     `json:"session_id"`
	Timestamp time.Time  `json:"timestamp"`
	Confidence float64   `json:"confidence"` // 0.0-1.0
}

// ExtractInsights scans a message for patterns that indicate durable insights.
func ExtractInsights(role, content, source, sessionID string) []Insight {
	if role != "user" {
		return nil
	}

	lower := strings.ToLower(content)
	var insights []Insight
	now := time.Now()

	// Preference signals
	preferenceSignals := []string{
		"i prefer", "i like to", "i always", "i never", "i usually",
		"my preference", "i tend to", "i want to",
	}
	for _, signal := range preferenceSignals {
		if strings.Contains(lower, signal) {
			insights = append(insights, Insight{
				Type: InsightPreference, Content: content, Source: source,
				SessionID: sessionID, Timestamp: now, Confidence: 0.7,
			})
			break
		}
	}

	// Correction signals
	correctionSignals := []string{
		"no, ", "wrong", "that's not right", "actually,", "correct that",
		"you're wrong", "not what i meant",
	}
	for _, signal := range correctionSignals {
		if strings.Contains(lower, signal) {
			insights = append(insights, Insight{
				Type: InsightCorrection, Content: content, Source: source,
				SessionID: sessionID, Timestamp: now, Confidence: 0.8,
			})
			break
		}
	}

	// Risk profile signals
	riskSignals := []string{
		"stop loss", "risk", "position size", "conservative", "aggressive",
		"max drawdown", "kelly", "risk tolerance",
	}
	for _, signal := range riskSignals {
		if strings.Contains(lower, signal) {
			insights = append(insights, Insight{
				Type: InsightRisk, Content: content, Source: source,
				SessionID: sessionID, Timestamp: now, Confidence: 0.6,
			})
			break
		}
	}

	// Strategy signals
	strategySignals := []string{
		"strategy", "rsi", "ema", "momentum", "breakout", "reversal",
		"funding rate", "open interest",
	}
	for _, signal := range strategySignals {
		if strings.Contains(lower, signal) {
			insights = append(insights, Insight{
				Type: InsightStrategy, Content: content, Source: source,
				SessionID: sessionID, Timestamp: now, Confidence: 0.5,
			})
			break
		}
	}

	// "Remember" commands
	if strings.HasPrefix(lower, "/remember ") || strings.Contains(lower, "remember that ") {
		insights = append(insights, Insight{
			Type: InsightFact, Content: content, Source: source,
			SessionID: sessionID, Timestamp: now, Confidence: 0.95,
		})
	}

	return insights
}
