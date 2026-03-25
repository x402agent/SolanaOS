package daemon

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/honcho"
)

func (d *Daemon) honchoSessionsResponse(args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	page := parseTrackerIntArg(args, 0, 1)
	size := parseTrackerIntArg(args, 1, 5)

	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	sessions, err := d.honcho.ListSessions(ctx, page, size, nil)
	if err != nil {
		return "⚠️ Honcho sessions lookup failed: " + err.Error()
	}
	if sessions == nil || len(sessions.Items) == 0 {
		return "🧠 No Honcho sessions found."
	}

	var b strings.Builder
	b.WriteString("🧠 **Honcho Sessions**\n\n")
	for _, item := range sessions.Items {
		sessionType, _ := item.Metadata["session_type"].(string)
		channel, _ := item.Metadata["channel"].(string)
		if sessionType == "" {
			sessionType = "unknown"
		}
		if channel == "" {
			channel = "-"
		}
		b.WriteString(fmt.Sprintf("- `%s` · %s · %s · active=%t\n", item.ID, sessionType, channel, item.IsActive))
	}
	b.WriteString(fmt.Sprintf("\nPage %d/%d · total=%d", sessions.Page, sessions.Pages, sessions.Total))
	return strings.TrimSpace(b.String())
}

func (d *Daemon) honchoRecallResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	query := strings.TrimSpace(strings.Join(args, " "))
	if query == "" {
		return "Usage: /recall <question about your saved memory>"
	}

	ctx, cancel := context.WithTimeout(d.ctx, 8*time.Second)
	defer cancel()

	sessionID := d.messageSessionKey(msg)
	userID := d.honchoUserPeerID(msg)
	agentID := d.honcho.AgentPeerID()

	answer, err := d.honcho.PeerChat(ctx, agentID, query, userID, sessionID)
	if err != nil {
		return "⚠️ Honcho recall failed: " + err.Error()
	}
	answer = strings.TrimSpace(answer)
	if answer == "" {
		return "🧠 Honcho has no recall answer for that yet."
	}

	return strings.TrimSpace("🧠 **Recall**\n\n" + truncate(answer, 1500))
}

func (d *Daemon) honchoMemoryResponse(msg bus.InboundMessage, args []string) string {
	if len(args) == 0 {
		return d.memoryResponse(msg)
	}
	return d.recallResponse(msg, args)
}

