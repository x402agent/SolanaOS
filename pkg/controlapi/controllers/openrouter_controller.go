package controllers

import (
	"net/http"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type OpenRouterController struct {
	config *services.ConfigService
	vision *services.VisionService
}

func NewOpenRouterController(config *services.ConfigService, vision *services.VisionService) *OpenRouterController {
	return &OpenRouterController{
		config: config,
		vision: vision,
	}
}

func (c *OpenRouterController) Config(w http.ResponseWriter, r *http.Request) {
	httpjson.Write(w, http.StatusOK, types.APIResponse{
		Success: true,
		Data:    c.config.OpenRouterConfig(),
	})
}

func (c *OpenRouterController) VisionAnalyze(w http.ResponseWriter, r *http.Request) {
	var req types.VisionAnalyzeRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	resp, err := c.vision.Analyze(req)
	if err != nil {
		httpjson.Write(w, http.StatusBadGateway, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: resp})
}
