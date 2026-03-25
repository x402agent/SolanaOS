// Package tamagochi implements the SolanaOS TamaGOchi — a virtual pet
// whose mood, energy, and evolution are driven by the agent's on-chain
// performance: wallet balance, trade win-rate, uptime, and OODA cycle health.
//
// The TamaGOchi is the personality layer over the OODA agent. It maps
// real Solana metrics to pet states that display on hardware LEDs,
// Telegram status commands, and the web dashboard.
//
//	🥚 Egg       → just hatched (first boot, no wallet)
//	🦐 Larva     → wallet generated, no trades yet
//	🦞 Juvenile  → first 10 trades completed
//	🦞 Adult     → 50+ trades, win rate > 40%
//	👑 Alpha     → 200+ trades, win rate > 55%, balance growing
//	💀 Ghost     → wallet drained or agent offline > 24h
//
// The pet needs feeding (SOL in wallet), exercise (OODA cycles),
// and rest (no trades during extreme volatility).
package tamagochi

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ── Evolution Stages ─────────────────────────────────────────────────

type Stage string

const (
	StageEgg      Stage = "egg"      // 🥚 First boot
	StageLarva    Stage = "larva"    // 🦐 Wallet exists, no trades
	StageJuvenile Stage = "juvenile" // 🦞 < 50 trades
	StageAdult    Stage = "adult"    // 🦞 50+ trades, decent win rate
	StageAlpha    Stage = "alpha"    // 👑 200+ trades, profitable
	StageGhost    Stage = "ghost"    // 💀 Drained or offline
)

// ── Mood System ──────────────────────────────────────────────────────

type Mood string

const (
	MoodEcstatic Mood = "ecstatic" // 🤩 Big win streak
	MoodHappy    Mood = "happy"    // 😊 Positive PnL
	MoodNeutral  Mood = "neutral"  // 😐 Idle / break even
	MoodAnxious  Mood = "anxious"  // 😰 Losing streak
	MoodSad      Mood = "sad"      // 😢 Significant losses
	MoodSleeping Mood = "sleeping" // 😴 No activity
	MoodHungry   Mood = "hungry"   // 🤤 Low balance
)

// ── Pet State ────────────────────────────────────────────────────────

type PetState struct {
	Name       string    `json:"name"`
	Stage      Stage     `json:"stage"`
	Mood       Mood      `json:"mood"`
	Energy     float64   `json:"energy"`     // 0.0 - 1.0
	Hunger     float64   `json:"hunger"`     // 0.0 - 1.0 (1.0 = starving)
	Experience int       `json:"experience"` // XP from trades
	Level      int       `json:"level"`      // derived from XP
	Streak     int       `json:"streak"`     // consecutive wins (negative = losses)
	BornAt     time.Time `json:"born_at"`
	LastFed    time.Time `json:"last_fed"`    // last time balance increased
	LastActive time.Time `json:"last_active"` // last OODA cycle

	// Performance metrics that drive evolution
	TotalTrades int     `json:"total_trades"`
	WinRate     float64 `json:"win_rate"`
	TotalPnL    float64 `json:"total_pnl"` // cumulative SOL PnL
	BalanceSOL  float64 `json:"balance_sol"`
	PeakBalance float64 `json:"peak_balance"`
	Uptime      int     `json:"uptime_hours"`
}

// ── TamaGOchi Engine ─────────────────────────────────────────────────

type TamaGOchi struct {
	mu       sync.Mutex
	state    PetState
	savePath string
}

// New creates or loads a TamaGOchi. If a save file exists, it restores
// the previous state; otherwise it hatches a new pet.
func New(name string) *TamaGOchi {
	home, _ := os.UserHomeDir()
	savePath := filepath.Join(home, ".nanosolana", "tamagochi.json")

	t := &TamaGOchi{
		savePath: savePath,
	}

	// Try to load existing pet
	if data, err := os.ReadFile(savePath); err == nil {
		if err := json.Unmarshal(data, &t.state); err == nil {
			if strings.EqualFold(strings.TrimSpace(t.state.Name), "NanoSolana") {
				t.state.Name = name
				t.save()
			}
			log.Printf("[TAMAGOCHI] 🦞 Loaded pet '%s' (Stage: %s, Level: %d, XP: %d)",
				t.state.Name, t.state.Stage, t.state.Level, t.state.Experience)
			t.state.LastActive = time.Now()
			return t
		}
	}

	// Hatch new pet
	t.state = PetState{
		Name:       name,
		Stage:      StageEgg,
		Mood:       MoodNeutral,
		Energy:     1.0,
		Hunger:     0.0,
		BornAt:     time.Now(),
		LastActive: time.Now(),
		Level:      1,
	}

	log.Printf("[TAMAGOCHI] 🥚 New pet '%s' hatched!", name)
	t.save()
	return t
}

