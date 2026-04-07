// dreaming_handlers.go — background memory consolidation (Dreaming) integration
// for the SolanaOS daemon.
//
// When dreaming is enabled in config (dreaming.enabled = true), the daemon
// registers a cron job that runs a full light → REM → deep sweep on the
// agent's ClawVault. Results are optionally delivered to Telegram and written
// to the vault/.dreams/DREAMS.md diary.
package daemon

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/cron"
	"github.com/x402agent/Solana-Os-Go/pkg/dreaming"
	"github.com/x402agent/Solana-Os-Go/pkg/logger"
)

// initDreaming creates the Dreamer and, if enabled, registers its cron sweep.
// Called from Daemon.Start() after the scheduler is created.
func (d *Daemon) initDreaming() {
	cfg := d.cfg.Dreaming
	if !cfg.Enabled {
		logger.InfoCF("dreaming", "Dreaming disabled (set dreaming.enabled=true to opt in)", nil)
		return
	}

	dreamCfg := dreaming.Config{
		MinScore:       cfg.MinScore,
		MinRecallCount: cfg.MinRecallCount,
	}

	// Wire the LLM diary function when an LLM is configured.
	if d.llm != nil && d.llm.IsConfigured() {
		dreamCfg.DiaryFunc = func(ctx context.Context, prompt string) (string, error) {
			return d.llm.Chat(ctx, "dreaming-diary", prompt, "")
		}
	}

	vaultPath := d.recorder.VaultPath()
	dr, err := dreaming.New(vaultPath, dreamCfg)
	if err != nil {
		logger.WarnCF("dreaming", "Failed to init dreamer", map[string]any{"error": err.Error()})
		return
	}
	d.dreamer = dr

	// Parse schedule (supports cron intervals like "8h", "0 3 * * *", "daily", etc.).
	schedule := strings.TrimSpace(cfg.Schedule)
	if schedule == "" {
		schedule = "0 3 * * *" // 3 AM daily
	}
	interval, err := cron.ParseSchedule(schedule)
	if err != nil {
		// Fall back to 24h if the schedule is a real cron expression (not parseable as duration).
		interval = 24 * time.Hour
	}

	d.scheduler.Add(cron.Job{
		Name:     "dreaming-sweep",
		Interval: interval,
		Fn: func(ctx context.Context) error {
			return d.dreamingSweepJob(ctx)
		},
	})

	logger.InfoCF("dreaming", "Dreaming enabled", map[string]any{
		"schedule": schedule,
		"interval": interval.String(),
		"vault":    vaultPath,
	})
}

// dreamingSweepJob runs a full dreaming sweep and delivers the summary.
func (d *Daemon) dreamingSweepJob(ctx context.Context) error {
	if d.dreamer == nil {
		return nil
	}

	result, err := d.dreamer.RunSweep(ctx)
	if err != nil {
		logger.WarnCF("dreaming", "Sweep failed", map[string]any{"error": err.Error()})
		return err
	}

	body := formatDreamReport(result)
	path, _ := d.writeAutomationArtifact("dreaming", "dream-sweep", body)
	if path != "" {
		body += "\n\nArtifact: " + path
	}

	// Deliver to Telegram if configured.
	channel := strings.TrimSpace(d.cfg.Dreaming.Channel)
	chatID := strings.TrimSpace(d.cfg.Dreaming.ChatID)
	d.deliverAutomation(config.AutomationJobConfig{
		Name:    "dreaming-sweep",
		Channel: channel,
		ChatID:  chatID,
	}, body)

	return nil
}

// dreamingStatusResponse returns a human-readable status string for /status or /dreaming.
func (d *Daemon) dreamingStatusResponse() string {
	cfg := d.cfg.Dreaming
	if !cfg.Enabled {
		return "Dreaming: disabled (set `dreaming.enabled = true` to opt in)"
	}
	if d.dreamer == nil {
		return "Dreaming: enabled but not initialised"
	}

	cp := d.dreamer.LastSweep()
	if cp == nil {
		return "Dreaming: enabled — no sweep run yet"
	}

	since := time.Since(cp.LastSweep).Round(time.Minute)
	return fmt.Sprintf(
		"Dreaming: last sweep %s ago — staged %d signals, promoted %d insights",
		since, cp.Reflected, cp.Promoted,
	)
}

// handleDreamingCommand processes the /dreaming slash command.
func (d *Daemon) handleDreamingCommand(ctx context.Context, args string) string {
	switch strings.TrimSpace(strings.ToLower(args)) {
	case "on":
		if d.dreamer == nil {
			return "Dreaming is not initialised. Set `dreaming.enabled = true` in config and restart."
		}
		return "Dreaming is already initialised and running on its scheduled interval."

	case "off":
		return "To disable dreaming, set `dreaming.enabled = false` in config and restart."

	case "now", "sweep":
		if d.dreamer == nil {
			return "Dreamer not initialised — enable dreaming in config first."
		}
		result, err := d.dreamer.RunSweep(ctx)
		if err != nil {
			return fmt.Sprintf("Sweep failed: %v", err)
		}
		return formatDreamReport(result)

	case "status", "":
		return d.dreamingStatusResponse()

	case "diary":
		if d.dreamer == nil {
			return "Dreamer not initialised."
		}
		cp := d.dreamer.LastSweep()
		if cp == nil || cp.DiaryEntry == "" {
			return "No dream diary entries yet."
		}
		return fmt.Sprintf("**Latest dream diary entry:**\n\n%s", cp.DiaryEntry)

	case "help":
		return dreamingHelpText()

	default:
		return dreamingHelpText()
	}
}

// ── Formatting helpers ────────────────────────────────────────────────────────

func formatDreamReport(r *dreaming.SweepResult) string {
	var b strings.Builder
	b.WriteString("🌙 **Dreaming Sweep Complete**\n\n")
	b.WriteString(fmt.Sprintf("- Light phase staged: **%d** signals\n", r.LightStaged))
	if len(r.REMThemes) > 0 {
		b.WriteString(fmt.Sprintf("- REM themes: %s\n", strings.Join(r.REMThemes, ", ")))
	}
	b.WriteString(fmt.Sprintf("- Deep promoted: **%d** insights → long-term memory\n", r.DeepPromoted))
	if r.DiaryEntry != "" {
		b.WriteString(fmt.Sprintf("\n> %s", strings.ReplaceAll(r.DiaryEntry, "\n", "\n> ")))
	}
	return b.String()
}

func dreamingHelpText() string {
	return `**Dreaming** — background memory consolidation

` + "`/dreaming`" + ` or ` + "`/dreaming status`" + ` — show sweep status
` + "`/dreaming now`" + `          — run a sweep immediately
` + "`/dreaming diary`" + `        — show latest dream diary entry
` + "`/dreaming on`" + `           — check if dreaming is active
` + "`/dreaming off`" + `          — how to disable dreaming

**Phases:**
• **Light** — scores and stages recent vault signals
• **REM**   — extracts trading themes and boosts recurring entries
• **Deep**  — promotes qualifying insights to long-term memory (vault/lessons)

Configure in ` + "`config.json`" + `:
` + "```json" + `
{
  "dreaming": {
    "enabled": true,
    "schedule": "0 3 * * *",
    "min_score": 0.55,
    "channel": "telegram",
    "chat_id": "YOUR_CHAT_ID"
  }
}
` + "```"
}
