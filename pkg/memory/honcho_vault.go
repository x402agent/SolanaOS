package memory

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/honcho"
)

// HonchoVault implements the epistemological Vault interface on top of Honcho.
// It keeps lightweight channel→session mappings locally while delegating
// durable cross-session reasoning to Honcho.
type HonchoVault struct {
	client         *honcho.Client
	agentPeerID    string
	reasoningLevel string
	contextTokens  int

	mu       sync.RWMutex
	channels map[string]*ChannelSession
}

// NewHonchoVault creates a Vault backed by the repo's native Honcho client.
func NewHonchoVault(client *honcho.Client, agentPeerID, reasoningLevel string, contextTokens int) *HonchoVault {
	agentPeerID = strings.TrimSpace(agentPeerID)
	if agentPeerID == "" {
		agentPeerID = "solanaos-agent"
	}
	reasoningLevel = strings.TrimSpace(reasoningLevel)
	if reasoningLevel == "" {
		reasoningLevel = "low"
	}
	if contextTokens <= 0 {
		contextTokens = 3000
	}
	return &HonchoVault{
		client:         client,
		agentPeerID:    agentPeerID,
		reasoningLevel: reasoningLevel,
		contextTokens:  contextTokens,
		channels:       make(map[string]*ChannelSession),
	}
}

func channelKey(channelType ChannelType, channelID string) string {
	return fmt.Sprintf("%s:%s", channelType, channelID)
}

func boolPtr(v bool) *bool {
	return &v
}

// EnsureSession creates or retrieves a Honcho session for a control surface.
func (v *HonchoVault) EnsureSession(ctx context.Context, channelType ChannelType, channelID, userPeerID string) (*ChannelSession, error) {
	if v == nil || v.client == nil {
		return nil, fmt.Errorf("honcho vault is not configured")
	}

	channelID = strings.TrimSpace(channelID)
	userPeerID = strings.TrimSpace(userPeerID)
	if channelID == "" {
		channelID = "default"
	}
	if userPeerID == "" {
		userPeerID = "operator"
	}

	key := channelKey(channelType, channelID)

	v.mu.RLock()
	if cs, ok := v.channels[key]; ok {
		v.mu.RUnlock()
		return cs, nil
	}
	v.mu.RUnlock()

	v.mu.Lock()
	defer v.mu.Unlock()

	if cs, ok := v.channels[key]; ok {
		return cs, nil
	}

	sessionID := fmt.Sprintf("%s-%s", channelType, channelID)
	metadata := map[string]any{
		"channel_type": string(channelType),
		"channel_id":   channelID,
		"created_by":   "solanaos",
	}

	if err := v.client.EnsurePeerWithConfig(ctx, userPeerID, map[string]any{
		"channel_type": string(channelType),
		"channel_id":   channelID,
	}, map[string]any{
		"observe_me": true,
	}); err != nil {
		return nil, fmt.Errorf("ensure user peer: %w", err)
	}

	if err := v.client.EnsurePeerWithConfig(ctx, v.agentPeerID, map[string]any{
		"role": "agent",
	}, map[string]any{
		"observe_me": false,
	}); err != nil {
		return nil, fmt.Errorf("ensure agent peer: %w", err)
	}

	if err := v.client.EnsureSessionWithConfig(ctx, sessionID, metadata, map[string]honcho.SessionPeerConfig{
		userPeerID: {
			ObserveMe:     boolPtr(true),
			ObserveOthers: boolPtr(false),
		},
		v.agentPeerID: {
			ObserveMe:     boolPtr(false),
			ObserveOthers: boolPtr(true),
		},
	}, nil); err != nil {
		return nil, fmt.Errorf("ensure session: %w", err)
	}

	cs := &ChannelSession{
		SessionID:   sessionID,
		ChannelType: channelType,
		ChannelID:   channelID,
		PeerID:      userPeerID,
		CreatedAt:   time.Now().UTC(),
	}
	v.channels[key] = cs
	return cs, nil
}

// StoreUserMessage persists a user turn to Honcho.
func (v *HonchoVault) StoreUserMessage(ctx context.Context, session *ChannelSession, content string, metadata map[string]any) error {
	if v == nil || v.client == nil || session == nil {
		return nil
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}
	return v.client.AddMessages(ctx, session.SessionID, []honcho.MessageCreate{
		{
			PeerID:    session.PeerID,
			Content:   content,
			Metadata:  metadata,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		},
	})
}

// StoreAgentMessage persists an agent turn to Honcho.
func (v *HonchoVault) StoreAgentMessage(ctx context.Context, session *ChannelSession, content string, metadata map[string]any) error {
	if v == nil || v.client == nil || session == nil {
		return nil
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}
	return v.client.AddMessages(ctx, session.SessionID, []honcho.MessageCreate{
		{
			PeerID:    v.agentPeerID,
			Content:   content,
			Metadata:  metadata,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		},
	})
}

