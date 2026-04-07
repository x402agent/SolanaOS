package llm

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

const (
	DefaultLlamaCppURL   = "http://127.0.0.1:8079"
	DefaultLlamaCppModel = "gemma4"
)

// chatLlamaCpp sends a chat completion request to a llama.cpp server
// (OpenAI-compatible /v1/chat/completions endpoint).
func (c *Client) chatLlamaCpp(ctx context.Context, baseURL, model string, messages []map[string]interface{}) (string, error) {
	payload := map[string]interface{}{
		"model":    model,
		"messages": messages,
		"stream":   false,
		"temperature": 0.2,
	}

	body, _ := json.Marshal(payload)
	url := strings.TrimRight(baseURL, "/") + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("llama.cpp: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("llama.cpp %d (%s): %s", resp.StatusCode, model, truncate(string(respBody), 200))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("llama.cpp decode: %w", err)
	}
	if result.Error != nil && result.Error.Message != "" {
		return "", fmt.Errorf("llama.cpp: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("llama.cpp: no choices in response")
	}
	reply := strings.TrimSpace(result.Choices[0].Message.Content)
	if reply == "" {
		return "", fmt.Errorf("llama.cpp: empty response")
	}
	return reply, nil
}

// ChatLlamaCppVision sends a message with an image to the llama.cpp server
// for multimodal/vision analysis. The image can be a URL or base64 data.
func (c *Client) ChatLlamaCppVision(ctx context.Context, sessionID, userMsg, imageData string, isBase64 bool) (string, error) {
	c.mu.Lock()
	baseURL := c.llamaCppURL
	model := c.llamaCppModel
	history := append([]Message(nil), c.sessions[sessionID]...)
	c.mu.Unlock()

	if baseURL == "" {
		baseURL = DefaultLlamaCppURL
	}
	if model == "" {
		model = DefaultLlamaCppModel
	}

	// Build multimodal content array
	content := []map[string]interface{}{
		{"type": "text", "text": userMsg},
	}

	if imageData != "" {
		var imageURL string
		if isBase64 {
			imageURL = "data:image/jpeg;base64," + imageData
		} else {
			imageURL = imageData
		}
		content = append(content, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]string{
				"url": imageURL,
			},
		})
	}

	// Build messages with history
	messages := make([]map[string]interface{}, 0, len(history)+2)
	messages = append(messages, map[string]interface{}{
		"role":    "system",
		"content": "You are SolanaOS, an AI assistant with vision capabilities. Describe what you see accurately and helpfully.",
	})
	for _, m := range history {
		messages = append(messages, map[string]interface{}{
			"role":    m.Role,
			"content": m.Content,
		})
	}
	messages = append(messages, map[string]interface{}{
		"role":    "user",
		"content": content,
	})

	reply, err := c.chatLlamaCpp(ctx, baseURL, model, messages)
	if err != nil {
		return "", err
	}

	// Update session
	c.mu.Lock()
	history = append(history, Message{Role: "user", Content: userMsg})
	history = append(history, Message{Role: "assistant", Content: reply})
	if len(history) > maxHistory {
		history = history[len(history)-maxHistory:]
	}
	c.sessions[sessionID] = history
	c.lastResolvedClient = "llama.cpp"
	c.mu.Unlock()

	return reply, nil
}

// ChatLlamaCppDirect sends a stateless message to the llama.cpp server.
func (c *Client) ChatLlamaCppDirect(ctx context.Context, sessionID, userMsg, contextStr string) (string, error) {
	c.mu.Lock()
	baseURL := c.llamaCppURL
	model := c.llamaCppModel
	history := append([]Message(nil), c.sessions[sessionID]...)
	history = append(history, Message{Role: "user", Content: userMsg})
	c.mu.Unlock()

	if baseURL == "" {
		baseURL = DefaultLlamaCppURL
	}
	if model == "" {
		model = DefaultLlamaCppModel
	}

	sysContent := buildSystemPrompt(contextStr)
	messages := make([]map[string]interface{}, 0, len(history)+1)
	messages = append(messages, map[string]interface{}{
		"role":    "system",
		"content": sysContent,
	})
	for _, m := range history {
		messages = append(messages, map[string]interface{}{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	reply, err := c.chatLlamaCpp(ctx, baseURL, model, messages)
	if err != nil {
		return "", err
	}

	c.mu.Lock()
	c.sessions[sessionID] = append(history, Message{Role: "assistant", Content: reply})
	c.lastResolvedClient = "llama.cpp"
	c.mu.Unlock()

	return reply, nil
}

// IsLlamaCppConfigured checks if llama.cpp server is configured.
func (c *Client) IsLlamaCppConfigured() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.llamaCppEnabled && c.llamaCppURL != ""
}

// LlamaCppURL returns the configured llama.cpp server URL.
func (c *Client) LlamaCppURL() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.llamaCppURL
}

// LlamaCppModel returns the configured llama.cpp model name.
func (c *Client) LlamaCppModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.llamaCppModel
}

// HealthCheckLlamaCpp pings the llama-server /health endpoint.
func (c *Client) HealthCheckLlamaCpp(ctx context.Context) (bool, string) {
	c.mu.Lock()
	baseURL := c.llamaCppURL
	c.mu.Unlock()
	if baseURL == "" {
		return false, "not configured"
	}

	url := strings.TrimRight(baseURL, "/") + "/health"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err.Error()
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return false, err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusOK {
		return true, string(body)
	}
	return false, fmt.Sprintf("status %d: %s", resp.StatusCode, truncate(string(body), 100))
}

// Helper to encode image file to base64 for vision requests
func EncodeImageBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
