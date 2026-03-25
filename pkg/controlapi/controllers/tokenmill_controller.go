package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type TokenMillController struct {
	execution *services.ExecutionService
}

func NewTokenMillController(execution *services.ExecutionService) *TokenMillController {
	return &TokenMillController{execution: execution}
}

func (c *TokenMillController) CreateMarket(w http.ResponseWriter, r *http.Request) {
	var req types.TokenMillMarketRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.CurvePreset) == "" || req.SeedSOL <= 0 {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "name, curvePreset, and seedSol are required"})
		return
	}
	intent := c.execution.Stage(
		"tokenmill-market",
		fmt.Sprintf("Create Token Mill market %s with %s curve", req.Name, req.CurvePreset),
		map[string]any{
			"name":        req.Name,
			"curvePreset": req.CurvePreset,
			"seedSol":     req.SeedSOL,
		},
	)
	httpjson.Write(w, http.StatusAccepted, types.APIResponse{Success: true, Data: intent})
}
