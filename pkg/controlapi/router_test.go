package controlapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

func TestHealthEndpoint(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	NewServer().Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var payload types.APIResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected success response")
	}

	data, ok := payload.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected health data object, got %T", payload.Data)
	}
	if got := data["status"]; got != "healthy" {
		t.Fatalf("expected health status healthy, got %#v", got)
	}
}

func TestStatusEndpoint(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/api/control/status", nil)
	rec := httptest.NewRecorder()

	NewServer().Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var payload struct {
		Success bool                `json:"success"`
		Data    types.ControlStatus `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected success response")
	}
	if payload.Data.Service != "solanaos-control-api" {
		t.Fatalf("expected service solanaos-control-api, got %q", payload.Data.Service)
	}
	if len(payload.Data.Features) == 0 {
		t.Fatalf("expected non-empty feature list")
	}
	if payload.Data.ThreadCount < 2 {
		t.Fatalf("expected seeded thread count >= 2, got %d", payload.Data.ThreadCount)
	}
	if payload.Data.StagedIntentCount != 0 {
		t.Fatalf("expected initial staged intent count 0, got %d", payload.Data.StagedIntentCount)
	}
	if !slices.Contains(payload.Data.Features, "openrouter.vision") {
		t.Fatalf("expected openrouter.vision feature in status payload")
	}
}

func TestIntentsEndpointReturnsEmptyListByDefault(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/api/control/intents", nil)
	rec := httptest.NewRecorder()

	NewServer().Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var payload struct {
		Success bool                 `json:"success"`
		Data    []types.StagedIntent `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected success response")
	}
	if len(payload.Data) != 0 {
		t.Fatalf("expected empty intents list, got %d items", len(payload.Data))
	}
}
