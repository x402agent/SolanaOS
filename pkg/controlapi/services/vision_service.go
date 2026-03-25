package services

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type VisionService struct {
	client *http.Client
	config *ConfigService
}

func NewVisionService(config *ConfigService) *VisionService {
	return &VisionService{
		client: &http.Client{Timeout: 45 * time.Second},
		config: config,
	}
}

func (s *VisionService) Analyze(req types.VisionAnalyzeRequest) (types.VisionAnalyzeResponse, error) {
	cfg := s.config.OpenRouterConfig()
	apiKey := strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY"))
	if apiKey == "" {
		return types.VisionAnalyzeResponse{}, fmt.Errorf("OPENROUTER_API_KEY is not configured")
	}
	if req.ImageBase64 == "" {
		return types.VisionAnalyzeResponse{}, fmt.Errorf("imageBase64 is required")
	}
	mimeType := strings.TrimSpace(req.MimeType)
	if mimeType == "" {
		mimeType = "image/jpeg"
	}
	if _, err := base64.StdEncoding.DecodeString(req.ImageBase64); err != nil {
		return types.VisionAnalyzeResponse{}, fmt.Errorf("imageBase64 is not valid base64")
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		prompt = "Give short live commentary about what is visible and what matters next."
	}

	payload := map[string]any{
		"model": cfg.GrokModel,
		"messages": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type": "image_url",
						"image_url": map[string]any{
							"url": "data:" + mimeType + ";base64," + req.ImageBase64,
						},
					},
				},
			},
		},
		"reasoning": map[string]any{
			"enabled": true,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return types.VisionAnalyzeResponse{}, err
	}
	httpReq, err := http.NewRequest(http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return types.VisionAnalyzeResponse{}, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("HTTP-Referer", "https://tech.solanaos.net")
	httpReq.Header.Set("X-Title", "SolanaOS Control API")

	res, err := s.client.Do(httpReq)
	if err != nil {
		return types.VisionAnalyzeResponse{}, err
	}
	defer res.Body.Close()
	rawBody, err := io.ReadAll(res.Body)
	if err != nil {
		return types.VisionAnalyzeResponse{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return types.VisionAnalyzeResponse{}, fmt.Errorf("openrouter vision failed: %s", strings.TrimSpace(string(rawBody)))
	}
	var decoded map[string]any
	if err := json.Unmarshal(rawBody, &decoded); err != nil {
		return types.VisionAnalyzeResponse{}, err
	}
	comment := extractOpenRouterMessage(decoded)
	if comment == "" {
		comment = "OpenRouter returned an empty commentary response."
	}
	return types.VisionAnalyzeResponse{
		Model:   cfg.GrokModel,
		Comment: comment,
	}, nil
}

func extractOpenRouterMessage(payload map[string]any) string {
	choices, ok := payload["choices"].([]any)
	if !ok || len(choices) == 0 {
		return ""
	}
	first, ok := choices[0].(map[string]any)
	if !ok {
		return ""
	}
	message, ok := first["message"].(map[string]any)
	if !ok {
		return ""
	}
	switch content := message["content"].(type) {
	case string:
		return strings.TrimSpace(content)
	case []any:
		var parts []string
		for _, entry := range content {
			obj, ok := entry.(map[string]any)
			if !ok {
				continue
			}
			text, _ := obj["text"].(string)
			if strings.TrimSpace(text) != "" {
				parts = append(parts, strings.TrimSpace(text))
			}
		}
		return strings.Join(parts, "\n")
	default:
		return ""
	}
}
