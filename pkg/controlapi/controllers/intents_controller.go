package controllers

import (
	"net/http"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type IntentsController struct {
	execution *services.ExecutionService
}

func NewIntentsController(execution *services.ExecutionService) *IntentsController {
	return &IntentsController{execution: execution}
}

func (c *IntentsController) List(w http.ResponseWriter, r *http.Request) {
	httpjson.Write(w, http.StatusOK, types.APIResponse{
		Success: true,
		Data:    c.execution.List(),
	})
}
