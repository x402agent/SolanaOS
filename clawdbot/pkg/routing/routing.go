// Package routing resolves message routing for ClawdBot multi-agent setups.
// ClawdBot Go routing — route inputs to specific agents by channel/peer.
package routing

import "fmt"

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
	return fmt.Sprintf("%s:%s:%s", agentID, channel, peer)
}

func BuildAgentMainSessionKey(agentID string) string {
	return "agent:" + agentID + ":main"
}
