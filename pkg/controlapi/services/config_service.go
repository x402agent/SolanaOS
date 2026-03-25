package services

import (
	"os"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type ConfigService struct{}

func NewConfigService() *ConfigService {
	return &ConfigService{}
}

func (s *ConfigService) OpenRouterConfig() types.OpenRouterConfig {
	apiKey := strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY"))
	model := strings.TrimSpace(os.Getenv("OPENROUTER_MODEL"))
	grokModel := strings.TrimSpace(os.Getenv("OPENROUTER_GROK_MODEL"))
	if model == "" {
		model = "minimax/minimax-m2.7"
	}
	if grokModel == "" {
		grokModel = "x-ai/grok-4.20-beta"
	}
	return types.OpenRouterConfig{
		Enabled:   apiKey != "",
		Model:     model,
		GrokModel: grokModel,
	}
}
