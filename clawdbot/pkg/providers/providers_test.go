package providers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenRouterProviderSendsOptionalSamplingParams(t *testing.T) {
	payloads := make(chan map[string]any, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("Authorization = %q", got)
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		payloads <- payload
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2}}`))
	}))
	defer server.Close()

	provider := NewOpenAICompatProvider("test-key", server.URL)
	resp, err := provider.Chat(context.Background(), ChatOptions{
		Model:             "test/model",
		Messages:          []Message{{Role: "user", Content: "hello"}},
		MaxTokens:         123,
		Temperature:       0.4,
		TopP:              0.88,
		TopK:              40,
		FrequencyPenalty:  0.2,
		PresencePenalty:   0.15,
		RepetitionPenalty: 1.08,
	})
	if err != nil {
		t.Fatalf("Chat() error = %v", err)
	}
	if resp.Content != "ok" || resp.InputTokens != 1 || resp.OutputTokens != 2 {
		t.Fatalf("response = %#v", resp)
	}

	payload := <-payloads
	for key, want := range map[string]float64{
		"temperature":        0.4,
		"top_p":              0.88,
		"frequency_penalty":  0.2,
		"presence_penalty":   0.15,
		"repetition_penalty": 1.08,
	} {
		if got, _ := payload[key].(float64); got != want {
			t.Fatalf("payload[%s] = %v, want %v in %#v", key, got, want, payload)
		}
	}
	if got, _ := payload["top_k"].(float64); got != 40 {
		t.Fatalf("payload[top_k] = %v, want 40 in %#v", got, payload)
	}
}
