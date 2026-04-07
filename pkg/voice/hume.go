// Package voice — Hume AI emotion analysis for voice messages.
// Uses the Hume streaming WebSocket API to detect emotions from audio.
package voice

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const humeStreamURL = "wss://api.hume.ai/v0/stream/models"

// EmotionScore is a single emotion with its confidence score.
type EmotionScore struct {
	Name  string  `json:"name"`
	Score float64 `json:"score"`
}

// EmotionResult holds the top emotions detected from audio.
type EmotionResult struct {
	TopEmotions []EmotionScore `json:"top_emotions"`
	RawJSON     string         `json:"-"`
}

// Summary returns a human-readable string of top emotions.
func (e *EmotionResult) Summary() string {
	if e == nil || len(e.TopEmotions) == 0 {
		return "no emotions detected"
	}
	parts := make([]string, 0, len(e.TopEmotions))
	for _, em := range e.TopEmotions {
		parts = append(parts, fmt.Sprintf("%s (%.0f%%)", em.Name, em.Score*100))
	}
	return strings.Join(parts, ", ")
}

// HumeAnalyzer detects emotions in audio via the Hume streaming API.
type HumeAnalyzer struct {
	apiKey string
}

func NewHumeAnalyzer(apiKey string) *HumeAnalyzer {
	return &HumeAnalyzer{apiKey: apiKey}
}

// AnalyzeFile reads an audio file and returns emotion analysis.
func (h *HumeAnalyzer) AnalyzeFile(ctx context.Context, audioPath string) (*EmotionResult, error) {
	data, err := os.ReadFile(audioPath)
	if err != nil {
		return nil, fmt.Errorf("hume: read audio: %w", err)
	}
	return h.AnalyzeBytes(ctx, data)
}

// AnalyzeBytes sends raw audio bytes to Hume for emotion analysis.
func (h *HumeAnalyzer) AnalyzeBytes(ctx context.Context, audio []byte) (*EmotionResult, error) {
	encoded := base64.StdEncoding.EncodeToString(audio)

	header := http.Header{}
	header.Set("X-Hume-Api-Key", h.apiKey)

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, humeStreamURL, header)
	if err != nil {
		return nil, fmt.Errorf("hume: websocket dial: %w", err)
	}
	defer conn.Close()

	// Send audio payload — request prosody (voice emotion) model
	payload := map[string]interface{}{
		"data":   encoded,
		"models": map[string]interface{}{
			"prosody": map[string]interface{}{},
		},
		"stream_window_ms": 5000,
	}

	if err := conn.WriteJSON(payload); err != nil {
		return nil, fmt.Errorf("hume: send payload: %w", err)
	}

	// Read the response
	conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		return nil, fmt.Errorf("hume: read response: %w", err)
	}

	return parseHumeResponse(msg)
}

// AnalyzeURL downloads audio from a URL and analyzes it.
func (h *HumeAnalyzer) AnalyzeURL(ctx context.Context, audioURL string) (*EmotionResult, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", audioURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hume: download audio: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 25*1024*1024)) // 25MB max
	if err != nil {
		return nil, fmt.Errorf("hume: read audio body: %w", err)
	}
	return h.AnalyzeBytes(ctx, data)
}

func parseHumeResponse(raw []byte) (*EmotionResult, error) {
	// Hume streaming response structure:
	// { "prosody": { "predictions": [{ "emotions": [{ "name": "...", "score": 0.xx }] }] } }
	var resp struct {
		Prosody struct {
			Predictions []struct {
				Emotions []EmotionScore `json:"emotions"`
			} `json:"predictions"`
		} `json:"prosody"`
	}

	if err := json.Unmarshal(raw, &resp); err != nil {
		return &EmotionResult{RawJSON: string(raw)}, fmt.Errorf("hume: parse response: %w", err)
	}

	// Aggregate emotions across all predictions
	emotionMap := make(map[string]float64)
	count := make(map[string]int)
	for _, pred := range resp.Prosody.Predictions {
		for _, em := range pred.Emotions {
			emotionMap[em.Name] += em.Score
			count[em.Name]++
		}
	}

	// Average and sort
	var allEmotions []EmotionScore
	for name, total := range emotionMap {
		allEmotions = append(allEmotions, EmotionScore{
			Name:  name,
			Score: total / float64(count[name]),
		})
	}
	sort.Slice(allEmotions, func(i, j int) bool {
		return allEmotions[i].Score > allEmotions[j].Score
	})

	// Take top 5
	top := 5
	if len(allEmotions) < top {
		top = len(allEmotions)
	}

	return &EmotionResult{
		TopEmotions: allEmotions[:top],
		RawJSON:     string(raw),
	}, nil
}

// NoopAnalyzer returns empty results when Hume is disabled.
type NoopAnalyzer struct{}

func (n *NoopAnalyzer) AnalyzeFile(ctx context.Context, audioPath string) (*EmotionResult, error) {
	return &EmotionResult{}, nil
}

func (n *NoopAnalyzer) AnalyzeURL(ctx context.Context, audioURL string) (*EmotionResult, error) {
	return &EmotionResult{}, nil
}
