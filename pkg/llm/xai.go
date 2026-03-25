package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type XAIImageRequest struct {
	Prompt      string
	ImageURL    string
	AspectRatio string
	Resolution  string
	N           int
}

type XAIVideoRequest struct {
	Prompt       string
	DurationSec  int
	AspectRatio  string
	Resolution   string
	PollTimeout  time.Duration
	PollInterval time.Duration
}

type xaiResponsesResponse struct {
	ID         string `json:"id"`
	OutputText string `json:"output_text"`
	Output     []struct {
		Type    string `json:"type"`
		Role    string `json:"role"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type xaiImageResponse struct {
	Data []struct {
		URL string `json:"url"`
	} `json:"data"`
	Images []struct {
		URL string `json:"url"`
	} `json:"images"`
	URL   string `json:"url"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type xaiVideoStartResponse struct {
	RequestID string `json:"request_id"`
	Error     *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type xaiVideoStatusResponse struct {
	Status string `json:"status"`
	Model  string `json:"model"`
	Video  struct {
		URL               string `json:"url"`
		Duration          int    `json:"duration"`
		RespectModeration bool   `json:"respect_moderation"`
	} `json:"video"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) XAIBaseURL() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.xaiBaseURL
}

func (c *Client) XAIModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.xaiModel
}

func (c *Client) XAIToolModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.xaiToolModel
}

func (c *Client) XAIImageModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.xaiImageModel
}

func (c *Client) XAIVideoModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.xaiVideoModel
}

func (c *Client) XAIMultiAgentModel() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.xaiMultiAgentModel
}

func (c *Client) chatXAI(ctx context.Context, baseURL, model, sessionID string, messages []map[string]interface{}) (string, json.RawMessage, error) {
	c.mu.Lock()
	prevRespID := c.xaiResponseIDs[sessionID]
	c.mu.Unlock()

	var reqBody map[string]interface{}
	isReasoning := xaiIsReasoningModel(model)

	if prevRespID != "" {
		// Stateful: only send the new user message; history lives on xAI servers.
		var lastUserMsg map[string]interface{}
		for i := len(messages) - 1; i >= 0; i-- {
			if messages[i]["role"] == "user" {
				lastUserMsg = messages[i]
				break
			}
		}
		if lastUserMsg == nil {
			return "", nil, fmt.Errorf("xai: no user message in history")
		}
		reqBody = map[string]interface{}{
			"model":                model,
			"previous_response_id": prevRespID,
			"store":                true,
			"input":                []map[string]interface{}{lastUserMsg},
		}
	} else {
		// First turn: send full history including system message.
		reqBody = map[string]interface{}{
			"model": model,
			"store": true,
			"input": messages,
		}
	}
	if isReasoning {
		reqBody["include"] = []string{"reasoning.encrypted_content"}
	}

	resp, err := c.xaiResponses(ctx, baseURL, reqBody)
	if err != nil {
		return "", nil, err
	}

	// Persist the response ID for subsequent turns in this session.
	if resp.ID != "" {
		c.mu.Lock()
		c.xaiResponseIDs[sessionID] = resp.ID
		c.mu.Unlock()
	}

	return xaiOutputText(resp), nil, nil
}

// xaiIsReasoningModel returns true for models that support encrypted reasoning.
func xaiIsReasoningModel(model string) bool {
	lower := strings.ToLower(model)
	return strings.Contains(lower, "reasoning") || model == "grok-3-mini" ||
		model == "grok-4" || model == "grok-4-fast"
}

func (c *Client) XAIWebSearch(ctx context.Context, prompt string) (string, error) {
	return c.xaiToolPrompt(ctx, c.XAIToolModel(), prompt, []map[string]interface{}{
		{"type": "web_search", "enable_image_understanding": true},
	}, "")
}

func (c *Client) XAIXSearch(ctx context.Context, prompt string) (string, error) {
	return c.xaiToolPrompt(ctx, c.XAIToolModel(), prompt, []map[string]interface{}{
		{"type": "x_search", "enable_image_understanding": true, "enable_video_understanding": true},
	}, "")
}

func (c *Client) XAIMultiAgent(ctx context.Context, prompt string, deep bool) (string, error) {
	effort := "medium"
	if deep {
		effort = "high"
	}
	return c.xaiToolPrompt(ctx, c.XAIMultiAgentModel(), prompt, []map[string]interface{}{
		{"type": "web_search", "enable_image_understanding": true},
		{"type": "x_search", "enable_image_understanding": true, "enable_video_understanding": true},
	}, effort)
}

func (c *Client) XAIVision(ctx context.Context, imageURL, prompt string) (string, error) {
	imageURL = strings.TrimSpace(imageURL)
	prompt = strings.TrimSpace(prompt)
	if imageURL == "" {
		return "", fmt.Errorf("image URL is required")
	}
	if prompt == "" {
		prompt = "What is in this image?"
	}
	model := c.XAIModel()
	if !isXAIModelToken(model) {
		model = DefaultXAIModel
	}
	reqBody := map[string]interface{}{
		"model": model,
		"store": false,
		"input": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "input_image", "image_url": imageURL, "detail": "high"},
					{"type": "input_text", "text": prompt},
				},
			},
		},
	}
	resp, err := c.xaiResponses(ctx, c.XAIBaseURL(), reqBody)
	if err != nil {
		return "", err
	}
	return xaiOutputText(resp), nil
}

func (c *Client) XAIImage(ctx context.Context, req XAIImageRequest) ([]string, error) {
	baseURL, apiKey, err := c.xaiConfig()
	if err != nil {
		return nil, err
	}
	payload := map[string]interface{}{
		"model":  c.XAIImageModel(),
		"prompt": strings.TrimSpace(req.Prompt),
	}
	if payload["prompt"] == "" {
		return nil, fmt.Errorf("prompt is required")
	}
	if req.ImageURL != "" {
		payload["image_url"] = strings.TrimSpace(req.ImageURL)
	}
	if req.AspectRatio != "" {
		payload["aspect_ratio"] = strings.TrimSpace(req.AspectRatio)
	}
	if req.Resolution != "" {
		payload["resolution"] = strings.TrimSpace(req.Resolution)
	}
	if req.N > 1 {
		payload["n"] = req.N
	}

	var result xaiImageResponse
	if err := c.xaiRequestJSON(ctx, http.MethodPost, baseURL+"/images/generations", apiKey, payload, &result); err != nil {
		return nil, err
	}
	if result.Error != nil && result.Error.Message != "" {
		return nil, fmt.Errorf("xai image: %s", result.Error.Message)
	}
	var urls []string
	for _, item := range result.Data {
		if strings.TrimSpace(item.URL) != "" {
			urls = append(urls, item.URL)
		}
	}
	for _, item := range result.Images {
		if strings.TrimSpace(item.URL) != "" {
			urls = append(urls, item.URL)
		}
	}
	if strings.TrimSpace(result.URL) != "" {
		urls = append(urls, result.URL)
	}
	if len(urls) == 0 {
		return nil, fmt.Errorf("xai image: empty response")
	}
	return urls, nil
}

func (c *Client) XAIVideo(ctx context.Context, req XAIVideoRequest) (string, error) {
	baseURL, apiKey, err := c.xaiConfig()
	if err != nil {
		return "", err
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return "", fmt.Errorf("prompt is required")
	}
	if req.DurationSec <= 0 {
		req.DurationSec = 5
	}
	if req.PollTimeout <= 0 {
		req.PollTimeout = 10 * time.Minute
	}
	if req.PollInterval <= 0 {
		req.PollInterval = 5 * time.Second
	}

	payload := map[string]interface{}{
		"model":    c.XAIVideoModel(),
		"prompt":   prompt,
		"duration": req.DurationSec,
	}
	if req.AspectRatio != "" {
		payload["aspect_ratio"] = strings.TrimSpace(req.AspectRatio)
	}
	if req.Resolution != "" {
		payload["resolution"] = strings.TrimSpace(req.Resolution)
	}

	var start xaiVideoStartResponse
	if err := c.xaiRequestJSON(ctx, http.MethodPost, baseURL+"/videos/generations", apiKey, payload, &start); err != nil {
		return "", err
	}
	if start.Error != nil && start.Error.Message != "" {
		return "", fmt.Errorf("xai video: %s", start.Error.Message)
	}
	if strings.TrimSpace(start.RequestID) == "" {
		return "", fmt.Errorf("xai video: missing request_id")
	}

	deadline := time.Now().Add(req.PollTimeout)
	for {
		var status xaiVideoStatusResponse
		if err := c.xaiRequestJSON(ctx, http.MethodGet, baseURL+"/videos/"+start.RequestID, apiKey, nil, &status); err != nil {
			return "", err
		}
		if status.Error != nil && status.Error.Message != "" {
			return "", fmt.Errorf("xai video: %s", status.Error.Message)
		}
		switch strings.ToLower(strings.TrimSpace(status.Status)) {
		case "done":
			if strings.TrimSpace(status.Video.URL) == "" {
				return "", fmt.Errorf("xai video: completed without a video URL")
			}
			return status.Video.URL, nil
		case "failed":
			return "", fmt.Errorf("xai video: generation failed")
		case "expired":
			return "", fmt.Errorf("xai video: generation expired")
		}

		if time.Now().After(deadline) {
			return "", fmt.Errorf("xai video: timed out waiting for generation")
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(req.PollInterval):
		}
	}
}

func (c *Client) xaiToolPrompt(ctx context.Context, model, prompt string, tools []map[string]interface{}, effort string) (string, error) {
	baseURL, _, err := c.xaiConfig()
	if err != nil {
		return "", err
	}
	reqBody := map[string]interface{}{
		"model": model,
		"store": false,
		"input": []map[string]interface{}{
			{"role": "user", "content": strings.TrimSpace(prompt)},
		},
		"tools": tools,
	}
	if strings.TrimSpace(prompt) == "" {
		return "", fmt.Errorf("prompt is required")
	}
	if effort != "" {
		reqBody["reasoning"] = map[string]interface{}{"effort": effort}
	}
	resp, err := c.xaiResponses(ctx, baseURL, reqBody)
	if err != nil {
		return "", err
	}
	return xaiOutputText(resp), nil
}

func (c *Client) xaiResponses(ctx context.Context, baseURL string, payload map[string]interface{}) (*xaiResponsesResponse, error) {
	_, apiKey, err := c.xaiConfig()
	if err != nil {
		return nil, err
	}
	var result xaiResponsesResponse
	if err := c.xaiRequestJSON(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/responses", apiKey, payload, &result); err != nil {
		return nil, err
	}
	if result.Error != nil && result.Error.Message != "" {
		return nil, fmt.Errorf("xai: %s", result.Error.Message)
	}
	if xaiOutputText(&result) == "" {
		return nil, fmt.Errorf("xai: empty response")
	}
	return &result, nil
}

func (c *Client) xaiConfig() (string, string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if strings.TrimSpace(c.xaiAPIKey) == "" {
		return "", "", fmt.Errorf("XAI_API_KEY not set")
	}
	return strings.TrimRight(c.xaiBaseURL, "/"), c.xaiAPIKey, nil
}

func (c *Client) xaiRequestJSON(ctx context.Context, method, endpoint, apiKey string, payload any, out any) error {
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("xai: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("xai %d: %s", resp.StatusCode, truncate(string(respBody), 240))
	}
	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("xai decode: %w", err)
	}
	return nil
}

func xaiOutputText(resp *xaiResponsesResponse) string {
	if resp == nil {
		return ""
	}
	if text := strings.TrimSpace(resp.OutputText); text != "" {
		return text
	}
	var parts []string
	for _, item := range resp.Output {
		if item.Type != "message" {
			continue
		}
		for _, content := range item.Content {
			if content.Type == "output_text" && strings.TrimSpace(content.Text) != "" {
				parts = append(parts, content.Text)
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n\n"))
}
