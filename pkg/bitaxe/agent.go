// Package bitaxe — OODA loop agent for autonomous Bitaxe management.
// Observe → Orient → Decide → Act cycle runs continuously.
// Ported from the Bitaxe agent package for inline use in the SolanaOS daemon.
package bitaxe

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// ───────────────────── Agent State ──────────────────────────

type AgentState string

const (
	StateBooting AgentState = "booting"
	StateRunning AgentState = "running"
	StateTuning  AgentState = "tuning"
	StateAlert   AgentState = "alert"
	StateStopped AgentState = "stopped"
)

// Decision represents what the agent decided to do.
type Decision struct {
	Action     string    `json:"action"` // hold, tune_up, tune_down, alert, restart
	Reason     string    `json:"reason"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
}

// AgentConfig holds OODA tuning parameters.
type AgentConfig struct {
	MaxTempC   float64 // Critical temp — reduce freq
	WarnTempC  float64 // Warning temp — increase fan
	CoolTempC  float64 // Cool enough to overclock
	MaxFreqMHz int     // Max frequency ceiling
	MinFreqMHz int     // Min frequency floor
	MinVoltageMV int   // Minimum safe core voltage floor
	VoltageStepMV int  // Voltage adjustment step size
	AutoTune   bool    // Enable automatic freq/fan adjustment
}

// DefaultAgentConfig returns sensible defaults for Bitaxe Gamma 602.
func DefaultAgentConfig() AgentConfig {
	return AgentConfig{
		MaxTempC:   72,
		WarnTempC:  65,
		CoolTempC:  50,
		MaxFreqMHz: 600,
		MinFreqMHz: 400,
		MinVoltageMV: 1060,
		VoltageStepMV: 50,
		AutoTune:   true,
	}
}

// AgentMetrics tracks running performance.
type AgentMetrics struct {
	TotalCycles    int64          `json:"totalCycles"`
	AvgHashRate    float64        `json:"avgHashRate"`
	AvgTemp        float64        `json:"avgTemp"`
	AvgEfficiency  float64        `json:"avgEfficiency"`
	DecisionCounts map[string]int `json:"decisionCounts"`
	LastDecision   *Decision      `json:"lastDecision"`
}

// Agent is the autonomous OODA controller for a Bitaxe device.
type Agent struct {
	client  *Client
	pet     *Pet
	config  AgentConfig
	state   AgentState
	metrics AgentMetrics

	// OODA decision history (ring buffer, last 50)
	decisions []Decision
	decIdx    int

	mu     sync.RWMutex
	cancel context.CancelFunc
	done   chan struct{}
}

// NewAgent creates a new OODA agent wrapping an existing Client and Pet.
func NewAgent(client *Client, pet *Pet, cfg AgentConfig) *Agent {
	return &Agent{
		client: client,
		pet:    pet,
		config: cfg,
		state:  StateBooting,
		metrics: AgentMetrics{
			DecisionCounts: make(map[string]int),
		},
		decisions: make([]Decision, 50),
		done:      make(chan struct{}),
	}
}

// Start begins the OODA loop. It piggybacks on the Client's existing polling —
// the agent runs its own ticker at the same interval to process the latest stats.
func (a *Agent) Start(ctx context.Context, interval time.Duration) {
	ctx, a.cancel = context.WithCancel(ctx)
	a.state = StateRunning

	go a.oodaLoop(ctx, interval)
	log.Printf("[BITAXE-OODA] Agent started (auto-tune=%v, max-temp=%.0f°C, max-freq=%dMHz)",
		a.config.AutoTune, a.config.MaxTempC, a.config.MaxFreqMHz)
}

// Stop gracefully shuts down the agent.
func (a *Agent) Stop() {
	if a.cancel != nil {
		a.cancel()
	}
	a.state = StateStopped
	<-a.done
}

// State returns the current agent state.
func (a *Agent) State() AgentState {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.state
}

// Metrics returns a snapshot of current metrics.
func (a *Agent) Metrics() AgentMetrics {
	a.mu.RLock()
	defer a.mu.RUnlock()
	m := a.metrics
	// Copy the map
	m.DecisionCounts = make(map[string]int)
	for k, v := range a.metrics.DecisionCounts {
		m.DecisionCounts[k] = v
	}
	return m
}

// RecentDecisions returns the last N decisions (newest first).
func (a *Agent) RecentDecisions(n int) []Decision {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if n <= 0 || a.metrics.TotalCycles == 0 {
		return nil
	}
	count := int(a.metrics.TotalCycles)
	if count > 50 {
		count = 50
	}
	if n > count {
		n = count
	}
	out := make([]Decision, n)
	for i := 0; i < n; i++ {
		idx := (a.decIdx - 1 - i + 50) % 50
		out[i] = a.decisions[idx]
	}
	return out
}

// ───────────────────── OODA Loop ──────────────────────────

func (a *Agent) oodaLoop(ctx context.Context, interval time.Duration) {
	defer close(a.done)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run first cycle immediately
	a.executeCycle(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.executeCycle(ctx)
		}
	}
}

func (a *Agent) executeCycle(ctx context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.metrics.TotalCycles++

	// OBSERVE — read latest stats from Client cache
	s := a.client.Latest()

	// Feed the pet
	a.pet.Feed(s)

	if !s.Online {
		d := Decision{
			Action:     "alert",
			Reason:     "device unreachable",
			Confidence: 0.95,
			Timestamp:  time.Now(),
		}
		a.state = StateAlert
		a.recordDecision(d)
		return
	}

	// ORIENT — update running averages
	n := float64(a.metrics.TotalCycles)
	a.metrics.AvgHashRate = (a.metrics.AvgHashRate*(n-1) + s.HashRate) / n
	a.metrics.AvgTemp = (a.metrics.AvgTemp*(n-1) + s.Temp) / n
	eff := s.Efficiency()
	if eff > 0 {
		a.metrics.AvgEfficiency = (a.metrics.AvgEfficiency*(n-1) + eff) / n
	}

	// DECIDE
	d := a.decide(s)

	// ACT
	if a.config.AutoTune {
		a.act(ctx, d, s)
	}

	a.recordDecision(d)
}

func (a *Agent) decide(s *Stats) Decision {
	d := Decision{
		Action:     "hold",
		Reason:     "nominal operation",
		Confidence: 1.0,
		Timestamp:  time.Now(),
	}

	// Critical: Overheat protection
	if s.Temp > a.config.MaxTempC {
		d.Action = "tune_down"
		d.Reason = fmt.Sprintf("temp %.1f°C exceeds max %.0f°C — reducing freq", s.Temp, a.config.MaxTempC)
		d.Confidence = 0.99
		a.state = StateTuning
		return d
	}

	// Warning: Getting warm, increase fan
	if s.Temp > a.config.WarnTempC {
		d.Action = "tune_down"
		d.Reason = fmt.Sprintf("temp %.1f°C approaching limit — boosting fan", s.Temp)
		d.Confidence = 0.85
		return d
	}

	// Efficiency-first: if we're cool and stable, reduce voltage before ever
	// considering higher clocks. This keeps Gamma 602 closer to the sweet spot.
	if s.Temp < (a.config.WarnTempC-5) &&
		s.UptimeSeconds > 180 &&
		s.SharesRejected == 0 &&
		s.CoreVoltage > a.config.MinVoltageMV {
		d.Action = "undervolt"
		d.Reason = fmt.Sprintf("temp %.1f°C stable with 0 rejects — reducing core voltage", s.Temp)
		d.Confidence = 0.75
		a.state = StateTuning
		return d
	}

	// High reject rate
	total := s.SharesAccepted + s.SharesRejected
	if total > 20 {
		ratio := float64(s.SharesAccepted) / float64(total)
		if ratio < 0.90 {
			d.Action = "tune_down"
			d.Reason = fmt.Sprintf("reject rate %.1f%% too high — reducing freq", (1-ratio)*100)
			d.Confidence = 0.8
			return d
		}
	}

	// Zero hashrate but device online
	if s.HashRate == 0 && s.UptimeSeconds > 120 {
		d.Action = "restart"
		d.Reason = "zero hashrate after 2+ minutes"
		d.Confidence = 0.9
		return d
	}

	a.state = StateRunning
	return d
}

func (a *Agent) act(ctx context.Context, d Decision, s *Stats) {
	switch d.Action {
	case "hold":
		// Nothing

	case "tune_down":
		if s.Temp > a.config.MaxTempC {
			// Reduce frequency
			newFreq := s.Frequency - 25
			if newFreq < a.config.MinFreqMHz {
				newFreq = a.config.MinFreqMHz
			}
			if err := a.client.SetFrequency(ctx, newFreq); err != nil {
				log.Printf("[BITAXE-OODA] tune_down freq failed: %v", err)
			}
			// Max fan
			if err := a.client.SetFanSpeed(ctx, 100); err != nil {
				log.Printf("[BITAXE-OODA] tune_down fan failed: %v", err)
			}
		} else {
			// Just bump fan a bit
			newFan := s.FanPercent + 10
			if newFan > 100 {
				newFan = 100
			}
			if err := a.client.SetFanSpeed(ctx, newFan); err != nil {
				log.Printf("[BITAXE-OODA] fan bump failed: %v", err)
			}
		}

	case "tune_up":
		newFreq := s.Frequency + 25
		if newFreq > a.config.MaxFreqMHz {
			newFreq = a.config.MaxFreqMHz
		}
		if err := a.client.SetFrequency(ctx, newFreq); err != nil {
			log.Printf("[BITAXE-OODA] tune_up failed: %v", err)
		}

	case "undervolt":
		step := a.config.VoltageStepMV
		if step <= 0 {
			step = 50
		}
		newMV := s.CoreVoltage - step
		if newMV < a.config.MinVoltageMV {
			newMV = a.config.MinVoltageMV
		}
		if err := a.client.SetCoreVoltage(ctx, newMV); err != nil {
			log.Printf("[BITAXE-OODA] undervolt failed: %v", err)
		}

	case "restart":
		if err := a.client.Restart(ctx); err != nil {
			log.Printf("[BITAXE-OODA] restart failed: %v", err)
		}
	}
}

func (a *Agent) recordDecision(d Decision) {
	a.metrics.DecisionCounts[d.Action]++
	a.metrics.LastDecision = &d
	a.decisions[a.decIdx%50] = d
	a.decIdx++
}

// FormatStatus returns a Telegram-friendly OODA status string.
func (a *Agent) FormatStatus() string {
	a.mu.RLock()
	defer a.mu.RUnlock()

	m := a.metrics
	lastAction := "—"
	lastReason := "—"
	if m.LastDecision != nil {
		lastAction = m.LastDecision.Action
		lastReason = m.LastDecision.Reason
	}

	return fmt.Sprintf(
		"🔄 **OODA Miner Agent** — `%s`\n\n"+
			"Cycles:     `%d`\n"+
			"Avg HR:     `%.1f GH/s`\n"+
			"Avg Temp:   `%.1f°C`\n"+
			"Avg Eff:    `%.2f GH/J`\n"+
			"Auto-tune:  `%v`\n"+
			"Last action:`%s`\n"+
			"Reason:     _%s_\n\n"+
			"Decisions: hold=%d tune_up=%d tune_down=%d undervolt=%d alert=%d restart=%d",
		string(a.state),
		m.TotalCycles,
		m.AvgHashRate,
		m.AvgTemp,
		m.AvgEfficiency,
		a.config.AutoTune,
		lastAction,
		lastReason,
		m.DecisionCounts["hold"],
		m.DecisionCounts["tune_up"],
		m.DecisionCounts["tune_down"],
		m.DecisionCounts["undervolt"],
		m.DecisionCounts["alert"],
		m.DecisionCounts["restart"],
	)
}
