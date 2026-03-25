// Package memory — epistemological.go defines the shared types and interfaces
// for the epistemological memory vault integration.
//
// This bridges the trading engine and blockchain queries packages
// that expect a Vault interface for memory persistence.
package memory

import (
	"context"
	"time"
)

// ChannelType identifies the control surface.
type ChannelType string

const (
	ChannelTelegram ChannelType = "telegram"
	ChannelGateway  ChannelType = "gateway"
	ChannelSeeker   ChannelType = "seeker"
	ChannelWeb      ChannelType = "web"
	ChannelCLI      ChannelType = "cli"
)

// ChannelSession tracks an active conversation session in Honcho.
type ChannelSession struct {
	SessionID string
	ChannelType ChannelType
	ChannelID string
	PeerID    string
	CreatedAt time.Time
}

// TradingEvent represents a trade action to persist to memory.
type TradingEvent struct {
	Exchange    string    `json:"exchange"`
	Action      string    `json:"action"` // "order", "close", "liquidation"
	Symbol      string    `json:"symbol"`
	Side        string    `json:"side"` // "long", "short"
	Size        float64   `json:"size"`
	Price       float64   `json:"price"`
	Leverage    float64   `json:"leverage"`
	StopLoss    float64   `json:"stop_loss,omitempty"`
	TakeProfit  float64   `json:"take_profit,omitempty"`
	PnL         float64   `json:"pnl,omitempty"`
	Status      string    `json:"status"` // "success", "failed"
	Error       string    `json:"error,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// Vault is the interface for the epistemological memory system.
// Trading engines and blockchain queries use this to persist events
// to Honcho for cross-session reasoning.
type Vault interface {
	// EnsureSession creates or retrieves a channel session.
	EnsureSession(ctx context.Context, channelType ChannelType, channelID, userPeerID string) (*ChannelSession, error)

	// StoreUserMessage persists a user message.
	StoreUserMessage(ctx context.Context, session *ChannelSession, content string, metadata map[string]any) error

	// StoreAgentMessage persists an agent message.
	StoreAgentMessage(ctx context.Context, session *ChannelSession, content string, metadata map[string]any) error

	// StoreTradingEvent persists a trading action to memory.
	// Accepts either a structured TradingEvent or raw content + metadata.
	StoreTradingEvent(ctx context.Context, session *ChannelSession, content string, metadata map[string]any) error

	// Recall queries memory in natural language.
	Recall(ctx context.Context, peerID, query string) (string, error)

	// GetContext returns formatted context for LLM injection.
	GetContext(ctx context.Context, session *ChannelSession, query string) (string, error)

	// GetTradingContext returns enriched context for trading decisions.
	GetTradingContext(ctx context.Context, session *ChannelSession, symbol string) (string, error)

	// GetOperatorProfile returns a synthesized operator profile.
	GetOperatorProfile(ctx context.Context, peerID string) (string, error)
}

// NoopVault is a no-op implementation for when Honcho is disabled.
type NoopVault struct{}

func (NoopVault) EnsureSession(_ context.Context, _ ChannelType, _ string, _ string) (*ChannelSession, error) {
	return &ChannelSession{SessionID: "noop"}, nil
}
func (NoopVault) StoreUserMessage(_ context.Context, _ *ChannelSession, _ string, _ map[string]any) error {
	return nil
}
func (NoopVault) StoreAgentMessage(_ context.Context, _ *ChannelSession, _ string, _ map[string]any) error {
	return nil
}
func (NoopVault) StoreTradingEvent(_ context.Context, _ *ChannelSession, _ string, _ map[string]any) error {
	return nil
}
func (NoopVault) Recall(_ context.Context, _, _ string) (string, error) { return "", nil }
func (NoopVault) GetContext(_ context.Context, _ *ChannelSession, _ string) (string, error) {
	return "", nil
}
func (NoopVault) GetTradingContext(_ context.Context, _ *ChannelSession, _ string) (string, error) {
	return "", nil
}
func (NoopVault) GetOperatorProfile(_ context.Context, _ string) (string, error) { return "", nil }
