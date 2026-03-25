package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestXAIToolCallsUseToolModelAndResponsesPayload(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		wantTool string
		call     func(*Client) (string, error)
	}{
		{
			name:     "web search",
			wantTool: "web_search",
			call: func(c *Client) (string, error) {
				return c.XAIWebSearch(context.Background(), "latest xAI news")
			},
		},
		{
			name:     "x search",
			wantTool: "x_search",
			call: func(c *Client) (string, error) {
				return c.XAIXSearch(context.Background(), "latest xAI posts")
			},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var gotBody map[string]interface{}
			client := &Client{
				xaiAPIKey:    "test-key",
				xaiBaseURL:   "https://api.x.ai/v1",
				xaiModel:     "grok-4-1-fast",
				xaiToolModel: "grok-4.20-beta-latest-non-reasoning",
				http: &http.Client{
					Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
						if r.Method != http.MethodPost {
							t.Fatalf("unexpected method: %s", r.Method)
						}
						if r.URL.Path != "/v1/responses" {
							t.Fatalf("unexpected path: %s", r.URL.Path)
						}
						if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
							t.Fatalf("decode request body: %v", err)
						}
						return &http.Response{
							StatusCode: http.StatusOK,
							Header:     make(http.Header),
							Body: io.NopCloser(strings.NewReader(`{
								"id":"resp_123",
								"output":[
									{
										"type":"message",
										"content":[{"type":"output_text","text":"search ok"}]
									}
								]
							}`)),
						}, nil
					}),
				},
				xaiResponseIDs: make(map[string]string),
			}

			reply, err := tc.call(client)
			if err != nil {
				t.Fatalf("tool call failed: %v", err)
			}
			if reply != "search ok" {
				t.Fatalf("unexpected reply: %q", reply)
			}

			if got := gotBody["model"]; got != client.xaiToolModel {
				t.Fatalf("expected model %q, got %#v", client.xaiToolModel, got)
			}
			if _, exists := gotBody["include"]; exists {
				t.Fatalf("expected responses payload without include, got %#v", gotBody["include"])
			}

			tools, ok := gotBody["tools"].([]interface{})
			if !ok || len(tools) != 1 {
				t.Fatalf("expected one tool, got %#v", gotBody["tools"])
			}
			tool, ok := tools[0].(map[string]interface{})
			if !ok {
				t.Fatalf("unexpected tool payload: %#v", tools[0])
			}
			if got := tool["type"]; got != tc.wantTool {
				t.Fatalf("expected tool %q, got %#v", tc.wantTool, got)
			}
		})
	}
}

func TestXAIOutputTextFallsBackToMessageContent(t *testing.T) {
	t.Parallel()

	var resp xaiResponsesResponse
	if err := json.Unmarshal([]byte(`{
		"id":"resp_456",
		"output":[
			{
				"type":"message",
				"content":[
					{"type":"output_text","text":"first"},
					{"type":"output_text","text":"second"}
				]
			}
		]
	}`), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if got := xaiOutputText(&resp); got != "first\n\nsecond" {
		t.Fatalf("unexpected output text: %q", got)
	}
}
