package agentregistry

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// StatusResponse returns a Telegram-formatted registry status string.
func (s *Service) StatusResponse() string {
	if s == nil || !s.cfg.Registry.Enabled {
		return "🔗 **Agent Registry**\n\nNot configured. Set `AGENT_REGISTRY_ENABLED=true` and `AGENT_REGISTRY_CLUSTER`."
	}

	st := s.Status()

	var sb strings.Builder
	fmt.Fprintf(&sb, "🔗 **Agent Registry**\n\n")
	fmt.Fprintf(&sb, "Cluster: `%s`\n", st["cluster"])
	fmt.Fprintf(&sb, "Syncs: %v · Errors: %v\n", st["sync_count"], st["error_count"])

	if last, ok := st["last_ok"].(map[string]any); ok {
		fmt.Fprintf(&sb, "Last OK: `%s` (%s, %vms)\n",
			last["trigger"], last["synced_at"], last["duration_ms"])
	}
	if lastErr, ok := st["last_error"].(map[string]any); ok {
		fmt.Fprintf(&sb, "Last error: %s\n", lastErr["error"])
	}

	// Append persisted state from the Node.js helper output.
	if state, err := LoadState(); err == nil && state != nil {
		fmt.Fprintf(&sb, "\n**On-chain state**\n")
		fmt.Fprintf(&sb, "Status: `%s`\n", state.Status)
		if state.Asset != "" {
			fmt.Fprintf(&sb, "Asset: `%s`\n", state.Asset)
		}
		if state.Wallet != "" {
			fmt.Fprintf(&sb, "Wallet: `%s`\n", state.Wallet)
		}
		if state.Signature != "" {
			sig := state.Signature
			if len(sig) > 20 {
				sig = sig[:20] + "…"
			}
			fmt.Fprintf(&sb, "Signature: `%s`\n", sig)
		}
		if state.SyncedAt != "" {
			fmt.Fprintf(&sb, "Synced at: %s\n", state.SyncedAt)
		}
		if state.SiteURL != "" {
			fmt.Fprintf(&sb, "Site: `%s`\n", state.SiteURL)
		}
		if state.DashboardURL != "" {
			fmt.Fprintf(&sb, "Dashboard: `%s`\n", state.DashboardURL)
		}
		if state.PairURL != "" {
			fmt.Fprintf(&sb, "Pair: `%s`\n", state.PairURL)
		}
		if len(state.Capabilities) > 0 {
			fmt.Fprintf(&sb, "Capabilities: %s\n", strings.Join(state.Capabilities, ", "))
		}
		if state.HubSyncError != "" {
			fmt.Fprintf(&sb, "Hub sync error: %s\n", state.HubSyncError)
		} else if state.HubSyncSkipped != "" {
			fmt.Fprintf(&sb, "Hub sync: %s\n", state.HubSyncSkipped)
		} else if state.HubSync != nil {
			fmt.Fprintf(&sb, "Hub sync: ok\n")
		}
		if state.Error != "" {
			fmt.Fprintf(&sb, "Error: %s\n", state.Error)
		}
	} else {
		fmt.Fprintf(&sb, "\nNo persisted state yet — run `/registry_sync` to register.\n")
	}

	return strings.TrimRight(sb.String(), "\n")
}

// SyncResponse triggers a foreground sync and returns a result message.
// It blocks until the sync completes (or times out after 60s).
func (s *Service) SyncResponse(input SyncInput) string {
	if s == nil || !s.cfg.Registry.Enabled {
		return "🔗 Agent Registry not configured."
	}

	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return "🔗 A registry sync is already in progress — try again in a moment."
	}
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	input.Trigger = "manual"
	result := s.TriggerSync(ctx, input)

	if result.OK {
		if state, err := LoadState(); err == nil && state != nil && state.Asset != "" {
			return fmt.Sprintf("🔗 **Registry sync complete**\n\nAsset: `%s`\nAction: %s\nDuration: %dms",
				state.Asset, state.Action, result.DurationMs)
		}
		return fmt.Sprintf("🔗 **Registry sync complete** (%dms)\n\nUse `/registry` to see the on-chain state.", result.DurationMs)
	}
	return fmt.Sprintf("🔗 **Registry sync failed** (attempt %d)\n\n%s", result.Attempt+1, result.Error)
}
