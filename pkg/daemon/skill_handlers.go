package daemon

import (
	"fmt"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/skills"
)

// ── /skills ──────────────────────────────────────────────────────────

func (d *Daemon) skillsListResponse() string {
	if d.skillMgr == nil {
		return "🧩 Skill system not loaded."
	}

	groups := d.skillMgr.CategoryGroups()
	var sb strings.Builder
	fmt.Fprintf(&sb, "🧩 **Skills** (%d loaded)\n\n", d.skillMgr.Count())

	order := []string{
		"🌞  Solana / Crypto",
		"🧠  AI / LLM",
		"🐙  Dev Tools",
		"📝  Productivity",
		"💬  Communication",
		"🎵  Media",
		"🔧  System / Ops",
		"🤖  SolanaOS",
		"📦  Other",
	}
	for _, cat := range order {
		items := groups[cat]
		if len(items) == 0 {
			continue
		}
		fmt.Fprintf(&sb, "**%s**\n", cat)
		for _, sk := range items {
			emoji := sk.Emoji
			if emoji == "" {
				emoji = "•"
			}
			fmt.Fprintf(&sb, "%s `%s` — %s\n", emoji, sk.Name, truncateStr(sk.Description, 80))
		}
		sb.WriteString("\n")
	}
	sb.WriteString("Use `/skill <name>` to view a skill or `/skill_find <query>` to search.")
	return strings.TrimRight(sb.String(), "\n")
}

// ── /skill <name> ─────────────────────────────────────────────────────

func (d *Daemon) skillViewResponse(args []string) string {
	if d.skillMgr == nil {
		return "🧩 Skill system not loaded."
	}
	if len(args) == 0 {
		return "Usage: `/skill <name>`\nExample: `/skill weather`\n\nUse `/skills` to list all available skills."
	}

	name := strings.Join(args, "-")
	sk := d.skillMgr.Get(name)
	if sk == nil {
		// Fallback: search and suggest.
		matches := d.skillMgr.Search(name)
		if len(matches) == 0 {
			return fmt.Sprintf("🧩 Skill `%s` not found. Use `/skills` to browse.", name)
		}
		var sb strings.Builder
		fmt.Fprintf(&sb, "🧩 Skill `%s` not found. Did you mean:\n", name)
		for i, m := range matches {
			if i >= 5 {
				break
			}
			fmt.Fprintf(&sb, "• `%s` — %s\n", m.Name, truncateStr(m.Description, 70))
		}
		return strings.TrimRight(sb.String(), "\n")
	}

	var sb strings.Builder
	emoji := sk.Emoji
	if emoji == "" {
		emoji = "🧩"
	}
	fmt.Fprintf(&sb, "%s **%s**", emoji, sk.Name)
	if sk.Version != "" && sk.Version != "1.0.0" {
		fmt.Fprintf(&sb, " v%s", sk.Version)
	}
	sb.WriteString("\n\n")
	fmt.Fprintf(&sb, "_%s_\n\n", sk.Description)

	if len(sk.Requires.Bins) > 0 {
		fmt.Fprintf(&sb, "Requires: `%s`\n", strings.Join(sk.Requires.Bins, "`, `"))
	}
	if len(sk.Requires.Env) > 0 {
		fmt.Fprintf(&sb, "Env: `%s`\n", strings.Join(sk.Requires.Env, "`, `"))
	}
	if len(sk.Tags) > 0 {
		fmt.Fprintf(&sb, "Tags: %s\n", strings.Join(sk.Tags, ", "))
	}
	if sk.URL != "" {
		fmt.Fprintf(&sb, "Docs: %s\n", sk.URL)
	}

	// Include skill body if short enough for Telegram, else truncate.
	if sk.Body != "" {
		body := sk.Body
		if len(body) > 3000 {
			body = body[:3000] + "\n\n…_(truncated — skill is detailed)_"
		}
		fmt.Fprintf(&sb, "\n---\n%s", body)
	}

	return strings.TrimRight(sb.String(), "\n")
}

