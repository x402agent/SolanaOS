// Package heartbeat provides periodic heartbeat messages for MawdBot.
// Adapted from PicoClaw — cron-triggered proactive notifications.
package heartbeat

import (
	"context"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
)

type HeartbeatFunc func(ctx context.Context, content, channel, chatID string) (string, error)

type Config struct {
	Enabled   bool          `json:"enabled"`
	Interval  time.Duration `json:"interval"`
	Prompt    string        `json:"prompt"`
	Channel   string        `json:"channel"`
	ChatID    string        `json:"chat_id"`
}

type Heartbeat struct {
	cfg     Config
	process HeartbeatFunc
	stop    chan struct{}
}

func New(cfg Config, processFn HeartbeatFunc) *Heartbeat {
	return &Heartbeat{
		cfg:     cfg,
		process: processFn,
		stop:    make(chan struct{}),
	}
}

func (h *Heartbeat) Start(ctx context.Context) {
	if !h.cfg.Enabled || h.cfg.Interval <= 0 {
		logger.InfoCF("heartbeat", "Heartbeat disabled", nil)
		return
	}

	ticker := time.NewTicker(h.cfg.Interval)
	defer ticker.Stop()

	logger.InfoCF("heartbeat", "Heartbeat started", map[string]any{
		"interval": h.cfg.Interval.String(),
	})

	for {
		select {
		case <-ticker.C:
			prompt := h.cfg.Prompt
			if prompt == "" {
				prompt = "Heartbeat check — report current status and any active positions."
			}
			result, err := h.process(ctx, prompt, h.cfg.Channel, h.cfg.ChatID)
			if err != nil {
				logger.WarnCF("heartbeat", "Heartbeat failed", map[string]any{"error": err.Error()})
			} else {
				logger.DebugCF("heartbeat", "Heartbeat completed", map[string]any{
					"result_len": len(result),
				})
			}
		case <-h.stop:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (h *Heartbeat) Stop() {
	close(h.stop)
}