// StoreTradingEvent persists a structured trading event into the current session.
func (v *HonchoVault) StoreTradingEvent(ctx context.Context, session *ChannelSession, content string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadata["event_type"] = "trading"
	metadata["timestamp"] = time.Now().UTC().Format(time.RFC3339)
	if !strings.HasPrefix(content, "[TRADE]") {
		content = "[TRADE] " + strings.TrimSpace(content)
	}
	return v.StoreUserMessage(ctx, session, content, metadata)
}

// Recall asks Honcho what the SolanaOS agent knows about a peer.
func (v *HonchoVault) Recall(ctx context.Context, peerID, query string) (string, error) {
	if v == nil || v.client == nil {
		return "", fmt.Errorf("honcho vault is not configured")
	}
	peerID = strings.TrimSpace(peerID)
	query = strings.TrimSpace(query)
	if peerID == "" {
		peerID = "operator"
	}
	if query == "" {
		return "", nil
	}
	return v.client.PeerChat(ctx, v.agentPeerID, query, peerID, "")
}

// GetContext returns formatted session context for prompt injection or CLI display.
func (v *HonchoVault) GetContext(ctx context.Context, session *ChannelSession, query string) (string, error) {
	if v == nil || v.client == nil || session == nil {
		return "", fmt.Errorf("honcho vault is not configured")
	}
	resp, err := v.client.SessionContext(ctx, session.SessionID, v.agentPeerID, session.PeerID, strings.TrimSpace(query))
	if err != nil {
		return "", err
	}
	return formatSessionContext(resp), nil
}

// GetTradingContext returns a context string biased toward trading decisions.
func (v *HonchoVault) GetTradingContext(ctx context.Context, session *ChannelSession, symbol string) (string, error) {
	query := "trading preferences risk tolerance position sizing strategy"
	symbol = strings.TrimSpace(symbol)
	if symbol != "" {
		query += " " + symbol
	}
	return v.GetContext(ctx, session, query)
}

// GetOperatorProfile synthesizes a compact operator profile from Honcho recall.
func (v *HonchoVault) GetOperatorProfile(ctx context.Context, peerID string) (string, error) {
	if v == nil || v.client == nil {
		return "", fmt.Errorf("honcho vault is not configured")
	}
	peerID = strings.TrimSpace(peerID)
	if peerID == "" {
		peerID = "operator"
	}

	risk, err := v.Recall(ctx, peerID, "What are this operator's risk preferences and position sizing habits?")
	if err != nil {
		return "", err
	}
	style, err := v.Recall(ctx, peerID, "What trading strategies and behaviors does this operator prefer?")
	if err != nil {
		return "", err
	}
	recent, err := v.Recall(ctx, peerID, "What has this operator been researching or trading recently?")
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(fmt.Sprintf(
		"Peer: %s\n\nRisk Preference:\n%s\n\nTrading Style:\n%s\n\nRecent Activity:\n%s",
		peerID,
		strings.TrimSpace(risk),
		strings.TrimSpace(style),
		strings.TrimSpace(recent),
	)), nil
}

func formatSessionContext(resp *honcho.SessionContext) string {
	if resp == nil {
		return ""
	}

	var b strings.Builder

	if resp.Summary != nil && strings.TrimSpace(resp.Summary.Content) != "" {
		b.WriteString("Summary:\n")
		b.WriteString(strings.TrimSpace(resp.Summary.Content))
		b.WriteString("\n\n")
	}

	if strings.TrimSpace(resp.PeerRepresentation) != "" {
		b.WriteString("Peer Representation:\n")
		b.WriteString(strings.TrimSpace(resp.PeerRepresentation))
		b.WriteString("\n\n")
	}

	if len(resp.PeerCard) > 0 {
		b.WriteString("Peer Card:\n")
		for _, fact := range resp.PeerCard {
			fact = strings.TrimSpace(fact)
			if fact == "" {
				continue
			}
			b.WriteString("- ")
			b.WriteString(fact)
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	if len(resp.Messages) > 0 {
		b.WriteString("Messages:\n")
		start := 0
		if len(resp.Messages) > 12 {
			start = len(resp.Messages) - 12
		}
		for _, msg := range resp.Messages[start:] {
			role := "peer"
			if msg.PeerID != "" {
				role = msg.PeerID
			}
			b.WriteString("- ")
			b.WriteString(role)
			b.WriteString(": ")
			b.WriteString(strings.TrimSpace(msg.Content))
			b.WriteString("\n")
		}
	}

	return strings.TrimSpace(b.String())
}
