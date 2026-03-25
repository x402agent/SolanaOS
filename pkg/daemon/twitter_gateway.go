package daemon

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
)

func (d *Daemon) twitterResponse(msg bus.InboundMessage, args []string) string {
	if len(args) == 0 {
		return d.twitterUsage()
	}

	ch := d.getXCh()
	switch strings.ToLower(strings.TrimSpace(args[0])) {
	case "help":
		return d.twitterUsage()
	case "status":
		return d.twitterStatusResponse()
	case "start":
		if ch == nil {
			return "🐦 X channel is not configured. Set the X credentials in env first."
		}
		if err := ch.Start(d.ctx); err != nil {
			return fmt.Sprintf("🐦 X start failed: %v", err)
		}
		return d.twitterStatusResponse()
	case "stop":
		if ch == nil {
			return "🐦 X channel is not configured."
		}
		if err := ch.Stop(d.ctx); err != nil {
			return fmt.Sprintf("🐦 X stop failed: %v", err)
		}
		return "🐦 X gateway stopped."
	case "post", "tweet":
		if ch == nil {
			return "🐦 X channel is not configured."
		}
		body := strings.TrimSpace(strings.Join(args[1:], " "))
		if body == "" {
			return "Usage: /twitter post <text>"
		}
		ctx, cancel := context.WithTimeout(d.ctx, 45*time.Second)
		defer cancel()
		postID, err := ch.Post(ctx, body, "")
		if err != nil {
			return fmt.Sprintf("🐦 X post failed: %v", err)
		}
		if postID == "" {
			return "🐦 Posted to X."
		}
		return fmt.Sprintf("🐦 Posted to X.\nID: `%s`", postID)
	case "reply":
		if ch == nil {
			return "🐦 X channel is not configured."
		}
		if len(args) < 3 {
			return "Usage: /twitter reply <tweet_id> <text>"
		}
		replyTo := strings.TrimSpace(args[1])
		body := strings.TrimSpace(strings.Join(args[2:], " "))
		if replyTo == "" || body == "" {
			return "Usage: /twitter reply <tweet_id> <text>"
		}
		ctx, cancel := context.WithTimeout(d.ctx, 45*time.Second)
		defer cancel()
		postID, err := ch.Post(ctx, body, replyTo)
		if err != nil {
			return fmt.Sprintf("🐦 X reply failed: %v", err)
		}
		if postID == "" {
			return fmt.Sprintf("🐦 Replied on X.\nParent: `%s`", replyTo)
		}
		return fmt.Sprintf("🐦 Replied on X.\nParent: `%s`\nID: `%s`", replyTo, postID)
	default:
		return d.twitterUsage()
	}
}

func (d *Daemon) twitterUsage() string {
	return strings.TrimSpace(`
🐦 **X Gateway**

/twitter status — channel state, handle, latest mention/post
/twitter post <text> — publish a standalone post
/twitter reply <tweet_id> <text> — reply to a specific post
/twitter start — start or reconnect the X poller
/twitter stop — stop the X poller

Inbound X mentions route through the daemon as channel ` + "`x`" + `, so ` + "`!token`" + `, ` + "`!web`" + `, ` + "`!claude`" + `, and the other live X commands work once the channel is online.`)
}

func (d *Daemon) twitterStatusResponse() string {
	ch := d.getXCh()
	if ch == nil {
		return "🐦 X channel is not configured. Set the X credentials and restart, or use `/twitter start` after configuration."
	}
	snap := ch.Snapshot()
	status := "offline"
	if snap.Running {
		status = "online"
	}

	var b strings.Builder
	b.WriteString("🐦 **X Gateway Status**\n\n")
	b.WriteString(fmt.Sprintf("- Status: `%s`\n", status))
	if handle := strings.TrimSpace(snap.Handle); handle != "" {
		b.WriteString(fmt.Sprintf("- Handle: `@%s`\n", handle))
	}
	if selfID := strings.TrimSpace(snap.SelfID); selfID != "" {
		b.WriteString(fmt.Sprintf("- Account ID: `%s`\n", selfID))
	}
	if snap.PollInterval != "" {
		b.WriteString(fmt.Sprintf("- Poll interval: `%s`\n", snap.PollInterval))
	}
	if mentionID := strings.TrimSpace(snap.LastMentionID); mentionID != "" {
		b.WriteString(fmt.Sprintf("- Last mention: `%s`\n", mentionID))
	}
	if postID := strings.TrimSpace(snap.LastPostID); postID != "" {
		b.WriteString(fmt.Sprintf("- Last post: `%s`\n", postID))
	}
	if !snap.LastPollAt.IsZero() {
		b.WriteString(fmt.Sprintf("- Last poll: `%s`\n", snap.LastPollAt.UTC().Format(time.RFC3339)))
	}
	if lastErr := strings.TrimSpace(snap.LastError); lastErr != "" {
		b.WriteString(fmt.Sprintf("- Last error: `%s`\n", truncate(lastErr, 180)))
	}
	return strings.TrimSpace(b.String())
}