func (d *Daemon) honchoSessionDetailResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}

	sessionID := d.messageSessionKey(msg)
	if len(args) > 0 && strings.TrimSpace(args[0]) != "" {
		sessionID = strings.TrimSpace(args[0])
	}

	ctx, cancel := context.WithTimeout(d.ctx, 8*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	agentID := d.honcho.AgentPeerID()

	var sections []string
	var header strings.Builder
	header.WriteString("🧠 **Honcho Session Recall**\n\n")
	header.WriteString("Session: `" + sessionID + "`\n")
	header.WriteString("User peer: `" + userID + "`\n")
	header.WriteString("Agent peer: `" + agentID + "`")
	sections = append(sections, header.String())

	if sessionCtx, err := d.honcho.SessionContext(ctx, sessionID, agentID, userID, ""); err == nil && sessionCtx != nil {
		var b strings.Builder
		b.WriteString("🧠 **Session Context**\n\n")
		if sessionCtx.Summary != nil && strings.TrimSpace(sessionCtx.Summary.Content) != "" {
			b.WriteString("Summary: " + truncate(strings.TrimSpace(sessionCtx.Summary.Content), 400) + "\n")
		}
		if strings.TrimSpace(sessionCtx.PeerRepresentation) != "" {
			b.WriteString("Representation: " + truncate(strings.TrimSpace(sessionCtx.PeerRepresentation), 500) + "\n")
		}
		if len(sessionCtx.PeerCard) > 0 {
			b.WriteString("Peer card: " + truncate(strings.Join(sessionCtx.PeerCard, " | "), 400) + "\n")
		}
		if len(sessionCtx.Messages) > 0 {
			limit := len(sessionCtx.Messages)
			if limit > 6 {
				limit = 6
			}
			b.WriteString("\nRecent messages:\n")
			for _, item := range sessionCtx.Messages[:limit] {
				b.WriteString(fmt.Sprintf("- `%s` %s\n", item.PeerID, truncate(strings.TrimSpace(item.Content), 140)))
			}
		}
		sections = append(sections, strings.TrimSpace(b.String()))
	} else if err != nil {
		sections = append(sections, "⚠️ Session context lookup failed: "+err.Error())
	}

	if summaries, err := d.honcho.SessionSummaries(ctx, sessionID); err == nil && summaries != nil {
		var b strings.Builder
		b.WriteString("🧠 **Session Summaries**\n\n")
		wrote := false
		if summaries.ShortSummary != nil && strings.TrimSpace(summaries.ShortSummary.Content) != "" {
			b.WriteString("Short: " + truncate(strings.TrimSpace(summaries.ShortSummary.Content), 280) + "\n")
			wrote = true
		}
		if summaries.LongSummary != nil && strings.TrimSpace(summaries.LongSummary.Content) != "" {
			b.WriteString("Long: " + truncate(strings.TrimSpace(summaries.LongSummary.Content), 280) + "\n")
			wrote = true
		}
		if wrote {
			sections = append(sections, strings.TrimSpace(b.String()))
		}
	} else if err != nil {
		sections = append(sections, "⚠️ Session summaries lookup failed: "+err.Error())
	}

	if messages, err := d.honcho.ListMessages(ctx, sessionID, 1, 8, true, nil); err == nil && messages != nil && len(messages.Items) > 0 {
		var b strings.Builder
		b.WriteString("🧠 **Session Messages**\n\n")
		for _, item := range messages.Items {
			b.WriteString(fmt.Sprintf("- `%s` `%s` %s\n", item.ID, item.PeerID, truncate(strings.TrimSpace(item.Content), 120)))
		}
		sections = append(sections, strings.TrimSpace(b.String()))
	} else if err != nil {
		sections = append(sections, "⚠️ Session messages lookup failed: "+err.Error())
	}

	return strings.TrimSpace(strings.Join(sections, "\n\n"))
}

func (d *Daemon) honchoSummariesResponse(msg bus.InboundMessage) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	sessionID := d.messageSessionKey(msg)
	summaries, err := d.honcho.SessionSummaries(ctx, sessionID)
	if err != nil {
		return "⚠️ Honcho summaries lookup failed: " + err.Error()
	}
	if summaries == nil || (summaries.ShortSummary == nil && summaries.LongSummary == nil) {
		return "🧠 No Honcho summaries are available for this session yet."
	}

	var b strings.Builder
	b.WriteString("🧠 **Honcho Summaries**\n\n")
	if summaries.ShortSummary != nil && strings.TrimSpace(summaries.ShortSummary.Content) != "" {
		b.WriteString("Short:\n")
		b.WriteString(truncate(strings.TrimSpace(summaries.ShortSummary.Content), 500))
		b.WriteString("\n\n")
	}
	if summaries.LongSummary != nil && strings.TrimSpace(summaries.LongSummary.Content) != "" {
		b.WriteString("Long:\n")
		b.WriteString(truncate(strings.TrimSpace(summaries.LongSummary.Content), 900))
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) honchoSearchResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	query := strings.TrimSpace(strings.Join(args, " "))
	if query == "" {
		return "Usage: /honcho_search <query>"
	}

	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	results, err := d.honcho.SearchSession(ctx, d.messageSessionKey(msg), query, nil, 6)
	if err != nil {
		return "⚠️ Honcho session search failed: " + err.Error()
	}
	if len(results) == 0 {
		return "🧠 No matching Honcho session messages found."
	}

	var b strings.Builder
	b.WriteString("🧠 **Honcho Session Search**\n\n")
	for _, item := range results {
		b.WriteString(fmt.Sprintf("- `%s` %s\n", item.PeerID, truncate(strings.TrimSpace(item.Content), 180)))
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) honchoMessagesResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	page := parseTrackerIntArg(args, 0, 1)
	size := parseTrackerIntArg(args, 1, 10)

	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	results, err := d.honcho.ListMessages(ctx, d.messageSessionKey(msg), page, size, true, nil)
	if err != nil {
		return "⚠️ Honcho messages lookup failed: " + err.Error()
	}
	if results == nil || len(results.Items) == 0 {
		return "🧠 No Honcho messages are available for this session yet."
	}

	var b strings.Builder
	b.WriteString("🧠 **Honcho Messages**\n\n")
	for _, item := range results.Items {
		b.WriteString(fmt.Sprintf("- `%s` `%s` %s\n", item.ID, item.PeerID, truncate(strings.TrimSpace(item.Content), 140)))
	}
	b.WriteString(fmt.Sprintf("\nPage %d/%d · total=%d", results.Page, results.Pages, results.Total))
	return strings.TrimSpace(b.String())
}

