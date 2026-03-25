// Package routing resolves message routing and session key handling for
// MawdBot multi-agent setups.
package routing

import (
	"fmt"
	"strings"
)

const (
	DefaultAgentID = "default"
	DefaultMainKey = "main"
)

type RouteInput struct {
	Channel    string
	AccountID  string
	Peer       string
	ParentPeer string
	GuildID    string
	TeamID     string
}

type ResolvedRoute struct {
	AgentID    string
	SessionKey string
	Channel    string
	MatchedBy  string // "channel", "peer", "default"
}

type RouteRule struct {
	AgentID  string
	Channel  string
	PeerKind string
	PeerID   string
}

type Router struct {
	rules    []RouteRule
	fallback string
}

func NewRouter(fallbackAgentID string) *Router {
	return &Router{fallback: fallbackAgentID}
}

func (r *Router) AddRule(rule RouteRule) {
	r.rules = append(r.rules, rule)
}

func (r *Router) Resolve(input RouteInput) ResolvedRoute {
	for _, rule := range r.rules {
		if rule.Channel != "" && rule.Channel == input.Channel {
			return ResolvedRoute{
				AgentID:    rule.AgentID,
				SessionKey: BuildSessionKey(rule.AgentID, input.Channel, input.Peer),
				Channel:    input.Channel,
				MatchedBy:  "channel",
			}
		}
	}

	return ResolvedRoute{
		AgentID:    r.fallback,
		SessionKey: BuildSessionKey(r.fallback, input.Channel, input.Peer),
		Channel:    input.Channel,
		MatchedBy:  "default",
	}
}

func BuildSessionKey(agentID, channel, peer string) string {
	parts := []string{}
	if strings.TrimSpace(agentID) != "" {
		parts = append(parts, agentID)
	}
	if strings.TrimSpace(channel) != "" {
		parts = append(parts, channel)
	}
	if strings.TrimSpace(peer) != "" {
		parts = append(parts, peer)
	}
	if len(parts) == 0 {
		return DefaultMainKey
	}
	return strings.Join(parts, ":")
}

func BuildAgentMainSessionKey(agentID string) string {
	agentID = strings.TrimSpace(agentID)
	if agentID == "" {
		agentID = DefaultAgentID
	}
	return fmt.Sprintf("%s:%s", agentID, DefaultMainKey)
}

type SessionKeyParts struct {
	AgentID string
	Kind    string
	Label   string
}

func ParseSessionKey(key string) SessionKeyParts {
	key = strings.TrimSpace(key)
	if key == "" {
		return SessionKeyParts{Kind: "chat", Label: DefaultMainKey}
	}
	parts := strings.Split(key, ":")
	switch len(parts) {
	case 1:
		return SessionKeyParts{Kind: "chat", Label: parts[0]}
	case 2:
		return SessionKeyParts{AgentID: parts[0], Kind: "chat", Label: parts[1]}
	default:
		return SessionKeyParts{
			AgentID: parts[0],
			Kind:    parts[1],
			Label:   strings.Join(parts[2:], ":"),
		}
	}
}

func BuildSessionKeyParts(parts SessionKeyParts) string {
	kind := strings.TrimSpace(parts.Kind)
	if kind == "" {
		kind = "chat"
	}
	label := strings.TrimSpace(parts.Label)
	if label == "" {
		label = DefaultMainKey
	}
	if strings.TrimSpace(parts.AgentID) == "" {
		return fmt.Sprintf("%s:%s", kind, label)
	}
	return fmt.Sprintf("%s:%s:%s", parts.AgentID, kind, label)
}

func ParseAgentSessionKey(key string) (agentID string, sessionKey string) {
	parts := strings.SplitN(strings.TrimSpace(key), ":", 2)
	if len(parts) < 2 {
		return "", strings.TrimSpace(key)
	}
	return parts[0], parts[1]
}

func FormatSessionKey(key string) string {
	parts := ParseSessionKey(key)
	if parts.AgentID == "" {
		return fmt.Sprintf("%s/%s", parts.Kind, parts.Label)
	}
	return fmt.Sprintf("%s/%s/%s", parts.AgentID, parts.Kind, parts.Label)
}

func IsSubagentSessionKey(key string) bool {
	parts := ParseSessionKey(key)
	return parts.AgentID != "" && parts.AgentID != DefaultAgentID
}
