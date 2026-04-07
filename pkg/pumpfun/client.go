// client.go — thin HTTP + SSE client for the AI trading bot's REST API.
// Used by the Go daemon to query live status, relay Telegram commands,
// and subscribe to the bot's SSE event stream.
package pumpfun

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AIBotClient talks to the AI trading bot's Express API (default :3001).
type AIBotClient struct {
	base   string
	client *http.Client
}

// NewAIBotClient creates a client pointing at the given base URL.
// If empty, defaults to http://127.0.0.1:3001.
func NewAIBotClient(base string) *AIBotClient {
	if base == "" {
		base = "http://127.0.0.1:3001"
	}
	return &AIBotClient{
		base: strings.TrimRight(base, "/"),
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

// ── REST helpers ──────────────────────────────────────────────────────────────

// IsAlive returns true if the health endpoint responds OK.
func (c *AIBotClient) IsAlive(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/api/health", nil)
	if err != nil {
		return false
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return false
	}
	_ = resp.Body.Close()
	return resp.StatusCode < 300
}

// AIBotAPIStatus is the parsed /api/trading/status response.
type AIBotAPIStatus struct {
	IsRunning        bool    `json:"isRunning"`
	TotalTrades      int     `json:"totalTrades"`
	SuccessfulTrades int     `json:"successfulTrades"`
	FailedTrades     int     `json:"failedTrades"`
	TotalProfit      float64 `json:"totalProfit"`
	WinRate          float64 `json:"winRate"`
	StartTime        int64   `json:"startTime"`
	OpenPositions    int     `json:"openPositions"`
}

// Status fetches the current bot status from /api/trading/status.
func (c *AIBotClient) Status(ctx context.Context) (*AIBotAPIStatus, error) {
	return getJSON[AIBotAPIStatus](ctx, c, "/api/trading/status")
}

// StartBot calls POST /api/trading/start.
func (c *AIBotClient) StartBot(ctx context.Context) error {
	return postEmpty(ctx, c, "/api/trading/start")
}

// StopBot calls POST /api/trading/stop.
func (c *AIBotClient) StopBot(ctx context.Context) error {
	return postEmpty(ctx, c, "/api/trading/stop")
}

// TradeResult mirrors the TypeScript TradeResult interface.
type TradeResult struct {
	Success      bool    `json:"success"`
	TxHash       string  `json:"txHash,omitempty"`
	TokenAddress string  `json:"tokenAddress"`
	Type         string  `json:"type"` // "buy" | "sell"
	Amount       float64 `json:"amount"`
	Price        float64 `json:"price"`
	Profit       float64 `json:"profit,omitempty"`
	Timestamp    int64   `json:"timestamp"`
	Error        string  `json:"error,omitempty"`
}

// Trades fetches recent trade history from /api/trading/trades.
func (c *AIBotClient) Trades(ctx context.Context) ([]TradeResult, error) {
	type wrap struct {
		Data []TradeResult `json:"data"`
	}
	res, err := getJSON[wrap](ctx, c, "/api/trading/trades")
	if err != nil {
		return nil, err
	}
	return res.Data, nil
}

// AIPrediction mirrors the TypeScript AIPrediction interface.
type AIPrediction struct {
	TokenAddress       string  `json:"tokenAddress"`
	ConfidenceScore    float64 `json:"confidenceScore"`
	PredictedPrice     float64 `json:"predictedPrice"`
	PredictedDirection string  `json:"predictedDirection"`
	Timeframe          int     `json:"timeframe"`
	Timestamp          int64   `json:"timestamp"`
}

// Predictions fetches current AI predictions from /api/trading/predictions.
func (c *AIBotClient) Predictions(ctx context.Context) ([]AIPrediction, error) {
	type wrap struct {
		Data []AIPrediction `json:"data"`
	}
	res, err := getJSON[wrap](ctx, c, "/api/trading/predictions")
	if err != nil {
		return nil, err
	}
	return res.Data, nil
}

// ── SSE subscriber ────────────────────────────────────────────────────────────

// SSEEvent is a parsed server-sent event from /api/events.
type SSEEvent struct {
	Event string
	Data  json.RawMessage
}

// SubscribeEvents opens an SSE connection to /api/events and sends events to
// the returned channel.  The caller must cancel ctx to stop the stream.
func (c *AIBotClient) SubscribeEvents(ctx context.Context) (<-chan SSEEvent, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/api/events", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	// Use a client without timeout for long-lived SSE
	sseClient := &http.Client{}
	resp, err := sseClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SSE connect: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("SSE connect: HTTP %d", resp.StatusCode)
	}

	ch := make(chan SSEEvent, 32)
	go func() {
		defer close(ch)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		var eventType string
		var dataLines []string

		for scanner.Scan() {
			line := scanner.Text()
			switch {
			case strings.HasPrefix(line, "event:"):
				eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			case strings.HasPrefix(line, "data:"):
				dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
			case line == "":
				// dispatch
				if eventType != "" && len(dataLines) > 0 {
					raw := strings.Join(dataLines, "\n")
					select {
					case ch <- SSEEvent{Event: eventType, Data: json.RawMessage(raw)}:
					case <-ctx.Done():
						return
					}
				}
				eventType = ""
				dataLines = dataLines[:0]
			case strings.HasPrefix(line, ":"):
				// SSE comment / keepalive — ignore
			}
		}
	}()

	return ch, nil
}

// ── Telegram-formatted summaries (for daemon handlers) ───────────────────────

// FormatStatus returns a Telegram Markdown string for the given status.
func FormatAIBotStatus(s *AIBotAPIStatus, alive bool) string {
	if !alive || s == nil {
		return "⛔ *AI Trading Bot* — not reachable (start with `/aibot start`)"
	}
	runEmoji := "✅"
	if !s.IsRunning {
		runEmoji = "⏸"
	}
	pnlSign := ""
	if s.TotalProfit >= 0 {
		pnlSign = "+"
	}
	return fmt.Sprintf(
		"%s *AI Trading Bot*\n"+
			"Trades: `%d` (✅ %d / ❌ %d)\n"+
			"Win rate: `%.1f%%`\n"+
			"P&L: `%s%.4f SOL`\n"+
			"Open positions: `%d`",
		runEmoji,
		s.TotalTrades, s.SuccessfulTrades, s.FailedTrades,
		s.WinRate,
		pnlSign, s.TotalProfit,
		s.OpenPositions,
	)
}

// ── internal helpers ─────────────────────────────────────────────────────────

func getJSON[T any](ctx context.Context, c *AIBotClient, path string) (*T, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GET %s: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("GET %s: HTTP %d: %s", path, resp.StatusCode, body)
	}
	type envelope struct {
		Data *T `json:"data"`
	}
	var env envelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	if env.Data == nil {
		return nil, fmt.Errorf("GET %s: empty data field", path)
	}
	return env.Data, nil
}

func postEmpty(ctx context.Context, c *AIBotClient, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+path, bytes.NewReader(nil))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("POST %s: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("POST %s: HTTP %d: %s", path, resp.StatusCode, body)
	}
	return nil
}