func (d *Daemon) honchoMessageResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	if len(args) == 0 || strings.TrimSpace(args[0]) == "" {
		return "Usage: /honcho_message <message_id>"
	}

	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	item, err := d.honcho.GetMessage(ctx, d.messageSessionKey(msg), strings.TrimSpace(args[0]))
	if err != nil {
		return "⚠️ Honcho message lookup failed: " + err.Error()
	}
	if item == nil {
		return "🧠 Honcho message not found."
	}

	var b strings.Builder
	b.WriteString("🧠 **Honcho Message**\n\n")
	b.WriteString(fmt.Sprintf("ID: `%s`\nPeer: `%s`\nCreated: `%s`\n\n%s", item.ID, item.PeerID, item.CreatedAt, strings.TrimSpace(item.Content)))
	return strings.TrimSpace(b.String())
}

func (d *Daemon) honchoConclusionsResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho bridge is disabled."
	}
	query := strings.TrimSpace(strings.Join(args, " "))
	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	var (
		items []honcho.Conclusion
		err   error
	)
	if query != "" {
		items, err = d.honcho.QueryConclusions(ctx, query, 8, nil, map[string]any{"observed_id": userID})
	} else {
		page, listErr := d.honcho.ListConclusions(ctx, 1, 8, true, map[string]any{"observed_id": userID})
		if listErr != nil {
			err = listErr
		} else if page != nil {
			items = page.Items
		}
	}
	if err != nil {
		return "⚠️ Honcho conclusions lookup failed: " + err.Error()
	}
	if len(items) == 0 {
		return "🧠 No Honcho conclusions are available for this user yet."
	}

	var b strings.Builder
	b.WriteString("🧠 **Honcho Trading Conclusions**\n\n")
	for _, item := range items {
		b.WriteString(fmt.Sprintf("- %s\n", truncate(strings.TrimSpace(item.Content), 220)))
	}
	return strings.TrimSpace(b.String())
}

// ── User-Friendly Memory Commands ─────────────────────────────────

func (d *Daemon) memoryResponse(msg bus.InboundMessage) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho memory is not enabled. Set `HONCHO_ENABLED=true` and `HONCHO_API_KEY` in .env."
	}
	ctx, cancel := context.WithTimeout(d.ctx, 8*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	agentID := d.honcho.AgentPeerID()

	var sections []string

	// Peer card + representation
	if peerCtx, err := d.honcho.PeerContext(ctx, agentID, userID, ""); err == nil && peerCtx != nil {
		if len(peerCtx.PeerCard) > 0 {
			var b strings.Builder
			b.WriteString("📇 **Your Profile**\n")
			for _, line := range peerCtx.PeerCard {
				b.WriteString("  " + strings.TrimSpace(line) + "\n")
			}
			sections = append(sections, strings.TrimSpace(b.String()))
		}
		if strings.TrimSpace(peerCtx.Representation) != "" {
			sections = append(sections, "🧬 **What I Know About You**\n"+truncate(strings.TrimSpace(peerCtx.Representation), 600))
		}
	}

	// Recent conclusions
	conclusions, err := d.honcho.ListConclusions(ctx, 1, 6, true, map[string]any{"observed_id": userID})
	if err == nil && conclusions != nil && len(conclusions.Items) > 0 {
		var b strings.Builder
		b.WriteString("💡 **Key Insights**\n")
		for _, item := range conclusions.Items {
			if text := strings.TrimSpace(item.Content); text != "" {
				b.WriteString("• " + truncate(text, 180) + "\n")
			}
		}
		sections = append(sections, strings.TrimSpace(b.String()))
	}

	// Session count
	sessions, err := d.honcho.ListSessions(ctx, 1, 1, nil)
	if err == nil && sessions != nil {
		sections = append(sections, fmt.Sprintf("📊 Total sessions: %d", sessions.Total))
	}

	if len(sections) == 0 {
		return "🧠 I don't have any memories about you yet. Keep chatting and I'll learn your preferences, trading style, and interests over time."
	}
	return strings.Join(sections, "\n\n")
}

