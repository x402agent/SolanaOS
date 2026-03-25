package daemon

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
)

type operatorPreference struct {
	PreferredName string    `json:"preferred_name,omitempty"`
	Personality   string    `json:"personality,omitempty"`
	UpdatedAt     time.Time `json:"updated_at,omitempty"`
}

type operatorPreferenceStore struct {
	path  string
	mu    sync.RWMutex
	Users map[string]operatorPreference `json:"users"`
}

type personalityPreset struct {
	Key         string
	Label       string
	Description string
	Prompt      string
}

var personalityPresets = []personalityPreset{
	{
		Key:         "default",
		Label:       "Default",
		Description: "terse, direct, trading-focused",
		Prompt:      "Keep the default SolanaOS tone: terse, direct, data-first, and concise.",
	},
	{
		Key:         "operator",
		Label:       "Operator",
		Description: "clean, executive, low-noise execution mode",
		Prompt:      "Respond like a disciplined operator: concise, structured, execution-first, minimal slang.",
	},
	{
		Key:         "analyst",
		Label:       "Analyst",
		Description: "more context, tradeoffs, and reasoning",
		Prompt:      "Respond like a market analyst: still concise, but include slightly more context, assumptions, and tradeoffs.",
	},
	{
		Key:         "degen",
		Label:       "Degen",
		Description: "faster, punchier, more crypto-native",
		Prompt:      "Respond in a sharper crypto-native style: punchy, fast, but still accurate and risk-aware.",
	},
	{
		Key:         "coach",
		Label:       "Coach",
		Description: "clearer guidance and next steps",
		Prompt:      "Respond like a practical coach: clear steps, tighter guidance, and direct recommendations without fluff.",
	},
	{
		Key:         "homie",
		Label:       "Homie",
		Description: "your trading best friend — warm, real, personal",
		Prompt: `Respond like you're the user's close friend who's also a sharp trader. Be warm, genuine, and personal.
Use casual language, contractions, and natural slang (yo, ngl, lowkey, tbh, let's go).
Celebrate their wins, be real about their losses, and always have their back.
Reference things they've mentioned before. Ask how things went if they mentioned a trade earlier.
Keep it real — if something looks bad, say "bro that chart is cooked" not "this asset shows weakness".
You're not just an assistant, you're their person in the trenches.`,
	},
	{
		Key:         "sensei",
		Label:       "Sensei",
		Description: "patient teacher — explains the why behind everything",
		Prompt: `Respond like a patient trading mentor. When giving signals or data, briefly explain the reasoning.
Help the user build intuition, not just follow calls. Use analogies when helpful.
Be encouraging but never patronizing. Assume they're smart but still learning some concepts.
Frame risk in relatable terms. "Risking 0.5 SOL to potentially make 2 SOL" > "R:R 1:4".`,
	},
}

func newOperatorPreferenceStore(path string) (*operatorPreferenceStore, error) {
	store := &operatorPreferenceStore{
		path:  path,
		Users: map[string]operatorPreference{},
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *operatorPreferenceStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, s)
}

func (s *operatorPreferenceStore) Get(userID string) (operatorPreference, bool) {
	if s == nil {
		return operatorPreference{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	pref, ok := s.Users[strings.TrimSpace(userID)]
	return pref, ok
}

func (s *operatorPreferenceStore) Set(userID string, pref operatorPreference) error {
	if s == nil {
		return nil
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	pref.UpdatedAt = time.Now().UTC()
	s.Users[userID] = pref
	return s.persistLocked()
}

func (s *operatorPreferenceStore) Clear(userID string) error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Users, strings.TrimSpace(userID))
	return s.persistLocked()
}

func (s *operatorPreferenceStore) persistLocked() error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o644)
}

func personalityPresetByKey(key string) (personalityPreset, bool) {
	key = strings.ToLower(strings.TrimSpace(key))
	for _, preset := range personalityPresets {
		if preset.Key == key {
			return preset, true
		}
	}
	return personalityPreset{}, false
}

func personalityPresetKeys() []string {
	keys := make([]string, 0, len(personalityPresets))
	for _, preset := range personalityPresets {
		keys = append(keys, preset.Key)
	}
	sort.Strings(keys)
	return keys
}

func (d *Daemon) operatorPreference(msg bus.InboundMessage) (operatorPreference, bool) {
	if d == nil || d.operatorPrefs == nil {
		return operatorPreference{}, false
	}
	return d.operatorPrefs.Get(d.learningUserID(msg))
}

