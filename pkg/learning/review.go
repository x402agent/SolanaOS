package learning

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/skills"
)

type ReviewReport struct {
	GeneratedAt     time.Time    `json:"generated_at"`
	ActiveUsers     int          `json:"active_users"`
	AutoSkills      int          `json:"auto_skills"`
	SkillsCreated   int          `json:"skills_created"`
	SkillsImproved  int          `json:"skills_improved"`
	TopIntents      []IntentStat `json:"top_intents"`
	RecentSummaries []string     `json:"recent_summaries"`
	Nudges          []string     `json:"nudges"`
}

func (m *Manager) Review(ctx context.Context) (*ReviewReport, error) {
	if !m.Enabled() {
		return &ReviewReport{}, nil
	}
	_ = ctx
	models, err := m.userModels.List()
	if err != nil {
		return nil, err
	}
	recent, err := m.sessionSearch.Recent(8, "")
	if err != nil {
		return nil, err
	}
	skillsCreated, skillsImproved, err := m.skillForge.Reconcile(models)
	if err != nil {
		return nil, err
	}
	autoSkills, _ := m.AutoSkills()

	report := &ReviewReport{
		GeneratedAt:    time.Now().UTC(),
		ActiveUsers:    len(models),
		AutoSkills:     len(autoSkills),
		SkillsCreated:  skillsCreated,
		SkillsImproved: skillsImproved,
		TopIntents:     aggregateTopIntents(models, 5),
		Nudges:         buildNudges(models, autoSkills, recent),
	}
	for _, item := range recent {
		report.RecentSummaries = append(report.RecentSummaries, item.SummaryOrContent())
	}
	return report, nil
}

func (m *Manager) SaveNudge(report *ReviewReport) (string, error) {
	if !m.Enabled() || report == nil || len(report.Nudges) == 0 {
		return "", nil
	}
	dir := filepath.Join(m.workspace, "memory", "nudges")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, report.GeneratedAt.Format("20060102-150405")+".md")
	body := report.Markdown()
	return path, os.WriteFile(path, []byte(body), 0o644)
}

func (r *ReviewReport) Markdown() string {
	if r == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("# Learning Review\n\n")
	b.WriteString(fmt.Sprintf("- Generated: %s\n", r.GeneratedAt.Format(time.RFC3339)))
	b.WriteString(fmt.Sprintf("- Active users: %d\n", r.ActiveUsers))
	b.WriteString(fmt.Sprintf("- Auto skills: %d\n", r.AutoSkills))
	b.WriteString(fmt.Sprintf("- Skills created: %d\n", r.SkillsCreated))
	b.WriteString(fmt.Sprintf("- Skills improved: %d\n", r.SkillsImproved))
	if len(r.TopIntents) > 0 {
		b.WriteString("\n## Top Intents\n")
		for _, intent := range r.TopIntents {
			b.WriteString(fmt.Sprintf("- %s (%d)\n", intent.Name, intent.Count))
		}
	}
	if len(r.Nudges) > 0 {
		b.WriteString("\n## Nudges\n")
		for _, nudge := range r.Nudges {
			b.WriteString("- " + nudge + "\n")
		}
	}
	if len(r.RecentSummaries) > 0 {
		b.WriteString("\n## Recent Durable Memory\n")
		for _, summary := range r.RecentSummaries {
			b.WriteString("- " + summary + "\n")
		}
	}
	return strings.TrimSpace(b.String())
}

func aggregateTopIntents(models []*UserModel, limit int) []IntentStat {
	counts := map[string]int{}
	for _, model := range models {
		if model == nil {
			continue
		}
		for _, stat := range model.RecurringIntents {
			counts[stat.Name] += stat.Count
		}
	}
	items := make([]IntentStat, 0, len(counts))
	for name, count := range counts {
		items = append(items, IntentStat{Name: name, Count: count})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Count == items[j].Count {
			return items[i].Name < items[j].Name
		}
		return items[i].Count > items[j].Count
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items
}

func buildNudges(models []*UserModel, autoSkills []skills.Skill, recent []SearchResult) []string {
	var nudges []string
	topIntents := aggregateTopIntents(models, 3)
	if len(topIntents) > 0 {
		nudges = append(nudges, fmt.Sprintf("Double down on recurring `%s` workflows; they are the strongest self-programming candidates.", topIntents[0].Name))
	}
	if len(autoSkills) == 0 && len(topIntents) > 0 {
		nudges = append(nudges, "No auto-skills are active yet. Keep capturing repeated work until the threshold promotes one.")
	}
	if len(recent) > 0 {
		nudges = append(nudges, "Use recent durable memory before asking the model to regenerate known context from scratch.")
	}
	if len(models) > 0 {
		nudges = append(nudges, "The user model is evolving; preserve concise execution while retaining deep system context.")
	}
	return uniqueNonEmpty(nudges)
}
