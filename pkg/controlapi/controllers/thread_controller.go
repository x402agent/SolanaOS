package controllers

import (
	"net/http"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type ThreadController struct {
	threads *services.ThreadService
}

func NewThreadController(threads *services.ThreadService) *ThreadController {
	return &ThreadController{threads: threads}
}

func (c *ThreadController) List(w http.ResponseWriter, r *http.Request) {
	httpjson.Write(w, http.StatusOK, types.APIResponse{
		Success: true,
		Data:    c.threads.List(),
	})
}

func (c *ThreadController) Create(w http.ResponseWriter, r *http.Request) {
	var req types.CreateThreadRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if strings.TrimSpace(req.Headline) == "" || strings.TrimSpace(req.Body) == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "headline and body are required"})
		return
	}
	item := c.threads.Create(req)
	httpjson.Write(w, http.StatusCreated, types.APIResponse{Success: true, Data: item})
}