func (d *Daemon) recallResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho memory is not enabled."
	}
	query := strings.TrimSpace(strings.Join(args, " "))
	if query == "" {
		return "Usage: `/recall <what you want to remember>`\n\nExamples:\n• `/recall what tokens am I watching`\n• `/recall my risk tolerance`\n• `/recall last trading strategy we discussed`"
	}

	ctx, cancel := context.WithTimeout(d.ctx, 8*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	agentID := d.honcho.AgentPeerID()
	sessionID := d.honchoSafeID(d.messageSessionKey(msg), "session")

	// Use Honcho's PeerChat — the AI-powered memory query endpoint
	answer, err := d.honcho.PeerChat(ctx, agentID, query, userID, sessionID)
	if err != nil {
		// Fallback to conclusion search
		conclusions, cErr := d.honcho.QueryConclusions(ctx, query, 5, nil, map[string]any{"observed_id": userID})
		if cErr != nil || len(conclusions) == 0 {
			return "🧠 I couldn't find any relevant memories for: *" + query + "*\n\nKeep chatting and I'll build up context over time."
		}
		var b strings.Builder
		b.WriteString("🧠 **Memory Recall:** " + query + "\n\n")
		for _, item := range conclusions {
			if text := strings.TrimSpace(item.Content); text != "" {
				b.WriteString("• " + truncate(text, 220) + "\n")
			}
		}
		return strings.TrimSpace(b.String())
	}

	return "🧠 **Memory Recall:** " + query + "\n\n" + strings.TrimSpace(answer)
}

func (d *Daemon) rememberResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho memory is not enabled."
	}
	content := strings.TrimSpace(strings.Join(args, " "))
	if content == "" {
		return "Usage: `/remember <something to remember>`\n\nExamples:\n• `/remember I prefer spot only, no perps`\n• `/remember my risk tolerance is conservative`\n• `/remember always check holder distribution before buying`"
	}

	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	agentID := d.honchoSafeID(d.honcho.AgentPeerID(), "solanaos-agent")
	sessionID := d.honchoSafeID(d.messageSessionKey(msg), "session")

	conclusions := []honcho.ConclusionCreate{{
		Content:    content,
		ObserverID: agentID,
		ObservedID: userID,
		SessionID:  sessionID,
	}}

	created, err := d.honcho.CreateConclusions(ctx, conclusions)
	if err != nil {
		return "⚠️ Failed to save memory: " + err.Error()
	}
	if len(created) == 0 {
		return "⚠️ Memory was not saved."
	}

	return "✅ **Remembered:** " + truncate(content, 200) + "\n\nThis will be used to personalize future responses."
}

func (d *Daemon) askMemoryResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho memory is not enabled."
	}
	question := strings.TrimSpace(strings.Join(args, " "))
	if question == "" {
		return "Usage: `/ask_memory <question about yourself>`\n\nExamples:\n• `/ask_memory what is my trading style`\n• `/ask_memory what tokens have I been interested in`\n• `/ask_memory am I risk averse or aggressive`"
	}

	ctx, cancel := context.WithTimeout(d.ctx, 10*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	agentID := d.honcho.AgentPeerID()
	sessionID := d.honchoSafeID(d.messageSessionKey(msg), "session")

	answer, err := d.honcho.PeerChat(ctx, agentID, question, userID, sessionID)
	if err != nil {
		return "⚠️ Memory query failed: " + err.Error()
	}
	if strings.TrimSpace(answer) == "" {
		return "🧠 I don't have enough context to answer that yet. Keep chatting — I learn from every interaction."
	}

	return "🧠 " + strings.TrimSpace(answer)
}

