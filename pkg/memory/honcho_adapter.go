// Package memory — honcho_adapter.go provides a bridge between the main binary's
// pkg/honcho.Client and the epistemological Vault interface used by the runtime.
//
// The memory vault expects helper methods like GetOrCreatePeer and
// GetOrCreateSession, while the main honcho.Client exposes EnsurePeer and
// EnsureSession. This adapter bridges that gap.
package memory

import (
	"context"

	"github.com/x402agent/Solana-Os-Go/pkg/honcho"
)

// HonchoAdapter wraps the main binary's honcho.Client to match the interface
// expected by the epistemological memory vault.
type HonchoAdapter struct {
	client *honcho.Client
}

// NewHonchoAdapter creates an adapter around the existing honcho client.
func NewHonchoAdapter(client *honcho.Client) *HonchoAdapter {
	return &HonchoAdapter{client: client}
}

// GetOrCreateSession wraps EnsureSession.
func (a *HonchoAdapter) GetOrCreateSession(ctx context.Context, sessionID string, metadata map[string]any) (string, error) {
	return sessionID, a.client.EnsureSession(ctx, sessionID, nil)
}

// GetOrCreatePeer wraps EnsurePeer.
func (a *HonchoAdapter) GetOrCreatePeer(ctx context.Context, peerID string, observed bool) error {
	meta := map[string]any{"observe_me": observed}
	return a.client.EnsurePeer(ctx, peerID, meta)
}

// AddMessages wraps the client's AddMessages.
func (a *HonchoAdapter) AddMessages(ctx context.Context, sessionID string, messages []honcho.MessageCreate) error {
	return a.client.AddMessages(ctx, sessionID, messages)
}

// PeerChat wraps the client's PeerChat.
func (a *HonchoAdapter) PeerChat(ctx context.Context, peerID, query, target, sessionID string) (string, error) {
	return a.client.PeerChat(ctx, peerID, query, target, sessionID)
}

// SessionContext wraps the client's SessionContext.
func (a *HonchoAdapter) SessionContext(ctx context.Context, sessionID, agentPeer, userPeer, query string) (*honcho.SessionContext, error) {
	return a.client.SessionContext(ctx, sessionID, agentPeer, userPeer, query)
}

// PeerContext wraps the client's PeerContext.
func (a *HonchoAdapter) PeerContext(ctx context.Context, agentPeer, userPeer, query string) (*honcho.PeerContext, error) {
	return a.client.PeerContext(ctx, agentPeer, userPeer, query)
}

// QueryConclusions wraps the client's QueryConclusions.
func (a *HonchoAdapter) QueryConclusions(ctx context.Context, query string, topK int, distance *float64, filters map[string]any) ([]honcho.Conclusion, error) {
	return a.client.QueryConclusions(ctx, query, topK, distance, filters)
}

// CreateConclusions wraps the client's CreateConclusions.
func (a *HonchoAdapter) CreateConclusions(ctx context.Context, conclusions []honcho.ConclusionCreate) ([]honcho.Conclusion, error) {
	return a.client.CreateConclusions(ctx, conclusions)
}

// AgentPeerID returns the configured agent peer ID.
func (a *HonchoAdapter) AgentPeerID() string {
	return a.client.AgentPeerID()
}

// WorkspaceID returns the configured workspace.
func (a *HonchoAdapter) WorkspaceID() string {
	return a.client.WorkspaceID()
}
