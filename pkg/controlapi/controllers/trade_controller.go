package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type TradeController struct {
	jupiter   *services.JupiterService
	execution *services.ExecutionService
}

func NewTradeController(jupiter *services.JupiterService, execution *services.ExecutionService) *TradeController {
	return &TradeController{
		jupiter:   jupiter,
		execution: execution,
	}
}

func (c *TradeController) Quote(w http.ResponseWriter, r *http.Request) {
	var req types.TradeQuoteRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	quote, err := c.jupiter.Quote(req)
	if err != nil {
		httpjson.Write(w, http.StatusBadGateway, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: quote})
}

func (c *TradeController) Stage(w http.ResponseWriter, r *http.Request) {
	var req types.TradeStageRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if req.Amount <= 0 || strings.TrimSpace(req.FromToken) == "" || strings.TrimSpace(req.ToToken) == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "fromToken, toToken, and amount are required"})
		return
	}
	intent := c.execution.Stage(
		"trade",
		fmt.Sprintf("Stage %0.4f %s -> %s", req.Amount, strings.ToUpper(req.FromToken), strings.ToUpper(req.ToToken)),
		map[string]any{
			"fromToken":   req.FromToken,
			"toToken":     req.ToToken,
			"amount":      req.Amount,
			"slippageBps": req.SlippageBps,
		},
	)
	httpjson.Write(w, http.StatusAccepted, types.APIResponse{Success: true, Data: intent})
}