// ── Lifecycle Events (called by OODA agent) ──────────────────────────

// OnWalletCreated transitions from Egg → Larva.
func (t *TamaGOchi) OnWalletCreated(pubkey string, balanceSOL float64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.state.Stage == StageEgg {
		t.state.Stage = StageLarva
		log.Printf("[TAMAGOCHI] 🦐 %s hatched into a Larva! Wallet: %s", t.state.Name, pubkey[:12]+"…")
	}

	t.state.BalanceSOL = balanceSOL
	if balanceSOL > t.state.PeakBalance {
		t.state.PeakBalance = balanceSOL
	}

	t.updateHunger()
	t.save()
}

// OnOODACycle is called every OODA loop iteration.
func (t *TamaGOchi) OnOODACycle(cycleNum int, balanceSOL float64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.state.LastActive = time.Now()
	t.state.BalanceSOL = balanceSOL

	// Gain energy from activity (capped at 1.0)
	t.state.Energy = math.Min(1.0, t.state.Energy+0.01)

	// Track if balance grew (feeding)
	if balanceSOL > t.state.PeakBalance {
		t.state.PeakBalance = balanceSOL
		t.state.LastFed = time.Now()
	}

	t.updateHunger()
	t.updateMood()
	t.save()
}

// OnTrade records a trade result and grants XP.
func (t *TamaGOchi) OnTrade(win bool, pnlSOL float64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.state.TotalTrades++
	t.state.TotalPnL += pnlSOL

	// XP system: wins grant more XP, losses still grant some
	if win {
		t.state.Experience += 10 + int(pnlSOL*100)
		if t.state.Streak < 0 {
			t.state.Streak = 1
		} else {
			t.state.Streak++
		}
	} else {
		t.state.Experience += 2
		if t.state.Streak > 0 {
			t.state.Streak = -1
		} else {
			t.state.Streak--
		}
		// Lose energy on losses
		t.state.Energy = math.Max(0, t.state.Energy-0.05)
	}

	// Calculate win rate
	if t.state.TotalTrades > 0 {
		wins := float64(t.state.TotalTrades) * t.state.WinRate
		if win {
			wins++
		}
		t.state.WinRate = wins / float64(t.state.TotalTrades)
	}

	// Level up (every 50 XP)
	newLevel := t.state.Experience/50 + 1
	if newLevel > t.state.Level {
		t.state.Level = newLevel
		log.Printf("[TAMAGOCHI] ⬆️ %s leveled up to %d!", t.state.Name, newLevel)
	}

	// Evolution check
	t.checkEvolution()
	t.updateMood()
	t.save()
}

// OnHeartbeat is called every heartbeat (5 min). Updates uptime and decay.
func (t *TamaGOchi) OnHeartbeat() {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.state.Uptime++

	// Energy slowly decays when idle
	if time.Since(t.state.LastActive) > 30*time.Minute {
		t.state.Energy = math.Max(0, t.state.Energy-0.02)
	}

	// Check for ghost state (offline > 24h or balance drained)
	if time.Since(t.state.LastActive) > 24*time.Hour {
		t.state.Stage = StageGhost
		t.state.Mood = MoodSleeping
	} else if t.state.BalanceSOL < 0.001 && t.state.Stage != StageEgg {
		t.state.Stage = StageGhost
		t.state.Mood = MoodHungry
	}

	t.save()
}

// ── Internal ─────────────────────────────────────────────────────────

func (t *TamaGOchi) checkEvolution() {
	switch {
	case t.state.TotalTrades >= 200 && t.state.WinRate > 0.55 && t.state.TotalPnL > 0:
		if t.state.Stage != StageAlpha {
			t.state.Stage = StageAlpha
			log.Printf("[TAMAGOCHI] 👑 %s evolved into ALPHA! Trades: %d, WR: %.0f%%",
				t.state.Name, t.state.TotalTrades, t.state.WinRate*100)
		}
	case t.state.TotalTrades >= 50 && t.state.WinRate > 0.40:
		if t.state.Stage != StageAdult && t.state.Stage != StageAlpha {
			t.state.Stage = StageAdult
			log.Printf("[TAMAGOCHI] 🦞 %s evolved into an Adult! Trades: %d",
				t.state.Name, t.state.TotalTrades)
		}
	case t.state.TotalTrades >= 10:
		if t.state.Stage == StageLarva {
			t.state.Stage = StageJuvenile
			log.Printf("[TAMAGOCHI] 🦞 %s evolved into a Juvenile!",
				t.state.Name)
		}
	}
}

func (t *TamaGOchi) updateHunger() {
	// Hunger based on balance relative to peak
	if t.state.PeakBalance > 0 {
		ratio := t.state.BalanceSOL / t.state.PeakBalance
		t.state.Hunger = math.Max(0, 1.0-ratio)
	}
}