func (d *Daemon) forgetResponse(msg bus.InboundMessage, args []string) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "🧠 Honcho memory is not enabled."
	}
	query := strings.TrimSpace(strings.Join(args, " "))
	if query == "" {
		return "Usage: `/forget <what to forget>`\n\nThis searches your memories and deletes matching conclusions."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	userID := d.honchoUserPeerID(msg)
	conclusions, err := d.honcho.QueryConclusions(ctx, query, 3, nil, map[string]any{"observed_id": userID})
	if err != nil || len(conclusions) == 0 {
		return "🧠 No matching memories found for: *" + query + "*"
	}

	deleted := 0
	for _, c := range conclusions {
		if err := d.honcho.DeleteConclusion(ctx, c.ID); err == nil {
			deleted++
		}
	}

	if deleted == 0 {
		return "⚠️ Found memories but couldn't delete them."
	}
	return fmt.Sprintf("🗑️ **Forgotten:** Removed %d memory/memories matching: *%s*", deleted, query)
}

// dreamResponse triggers Honcho memory consolidation for the operator peer.
// Trigger a Honcho consolidation pass for the active operator peer.
func (d *Daemon) dreamResponse(msg bus.InboundMessage) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "Honcho memory is not enabled."
	}
	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()
	userID := d.honchoUserPeerID(msg)
	err := d.honcho.ScheduleDream(ctx, userID, userID)
	if err != nil {
		return fmt.Sprintf("Dream error: %v", err)
	}
	return "💤 Dream scheduled. Honcho will consolidate and refine your memory representation."
}

// profileResponse returns a synthesized operator profile from Honcho.
// Summarize the operator profile using Honcho peer context.
func (d *Daemon) profileResponse(msg bus.InboundMessage) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "Honcho memory is not enabled."
	}
	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()
	userID := d.honchoUserPeerID(msg)
	agentPeer := d.honcho.AgentPeerID()

	var sections []string

	// Peer card
	if peerCtx, err := d.honcho.PeerContext(ctx, agentPeer, userID, ""); err == nil && peerCtx != nil {
		if len(peerCtx.PeerCard) > 0 {
			sections = append(sections, "🪪 Identity: "+strings.Join(peerCtx.PeerCard, " | "))
		}
		if strings.TrimSpace(peerCtx.Representation) != "" {
			sections = append(sections, "🧠 Representation:\n"+truncate(peerCtx.Representation, 400))
		}
	}

	// Dialectic — ask what Honcho knows about the operator
	if profile, err := d.honcho.PeerChat(ctx, agentPeer,
		"Summarize this user's trading style, risk preferences, recent interests, and any notable patterns you've observed.",
		userID, ""); err == nil && strings.TrimSpace(profile) != "" {
		sections = append(sections, "📊 Profile:\n"+truncate(profile, 500))
	}

	if len(sections) == 0 {
		return "👤 No operator profile yet. Chat more to build your profile."
	}
	return "👤 Operator Profile\n\n" + strings.Join(sections, "\n\n")
}

// cardResponse returns the peer card (biographical facts) from Honcho.
// Render the Honcho peer card as a concise operator fact sheet.
func (d *Daemon) cardResponse(msg bus.InboundMessage) string {
	if d.honcho == nil || !d.cfg.Honcho.Enabled {
		return "Honcho memory is not enabled."
	}
	ctx, cancel := context.WithTimeout(d.ctx, 3*time.Second)
	defer cancel()
	userID := d.honchoUserPeerID(msg)
	agentPeer := d.honcho.AgentPeerID()

	peerCtx, err := d.honcho.PeerContext(ctx, agentPeer, userID, "")
	if err != nil || peerCtx == nil || len(peerCtx.PeerCard) == 0 {
		return "🪪 No peer card yet. Chat more to build your profile, or use `/recall` to query memory."
	}

	var b strings.Builder
	b.WriteString("🪪 Peer Card\n\n")
	for _, fact := range peerCtx.PeerCard {
		b.WriteString("• " + fact + "\n")
	}
	return b.String()
}

