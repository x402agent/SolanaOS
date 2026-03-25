package controllers

import (
	"net/http"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type StatusController struct {
	config    *services.ConfigService
	threads   *services.ThreadService
	execution *services.ExecutionService
}

func NewStatusController(config *services.ConfigService, threads *services.ThreadService, execution *services.ExecutionService) *StatusController {
	return &StatusController{
		config:    config,
		threads:   threads,
		execution: execution,
	}
}

func (c *StatusController) Health(w http.ResponseWriter, r *http.Request) {
	httpjson.Write(w, http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]any{
			"status": "healthy",
		},
	})
}

func (c *StatusController) Status(w http.ResponseWriter, r *http.Request) {
	status := types.ControlStatus{
		Service:           "solanaos-control-api",
		OpenRouter:        c.config.OpenRouterConfig(),
		ThreadCount:       c.threads.Count(),
		StagedIntentCount: c.execution.Count(),
		Features: []string{
			"chat.rooms",
			"chat.messages",
			"threads",
			"trade.quote",
			"trade.stage",
			"pumpfun.stage",
			"tokenmill.stage",
			"openrouter.vision",
		},
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: status})
}
