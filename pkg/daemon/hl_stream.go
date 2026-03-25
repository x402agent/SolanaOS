package daemon

import (
	"fmt"
	"log"
	"strings"
	"time"

	hlpkg "github.com/x402agent/Solana-Os-Go/pkg/hyperliquid"
)

func (d *Daemon) startHyperliquidStream() {
	if d.hl == nil || !d.cfg.Hyperliquid.WSEnabled {
		return
	}
	stream := hlpkg.NewStream(d.hl, hlpkg.StreamConfig{
		Symbols:        d.cfg.Hyperliquid.Symbols,
		MarkTriggerBps: d.cfg.Hyperliquid.MarkTriggerBps,
	}, hlpkg.StreamHandlers{
		OnReady: func() {
			log.Printf("[HL-WS] 🔌 Stream connected: wallet=%s symbols=%v", d.hl.Wallet(), d.cfg.Hyperliquid.Symbols)
		},
		OnError: func(err error) {
			log.Printf("[HL-WS] ⚠️ %v", err)
		},
		OnOrderUpdates: func(updates []hlpkg.WSOrderUpdate) {
			if len(updates) == 0 {
				return
			}
			u := updates[0]
			log.Printf("[HL-WS] 📬 order update: %s %s oid=%d status=%s", u.Coin, u.Side, u.Oid, u.Status)
			d.triggerOODAFromHyperliquid("order update")
		},
		OnFills: func(fills []hlpkg.WSFill) {
			if len(fills) == 0 {
				return
			}
			f := fills[0]
			log.Printf("[HL-WS] ✅ fill: %s %s %s @ %s oid=%d", f.Coin, strings.ToUpper(f.Side), f.Size, f.Price, f.Oid)
			d.triggerOODAFromHyperliquid("fill")
		},
		OnMarkTrigger: func(mark hlpkg.WSMark) {
			log.Printf("[HL-WS] 📈 mark trigger: %s mark=%.6f move=%.1fbps", mark.Coin, mark.MarkPx, mark.MoveBps)
			d.triggerOODAFromHyperliquid(fmt.Sprintf("%s mark move %.1fbps", mark.Coin, mark.MoveBps))
		},
	})
	if err := stream.Start(d.ctx); err != nil {
		log.Printf("[HL-WS] ⚠️ stream init failed (non-fatal): %v", err)
		return
	}
	d.hlStream = stream
}

func (d *Daemon) triggerOODAFromHyperliquid(reason string) {
	if d.ooda == nil {
		return
	}
	cooldown := time.Duration(d.cfg.Hyperliquid.TriggerCooldownSec) * time.Second
	now := time.Now().UnixMilli()
	if cooldown > 0 {
		for {
			last := d.hlLastTrigger.Load()
			if last > 0 && time.Duration(now-last)*time.Millisecond < cooldown {
				return
			}
			if d.hlLastTrigger.CompareAndSwap(last, now) {
				break
			}
		}
	} else {
		d.hlLastTrigger.Store(now)
	}
	log.Printf("[HL-WS] 🔁 OODA trigger: %s", reason)
	d.ooda.TriggerCycle()
}

func (d *Daemon) hlStreamResponse() string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if d.hlStream == nil {
		return "📈 **Hyperliquid Stream**\n\nRealtime stream is disabled or not connected."
	}
	stats := d.hlStream.Stats()
	var sb strings.Builder
	fmt.Fprintf(&sb, "📈 **Hyperliquid Stream**\n\n")
	fmt.Fprintf(&sb, "Connected: `%t`\n", stats.Connected)
	fmt.Fprintf(&sb, "Symbols: `%s`\n", strings.Join(d.cfg.Hyperliquid.Symbols, ", "))
	fmt.Fprintf(&sb, "Mark Trigger: `%.1f bps`\n", d.cfg.Hyperliquid.MarkTriggerBps)
	fmt.Fprintf(&sb, "Cooldown: `%ds`\n", d.cfg.Hyperliquid.TriggerCooldownSec)
	if !stats.LastEventAt.IsZero() {
		fmt.Fprintf(&sb, "Last Event: `%s`\n", stats.LastEventAt.Format(time.RFC3339))
	}
	fmt.Fprintf(&sb, "Order Events: `%d`\n", stats.OrderEvents)
	fmt.Fprintf(&sb, "Fill Events: `%d`\n", stats.FillEvents)
	fmt.Fprintf(&sb, "Mark Events: `%d`\n", stats.MarkEvents)
	fmt.Fprintf(&sb, "OODA Triggers: `%d`\n", stats.TriggerCount)
	if len(stats.LastMarks) > 0 {
		fmt.Fprintf(&sb, "\nLast Marks:\n")
		for _, symbol := range d.cfg.Hyperliquid.Symbols {
			if px, ok := stats.LastMarks[strings.ToUpper(symbol)]; ok {
				fmt.Fprintf(&sb, "• `%s` %.6f\n", strings.ToUpper(symbol), px)
			}
		}
	}
	if strings.TrimSpace(stats.LastError) != "" {
		fmt.Fprintf(&sb, "\nLast Error: `%s`\n", stats.LastError)
	}
	return sb.String()
}