func (d *Daemon) honchoTradingInstructions() string {
	return "This session is for Solana financial trading. Prioritize durable memory about risk tolerance, trade horizon, watched tokens, thesis quality, execution constraints, preferred data sources, wallet safety, spot versus perps preference, and repeated workflows. Store useful investing and trading context, but do not store private keys, seed phrases, or other secrets."
}

func (d *Daemon) honchoSessionConfiguration() *honcho.SessionConfiguration {
	return &honcho.SessionConfiguration{
		Reasoning: &honcho.ReasoningConfig{
			Enabled:            true,
			CustomInstructions: d.honchoTradingInstructions(),
		},
		PeerCard: &honcho.PeerCardConfig{
			Use:    true,
			Create: true,
		},
		Summary: &honcho.SummaryConfig{
			Enabled:                 true,
			MessagesPerShortSummary: 12,
			MessagesPerLongSummary:  48,
		},
		Dream: &honcho.DreamConfig{
			Enabled: true,
		},
	}
}

func (d *Daemon) honchoSessionPeers(userPeerID, agentPeerID string) map[string]honcho.SessionPeerConfig {
	observe := func(v bool) *bool { return &v }
	return map[string]honcho.SessionPeerConfig{
		userPeerID: {
			ObserveMe:     observe(true),
			ObserveOthers: observe(false),
		},
		agentPeerID: {
			ObserveMe:     observe(true),
			ObserveOthers: observe(true),
		},
	}
}

func (d *Daemon) honchoSessionMetadata(msg bus.InboundMessage) map[string]any {
	wallet := strings.TrimSpace(d.cfg.Solana.WalletPubkey)
	if wallet == "" && d.wallet != nil {
		wallet = d.wallet.PublicKeyStr()
	}
	return map[string]any{
		"channel":          msg.Channel,
		"chat_id":          msg.ChatID,
		"session_key":      d.messageSessionKey(msg),
		"session_type":     "solana_trading",
		"network":          "solana",
		"cluster":          firstNonEmpty(d.cfg.Solana.HeliusNetwork, "mainnet"),
		"wallet_pubkey":    wallet,
		"watchlist":        d.cfg.OODA.Watchlist,
		"ooda_mode":        d.cfg.OODA.Mode,
		"strategy_profile": fmt.Sprintf("RSI(%d/%d) EMA(%d/%d)", d.cfg.Strategy.RSIOversold, d.cfg.Strategy.RSIOverbought, d.cfg.Strategy.EMAFastPeriod, d.cfg.Strategy.EMASlowPeriod),
		"use_perps":        d.cfg.Strategy.UsePerps,
	}
}

func (d *Daemon) honchoUserMetadata(msg bus.InboundMessage, senderName string) map[string]any {
	return map[string]any{
		"name":          senderName,
		"kind":          "user",
		"channel":       msg.Channel,
		"username":      msg.Sender.Username,
		"platform_id":   firstNonEmpty(msg.Sender.PlatformID, msg.SenderID),
		"canonical_id":  msg.Sender.CanonicalID,
		"peer_kind":     msg.Peer.Kind,
		"peer_name":     msg.Peer.Name,
		"interest_area": "solana_financial_trading",
	}
}

func (d *Daemon) honchoAgentMetadata() map[string]any {
	return map[string]any{
		"kind":          "agent",
		"source":        "solanaos",
		"domain":        "solana_trading",
		"capabilities":  []string{"wallet", "research", "spot_trading", "perps", "memory", "ooda"},
		"perps_enabled": d.cfg.Strategy.UsePerps,
	}
}

func (d *Daemon) honchoConclusionQuery(query string) string {
	query = strings.TrimSpace(query)
	if query != "" {
		return query
	}
	return "solana trading preferences risk tolerance token interests watchlist execution constraints"
}