func (t *TamaGOchi) updateMood() {
	switch {
	case t.state.Streak >= 5:
		t.state.Mood = MoodEcstatic
	case t.state.Streak >= 2 || t.state.TotalPnL > 0:
		t.state.Mood = MoodHappy
	case t.state.Hunger > 0.7:
		t.state.Mood = MoodHungry
	case t.state.Streak <= -3:
		t.state.Mood = MoodSad
	case t.state.Streak <= -1:
		t.state.Mood = MoodAnxious
	case time.Since(t.state.LastActive) > 1*time.Hour:
		t.state.Mood = MoodSleeping
	default:
		t.state.Mood = MoodNeutral
	}
}

func (t *TamaGOchi) save() {
	dir := filepath.Dir(t.savePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("[TAMAGOCHI] ⚠️ Failed to create directory %s: %v", dir, err)
		return
	}

	data, err := json.MarshalIndent(t.state, "", "  ")
	if err != nil {
		log.Printf("[TAMAGOCHI] ⚠️ Failed to marshal state: %v", err)
		return
	}
	if err := os.WriteFile(t.savePath, data, 0o644); err != nil {
		log.Printf("[TAMAGOCHI] ⚠️ Failed to save state to %s: %v", t.savePath, err)
	}
}

// ── Public Accessors ─────────────────────────────────────────────────

func (t *TamaGOchi) State() PetState {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.state
}

// StatusString returns a rich text status for Telegram / CLI.
func (t *TamaGOchi) StatusString() string {
	t.mu.Lock()
	defer t.mu.Unlock()

	emoji := stageEmoji(t.state.Stage)
	moodEmoji := moodEmoji(t.state.Mood)
	age := time.Since(t.state.BornAt).Round(time.Hour)

	energyBar := renderBar(t.state.Energy, 10, "⚡", "░")
	hungerBar := renderBar(1.0-t.state.Hunger, 10, "🟢", "🔴")

	return fmt.Sprintf(`%s %s  %s

📊 Stage: %s · Level %d · XP %d
%s Mood: %s
⚡ Energy: %s
🍽️ Hunger: %s

📈 Trades: %d · Win Rate: %.0f%%
💰 Balance: %.4f SOL
📊 Total PnL: %+.4f SOL
🔥 Streak: %+d
⏱️ Age: %s · Uptime: %dh`,
		emoji, t.state.Name, moodEmoji,
		t.state.Stage, t.state.Level, t.state.Experience,
		moodEmoji, t.state.Mood,
		energyBar,
		hungerBar,
		t.state.TotalTrades, t.state.WinRate*100,
		t.state.BalanceSOL,
		t.state.TotalPnL,
		t.state.Streak,
		age, t.state.Uptime,
	)
}

// HardwareColor returns RGB values for the LED display based on pet state.
func (t *TamaGOchi) HardwareColor() (r, g, b uint8) {
	t.mu.Lock()
	defer t.mu.Unlock()

	switch t.state.Mood {
	case MoodEcstatic:
		return 255, 215, 0 // Gold
	case MoodHappy:
		return 20, 241, 149 // Solana green
	case MoodNeutral:
		return 0, 150, 255 // Blue
	case MoodAnxious:
		return 255, 165, 0 // Orange
	case MoodSad:
		return 255, 64, 96 // Red
	case MoodHungry:
		return 200, 100, 0 // Amber
	case MoodSleeping:
		return 30, 30, 60 // Dim purple
	}
	return 100, 100, 100 // Default: grey
}

// ── Helpers ──────────────────────────────────────────────────────────

func stageEmoji(s Stage) string {
	switch s {
	case StageEgg:
		return "🥚"
	case StageLarva:
		return "🦐"
	case StageJuvenile:
		return "🦞"
	case StageAdult:
		return "🦞"
	case StageAlpha:
		return "👑"
	case StageGhost:
		return "💀"
	}
	return "❓"
}

func moodEmoji(m Mood) string {
	switch m {
	case MoodEcstatic:
		return "🤩"
	case MoodHappy:
		return "😊"
	case MoodNeutral:
		return "😐"
	case MoodAnxious:
		return "😰"
	case MoodSad:
		return "😢"
	case MoodSleeping:
		return "😴"
	case MoodHungry:
		return "🤤"
	}
	return "❓"
}

func renderBar(value float64, width int, filledChar, emptyChar string) string {
	filled := int(value * float64(width))
	if filled > width {
		filled = width
	}
	if filled < 0 {
		filled = 0
	}
	bar := ""
	for i := 0; i < width; i++ {
		if i < filled {
			bar += filledChar
		} else {
			bar += emptyChar
		}
	}
	return bar
}