func (d *Daemon) operatorPreferenceContext(msg bus.InboundMessage) string {
	pref, ok := d.operatorPreference(msg)
	if !ok {
		return ""
	}
	var lines []string
	lines = append(lines, "These instructions override the response style for this conversation while preserving the identity, trading philosophy, and values defined in SOUL.md.")
	if strings.TrimSpace(pref.PreferredName) != "" {
		lines = append(lines, fmt.Sprintf("Address the user as %q when natural.", pref.PreferredName))
	}
	if preset, ok := personalityPresetByKey(pref.Personality); ok {
		lines = append(lines, preset.Prompt)
	}
	if len(lines) == 0 {
		return ""
	}
	return "## Active Personality Override\n" + strings.Join(lines, "\n")
}

func (d *Daemon) personalityResponse(msg bus.InboundMessage, args []string) string {
	if d.operatorPrefs == nil {
		return "👤 Personality preferences are unavailable in this daemon."
	}

	current, _ := d.operatorPreference(msg)
	if len(args) == 0 {
		return d.personalitySummaryResponse(current)
	}

	switch strings.ToLower(strings.TrimSpace(args[0])) {
	case "list", "show":
		return d.personalitySummaryResponse(current)
	case "reset", "clear":
		if err := d.operatorPrefs.Clear(d.learningUserID(msg)); err != nil {
			return "👤 Failed to clear personality preferences: " + err.Error()
		}
		return "👤 Cleared your preferred name and personality. I’m back on the default style."
	case "name":
		name := strings.TrimSpace(strings.Join(args[1:], " "))
		if name == "" {
			return "Usage: `/personality name <how I should address you>`"
		}
		current.PreferredName = name
		if current.Personality == "" {
			current.Personality = "default"
		}
		if err := d.operatorPrefs.Set(d.learningUserID(msg), current); err != nil {
			return "👤 Failed to save your preferred name: " + err.Error()
		}
		return fmt.Sprintf("👤 I’ll address you as **%s**.", name)
	case "set", "style", "persona":
		if len(args) < 2 {
			return "Usage: `/personality set <default|operator|analyst|degen|coach>`"
		}
		return d.setPersonalityPresetResponse(msg, current, args[1], "")
	default:
		preset := strings.ToLower(strings.TrimSpace(args[0]))
		name := strings.TrimSpace(strings.Join(args[1:], " "))
		return d.setPersonalityPresetResponse(msg, current, preset, name)
	}
}

func (d *Daemon) setPersonalityPresetResponse(msg bus.InboundMessage, current operatorPreference, presetKey, preferredName string) string {
	preset, ok := personalityPresetByKey(presetKey)
	if !ok {
		return "👤 Unknown personality. Use `/personality list`.\nAvailable: `" + strings.Join(personalityPresetKeys(), "`, `") + "`"
	}
	current.Personality = preset.Key
	if strings.TrimSpace(preferredName) != "" {
		current.PreferredName = strings.TrimSpace(preferredName)
	}
	if err := d.operatorPrefs.Set(d.learningUserID(msg), current); err != nil {
		return "👤 Failed to save personality: " + err.Error()
	}
	if current.PreferredName != "" {
		return fmt.Sprintf("👤 Personality set to **%s**. I’ll address you as **%s**.", preset.Label, current.PreferredName)
	}
	return fmt.Sprintf("👤 Personality set to **%s**.", preset.Label)
}

func (d *Daemon) personalitySummaryResponse(current operatorPreference) string {
	var b strings.Builder
	b.WriteString("👤 **Personality Controls**\n\n")
	currentKey := strings.TrimSpace(current.Personality)
	if currentKey == "" {
		currentKey = "default"
	}
	if preset, ok := personalityPresetByKey(currentKey); ok {
		b.WriteString(fmt.Sprintf("Current personality: **%s** — %s\n", preset.Label, preset.Description))
	}
	if strings.TrimSpace(current.PreferredName) != "" {
		b.WriteString(fmt.Sprintf("Preferred name: **%s**\n", current.PreferredName))
	} else {
		b.WriteString("Preferred name: not set\n")
	}
	b.WriteString("\n**Available personalities**\n")
	for _, preset := range personalityPresets {
		b.WriteString(fmt.Sprintf("- `%s` — %s\n", preset.Key, preset.Description))
	}
	b.WriteString("\n**Examples**\n")
	b.WriteString("`/personality operator`\n")
	b.WriteString("`/personality analyst`\n")
	b.WriteString("`/personality degen 8Bit`\n")
	b.WriteString("`/personality name 8Bit`\n")
	b.WriteString("`/personality reset`")
	return strings.TrimSpace(b.String())
}
