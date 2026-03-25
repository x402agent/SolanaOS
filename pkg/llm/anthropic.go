package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type anthropicMessagesResponse struct {
	ID         string `json:"id"`
	StopReason string `json:"stop_reason"`
	Content    []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) AnthropicBaseURL() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.anthropicBaseURL
}

func (c *Client) AnthropicModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.anthropicModel
}

func (c *Client) ConfigureAnthropic(apiKey, baseURL string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if strings.TrimSpace(apiKey) != "" {
		c.anthropicAPIKey = strings.TrimSpace(apiKey)
	}
	if strings.TrimSpace(baseURL) != "" {
		c.anthropicBaseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	}
	if strings.TrimSpace(c.anthropicAPIKey) != "" &&
		strings.TrimSpace(c.apiKey) == "" &&
		strings.TrimSpace(c.xaiAPIKey) == "" &&
		strings.TrimSpace(c.ollamaModel) == "" {
		c.activeProvider = "anthropic"
	}
}

func (c *Client) chatAnthropic(ctx context.Context, baseURL, model, systemPrompt string, messages []map[string]interface{}) (string, error) {
	if strings.TrimSpace(c.anthropicAPIKey) == "" {
		return "", fmt.Errorf("anthropic: ANTHROPIC_API_KEY not configured")
	}
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultAnthropicBaseURL
	}
	if strings.TrimSpace(model) == "" {
		model = DefaultAnthropicModel
	}

	payload := map[string]interface{}{
		"model":      model,
		"max_tokens": c.anthropicMaxTokens,
		"messages":   messages,
	}
	if strings.TrimSpace(systemPrompt) != "" {
		payload["system"] = strings.TrimSpace(systemPrompt)
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.anthropicAPIKey)
	req.Header.Set("anthropic-version", firstNonEmpty(c.anthropicVersion, DefaultAnthropicVersion))
	if len(c.anthropicBetas) > 0 {
		req.Header.Set("anthropic-beta", strings.Join(c.anthropicBetas, ","))
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic %d (%s): %s", resp.StatusCode, model, truncate(string(respBody), 240))
	}

	var result anthropicMessagesResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("anthropic decode: %w", err)
	}
	if result.Error != nil && strings.TrimSpace(result.Error.Message) != "" {
		return "", fmt.Errorf("anthropic: %s", result.Error.Message)
	}

	var parts []string
	for _, block := range result.Content {
		if block.Type == "text" && strings.TrimSpace(block.Text) != "" {
			parts = append(parts, block.Text)
		}
	}
	reply := strings.TrimSpace(strings.Join(parts, "\n"))
	if reply == "" {
		return "", fmt.Errorf("anthropic: empty response")
	}
	return reply, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