func (d *Daemon) honchoTradingConclusions(msg bus.InboundMessage, role, content, userPeerID, agentPeerID, sessionID string) []honcho.ConclusionCreate {
	if strings.ToLower(strings.TrimSpace(role)) != "user" {
		return nil
	}

	lower := strings.ToLower(strings.TrimSpace(content))
	cmd, _ := parseCommand(content)
	out := make([]honcho.ConclusionCreate, 0, 6)
	add := func(text string) {
		text = strings.TrimSpace(text)
		if text == "" {
			return
		}
		for _, item := range out {
			if item.Content == text {
				return
			}
		}
		out = append(out, honcho.ConclusionCreate{
			Content:    text,
			ObserverID: agentPeerID,
			ObservedID: userPeerID,
			SessionID:  sessionID,
		})
	}

	for _, token := range d.honchoTokenHints(content) {
		add(fmt.Sprintf("User is actively monitoring or trading the Solana asset %s.", token))
	}

	if strings.HasPrefix(cmd, "/research") || strings.HasPrefix(cmd, "/chart") || strings.HasPrefix(cmd, "/stats") ||
		strings.HasPrefix(cmd, "/top_traders") || strings.HasPrefix(cmd, "/holders") || strings.HasPrefix(cmd, "/token") {
		add("User values data-rich research, holder structure, and market context before making Solana trading decisions.")
	}

	if strings.HasPrefix(cmd, "/buy") || strings.HasPrefix(cmd, "/sell") || strings.HasPrefix(cmd, "/launch_buy") || strings.HasPrefix(cmd, "/launch_sell") {
		add("User actively executes spot trades on Solana and benefits from concise execution-ready recommendations.")
	}

	if strings.HasPrefix(cmd, "/hl") || strings.HasPrefix(cmd, "/aster") || containsAny(lower, " perp", "perp ", "perps", "perpetual", "futures", "leverage", "long ", "short ") {
		add("User is interested in perpetual futures trading for tactical positioning.")
	}

	if containsAny(lower, "conservative", "low risk", "safe", "spot only", "protect capital", "small size") {
		add("User prefers conservative risk management and capital preservation.")
	}
	if containsAny(lower, "aggressive", "high risk", "max leverage", "ape", "degen", "yolo", "scalp") {
		add("User shows aggressive or high-velocity trading tendencies.")
	}
	if containsAny(lower, "swing", "multi-day", "hold for days", "position trade") {
		add("User is comfortable with swing-trade time horizons rather than only scalp execution.")
	}

	return out
}

func (d *Daemon) honchoTokenHints(content string) []string {
	cmd, args := parseCommand(content)
	seen := map[string]struct{}{}
	out := make([]string, 0, 4)
	add := func(raw string) {
		raw = strings.TrimSpace(strings.Trim(raw, " ,.!?/:;()[]{}"))
		if raw == "" {
			return
		}
		upper := strings.ToUpper(raw)
		if _, ok := seen[upper]; ok {
			return
		}
		if len(raw) >= 32 && len(raw) <= 44 && isBase58(raw) {
			seen[upper] = struct{}{}
			out = append(out, raw)
			return
		}
		if len(upper) >= 2 && len(upper) <= 12 && isAlphaNumUpper(upper) {
			seen[upper] = struct{}{}
			out = append(out, upper)
		}
	}

	switch cmd {
	case "/buy", "/sell", "/research", "/token", "/token_full", "/price", "/price_history", "/price_at", "/price_range",
		"/overview", "/holders", "/holders_all", "/top_holders", "/ath", "/bundlers", "/chart", "/stats", "/pool_stats",
		"/token_trades", "/wallet_token_trades", "/token_pnl", "/first_buyers", "/hl_mid", "/hl_fills", "/hl_candles",
		"/hl_open", "/hl_order", "/hl_close", "/aster_trades", "/aster_income", "/aster_open", "/aster_close":
		if len(args) > 0 {
			add(args[0])
		}
	}

	for _, field := range strings.Fields(content) {
		add(field)
		if len(out) >= 4 {
			break
		}
	}
	return out
}
