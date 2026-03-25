package learning

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/skills"
)

type Summarizer interface {
	Summarize(ctx context.Context, role, content string, metadata map[string]string) (string, error)
}

type Manager struct {
	cfg           config.LearningConfig
	workspace     string
	summarizer    Summarizer
	sessionSearch *SessionSearchStore
	userModels    *UserModelStore
	skillForge    *SkillForge
}

type TurnInput struct {
	SessionID string
	UserID    string
	UserName  string
	Channel   string
	Role      string
	Content   string
	Metadata  map[string]string
	CreatedAt time.Time
}

func NewManager(cfg config.LearningConfig, workspace string, summarizer Summarizer) *Manager {
	dbPath := strings.TrimSpace(cfg.SessionDBPath)
	if dbPath == "" {
		dbPath = filepath.Join(workspace, "memory", "session-search", "sessions.db")
	}
	return &Manager{
		cfg:           cfg,
		workspace:     workspace,
		summarizer:    summarizer,
		sessionSearch: NewSessionSearchStore(dbPath),
		userModels:    NewUserModelStore(filepath.Join(workspace, "memory", "user-models"), cfg.UserModelMaxEvidence),
		skillForge:    NewSkillForge(workspace, cfg.AutoSkillThreshold),
	}
}

func (m *Manager) Enabled() bool {
	return m != nil && m.cfg.Enabled
}

func (m *Manager) Init() error {
	if !m.Enabled() {
		return nil
	}
	if err := m.sessionSearch.Init(); err != nil {
		return err
	}
	if err := m.userModels.Init(); err != nil {
		return err
	}
	return m.skillForge.Init()
}

func (m *Manager) CaptureTurn(ctx context.Context, input TurnInput) error {
	if !m.Enabled() {
		return nil
	}
	content := strings.TrimSpace(input.Content)
	if content == "" {
		return nil
	}
	if input.CreatedAt.IsZero() {
		input.CreatedAt = time.Now().UTC()
	}

	summary := HeuristicSummary(content)
	if m.summarizer != nil {
		if refined, err := m.summarizer.Summarize(ctx, input.Role, content, input.Metadata); err == nil && strings.TrimSpace(refined) != "" {
			summary = strings.TrimSpace(refined)
		}
	}

	intent := inferIntent(content)
	turn := TurnRecord{
		SessionID: input.SessionID,
		UserID:    input.UserID,
		UserName:  input.UserName,
		Channel:   input.Channel,
		Role:      input.Role,
		Content:   content,
		Summary:   summary,
		Intent:    intent,
		Metadata:  input.Metadata,
		CreatedAt: input.CreatedAt,
	}

	if err := m.sessionSearch.IndexTurn(turn); err != nil {
		return err
	}

	if strings.EqualFold(strings.TrimSpace(input.Role), "user") && strings.TrimSpace(input.UserID) != "" {
		model, err := m.userModels.Observe(UserObservation{
			UserID:    input.UserID,
			UserName:  input.UserName,
			Channel:   input.Channel,
			Content:   content,
			CreatedAt: input.CreatedAt,
		})
		if err != nil {
			return err
		}
		if _, err := m.skillForge.Observe(turn, model); err != nil {
			return err
		}
	}

	return nil
}

func (m *Manager) MemorySearch(query, userID string, limit int) ([]SearchResult, error) {
	if !m.Enabled() {
		return []SearchResult{}, nil
	}
	if limit <= 0 {
		limit = m.cfg.SearchResultLimit
	}
	return m.sessionSearch.Search(query, SearchOptions{
		UserID: userID,
		Limit:  limit,
	})
}

func (m *Manager) UserModel(userID string) (*UserModel, error) {
	if !m.Enabled() {
		return &UserModel{}, nil
	}
	return m.userModels.Load(userID)
}

func (m *Manager) AutoSkills() ([]skills.Skill, error) {
	if !m.Enabled() {
		return []skills.Skill{}, nil
	}
	return m.skillForge.List()
}

func (m *Manager) BuildPromptContext(query, userID string) string {
	if !m.Enabled() {
		return ""
	}

	var sections []string
	if strings.TrimSpace(userID) != "" {
		if model, err := m.UserModel(userID); err == nil {
			if block := model.FormatPromptContext(); strings.TrimSpace(block) != "" {
				sections = append(sections, "## Learned User Model\n"+block)
			}
		}
	}

	if strings.TrimSpace(query) != "" {
		if hits, err := m.MemorySearch(query, userID, m.cfg.SearchResultLimit); err == nil && len(hits) > 0 {
			lines := make([]string, 0, min(len(hits), 5))
			for _, hit := range hits[:min(len(hits), 5)] {
				lines = append(lines, fmt.Sprintf("- [%s] %s", hit.Role, hit.SummaryOrContent()))
			}
			sections = append(sections, "## Relevant Cross-Session Memory\n"+strings.Join(lines, "\n"))
		}
	}

	if autoSkills, err := m.AutoSkills(); err == nil && len(autoSkills) > 0 {
		lines := make([]string, 0, min(len(autoSkills), 3))
		for _, skill := range autoSkills[:min(len(autoSkills), 3)] {
			lines = append(lines, fmt.Sprintf("- %s: %s", skill.Name, skill.Description))
		}
		sections = append(sections, "## Available Auto Skills\n"+strings.Join(lines, "\n"))
	}

	return strings.Join(sections, "\n\n")
}
