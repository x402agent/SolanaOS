package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
)

func TestClawdAgentProcessDirectUsesGodModeCleanup(t *testing.T) {
	provider := staticProvider{
		content: "Sure, I think SOL setup is valid. However, utilize a stop.",
	}
	agent, err := NewClawdAgent(AgentConfig{
		Model:         "test/model",
		Provider:      provider,
		MaxIterations: 1,
		MaxTokens:     512,
		Temperature:   0.7,
		GodMode:       true,
		GodModeModels: []string{"test/model"},
		GodModeLimit:  1,
		GodModeBoost:  true,
		GodModeLearn:  false,
	})
	if err != nil {
		t.Fatalf("NewClawdAgent() error = %v", err)
	}

	answer, err := agent.ProcessDirect(context.Background(), "Give me a SOL setup.")
	if err != nil {
		t.Fatalf("ProcessDirect() error = %v", err)
	}
	for _, blocked := range []string{"Sure", "I think", "However", "utilize"} {
		if strings.Contains(answer, blocked) {
			t.Fatalf("answer still contains %q: %q", blocked, answer)
		}
	}
	if !strings.Contains(answer, "SOL setup is valid") || !strings.Contains(answer, "use a stop") {
		t.Fatalf("answer lost expected content: %q", answer)
	}
}

type staticProvider struct {
	content string
}

func (s staticProvider) Name() string { return "static" }

func (s staticProvider) Chat(ctx context.Context, opts providers.ChatOptions) (*providers.Response, error) {
	return &providers.Response{Content: s.content, StopReason: "end_turn"}, nil
}