// ── /skill_find <query> ───────────────────────────────────────────────

func (d *Daemon) skillFindResponse(args []string) string {
	if d.skillMgr == nil {
		return "🧩 Skill system not loaded."
	}
	if len(args) == 0 {
		return "Usage: `/skill_find <query>`\nExample: `/skill_find github pr review`"
	}
	query := strings.Join(args, " ")
	matches := d.skillMgr.Search(query)
	if len(matches) == 0 {
		return fmt.Sprintf("🧩 No skills match `%s`.", query)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "🧩 **Skills matching** `%s`\n\n", query)
	for _, sk := range matches {
		emoji := sk.Emoji
		if emoji == "" {
			emoji = "•"
		}
		fmt.Fprintf(&sb, "%s `%s` — %s\n", emoji, sk.Name, truncateStr(sk.Description, 90))
	}
	return strings.TrimRight(sb.String(), "\n")
}

// ── /skill_use <name> ────────────────────────────────────────────────
// Returns the full skill body so the LLM can act on it.

func (d *Daemon) skillUseResponse(args []string) string {
	if d.skillMgr == nil {
		return "🧩 Skill system not loaded."
	}
	if len(args) == 0 {
		return "Usage: `/skill_use <name>`\nExample: `/skill_use weather`"
	}
	name := strings.Join(args, "-")
	sk := d.skillMgr.Get(name)
	if sk == nil {
		return fmt.Sprintf("🧩 Skill `%s` not found. Use `/skills` to browse.", name)
	}
	if sk.Body == "" {
		return fmt.Sprintf("🧩 Skill `%s` has no body content.", name)
	}
	return fmt.Sprintf("🧩 **Using skill: %s**\n\n%s", sk.Name, sk.Body)
}

// ── /skill_create <name> <description> ───────────────────────────────

func (d *Daemon) skillCreateResponse(args []string) string {
	if d.skillMgr == nil {
		return "🧩 Skill system not loaded."
	}
	if len(args) < 2 {
		return "Usage: `/skill_create <name> <description>`\n" +
			"Example: `/skill_create my-tool Runs my custom tool for X and Y`\n\n" +
			"The skill will be created in your workspace and immediately available."
	}

	name := strings.ToLower(args[0])
	description := strings.Join(args[1:], " ")

	workspacePath := config.DefaultWorkspacePath()
	path, err := d.skillMgr.Create(workspacePath, name, description, "")
	if err != nil {
		return fmt.Sprintf("🧩 Failed to create skill: %v", err)
	}

	return fmt.Sprintf("🧩 **Skill created: `%s`**\n\nPath: `%s`\n\nEdit `SKILL.md` to add usage instructions.\nUse `/skill %s` to view it.",
		name, path, name)
}

// ── /skills_count ─────────────────────────────────────────────────────

func (d *Daemon) skillsCountResponse() string {
	if d.skillMgr == nil {
		return "🧩 Skill system not loaded."
	}
	return fmt.Sprintf("🧩 %d skills loaded from `%s`.", d.skillMgr.Count(), skills.ResolveSkillsDir())
}

// ── InjectSkillContext ────────────────────────────────────────────────
// Called before LLM inference — appends relevant skill body to the prompt.

func (d *Daemon) injectSkillContext(userMsg string) string {
	if d.skillMgr == nil {
		return ""
	}
	sk := d.skillMgr.MatchMessage(userMsg)
	if sk == nil || sk.Body == "" {
		return ""
	}
	return fmt.Sprintf("\n\n---\n**Active skill: %s**\n%s\n---\n", sk.Name, sk.Body)
}

// truncateStr trims s to max characters, appending "…" if cut.
func truncateStr(s string, max int) string {
	// Strip newlines for single-line display.
	s = strings.ReplaceAll(strings.TrimSpace(s), "\n", " ")
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}
