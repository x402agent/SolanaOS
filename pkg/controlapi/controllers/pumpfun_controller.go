package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type PumpfunController struct {
	execution *services.ExecutionService
}

func NewPumpfunController(execution *services.ExecutionService) *PumpfunController {
	return &PumpfunController{execution: execution}
}

func (c *PumpfunController) Launch(w http.ResponseWriter, r *http.Request) {
	var req types.PumpfunLaunchRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Symbol) == "" || req.AmountSOL <= 0 {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "name, symbol, and amountSol are required"})
		return
	}
	intent := c.execution.Stage(
		"pumpfun-launch",
		fmt.Sprintf("Launch %s (%s) with %0.4f SOL", req.Name, strings.ToUpper(req.Symbol), req.AmountSOL),
		map[string]any{
			"name":        req.Name,
			"symbol":      strings.ToUpper(req.Symbol),
			"description": req.Description,
			"amountSol":   req.AmountSOL,
		},
	)
	httpjson.Write(w, http.StatusAccepted, types.APIResponse{Success: true, Data: intent})
}

func (c *PumpfunController) Buy(w http.ResponseWriter, r *http.Request) {
	c.stageSwap(w, r, "pumpfun-buy", "Buy")
}

func (c *PumpfunController) Sell(w http.ResponseWriter, r *http.Request) {
	c.stageSwap(w, r, "pumpfun-sell", "Sell")
}

func (c *PumpfunController) stageSwap(w http.ResponseWriter, r *http.Request, kind string, verb string) {
	var req types.PumpfunSwapRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if strings.TrimSpace(req.TokenAddress) == "" || req.AmountSOL <= 0 {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "tokenAddress and amountSol are required"})
		return
	}
	intent := c.execution.Stage(
		kind,
		fmt.Sprintf("%s %0.4f SOL of %s", verb, req.AmountSOL, req.TokenAddress),
		map[string]any{
			"tokenAddress": req.TokenAddress,
			"amountSol":    req.AmountSOL,
		},
	)
	httpjson.Write(w, http.StatusAccepted, types.APIResponse{Success: true, Data: intent})
}
