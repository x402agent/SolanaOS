package honcho

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestNewClientDefaultsToProductionBaseURL(t *testing.T) {
	client := NewClient(config.HonchoConfig{})
	if client.baseURL != defaultHonchoBaseURL {
		t.Fatalf("baseURL = %q, want %q", client.baseURL, defaultHonchoBaseURL)
	}
}

func TestPeerContextUsesGetWithQueryParams(t *testing.T) {
	t.Helper()

	var (
		gotMethod string
		gotPath   string
		gotAuth   string
		gotTarget string
		gotSearch string
	)

	client := NewClient(config.HonchoConfig{
		BaseURL:     "https://api.honcho.dev",
		APIKey:      "test-key",
		WorkspaceID: "ws-1",
	})
	client.http = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotTarget = r.URL.Query().Get("target")
		gotSearch = r.URL.Query().Get("search_query")
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"peer_id":"alice","target_id":"bob","representation":"ctx","peer_card":["prefers concise replies"]}`,
			)),
		}, nil
	})}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	out, err := client.PeerContext(ctx, "alice", "bob", "preferences")
	if err != nil {
		t.Fatalf("PeerContext() error = %v", err)
	}

	if gotMethod != http.MethodGet {
		t.Fatalf("method = %q, want %q", gotMethod, http.MethodGet)
	}
	if gotPath != "/v3/workspaces/ws-1/peers/alice/context" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotAuth != "Bearer test-key" {
		t.Fatalf("Authorization = %q", gotAuth)
	}
	if gotTarget != "bob" {
		t.Fatalf("target = %q, want %q", gotTarget, "bob")
	}
	if gotSearch != "preferences" {
		t.Fatalf("search_query = %q, want %q", gotSearch, "preferences")
	}
	if out == nil || out.PeerID != "alice" || out.TargetID != "bob" {
		t.Fatalf("unexpected PeerContext response: %#v", out)
	}
}

func TestEnsureMethodsMemoizeSuccessfulSetup(t *testing.T) {
	t.Helper()

	callCount := map[string]int{}
	client := NewClient(config.HonchoConfig{
		BaseURL:     "https://api.honcho.dev",
		APIKey:      "test-key",
		WorkspaceID: "ws-1",
	})
	client.http = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		callCount[r.URL.Path]++
		body, _ := json.Marshal(map[string]any{"ok": true})
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(string(body))),
		}, nil
	})}

	ctx := context.Background()

	if err := client.EnsureWorkspace(ctx); err != nil {
		t.Fatalf("EnsureWorkspace() error = %v", err)
	}
	if err := client.EnsureWorkspace(ctx); err != nil {
		t.Fatalf("EnsureWorkspace() second call error = %v", err)
	}

	if err := client.EnsurePeer(ctx, "alice", map[string]any{"kind": "user"}); err != nil {
		t.Fatalf("EnsurePeer() error = %v", err)
	}
	if err := client.EnsurePeer(ctx, "alice", map[string]any{"kind": "user"}); err != nil {
		t.Fatalf("EnsurePeer() second call error = %v", err)
	}

	if err := client.EnsureSessionWithConfig(ctx, "session-1", map[string]any{"channel": "telegram"}, map[string]SessionPeerConfig{
		"alice": {},
	}, nil); err != nil {
		t.Fatalf("EnsureSessionWithConfig() error = %v", err)
	}
	if err := client.EnsureSessionWithConfig(ctx, "session-1", map[string]any{"channel": "telegram"}, map[string]SessionPeerConfig{
		"alice": {},
	}, nil); err != nil {
		t.Fatalf("EnsureSessionWithConfig() second call error = %v", err)
	}

	if err := client.AddPeersToSessionWithConfig(ctx, "session-1", map[string]SessionPeerConfig{"alice": {}}); err != nil {
		t.Fatalf("AddPeersToSessionWithConfig() error = %v", err)
	}
	if err := client.AddPeersToSessionWithConfig(ctx, "session-1", map[string]SessionPeerConfig{"alice": {}}); err != nil {
		t.Fatalf("AddPeersToSessionWithConfig() second call error = %v", err)
	}

	wantOnce := map[string]int{
		"/v3/workspaces":                               1,
		"/v3/workspaces/ws-1/peers":                    1,
		"/v3/workspaces/ws-1/sessions":                 1,
		"/v3/workspaces/ws-1/sessions/session-1/peers": 1,
	}
	for path, want := range wantOnce {
		if got := callCount[path]; got != want {
			t.Fatalf("callCount[%q] = %d, want %d (all counts: %#v)", path, got, want, callCount)
		}
	}
}
