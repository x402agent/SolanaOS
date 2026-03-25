// Package hardware — HardwareAdapter.
//
// HardwareAdapter connects the Arduino Modulino® I2C sensor cluster to the
// MawdBot OODA agent lifecycle.  It implements agent.AgentHooks so the agent
// core never needs to know about I2C — the adapter handles everything:
//
//   Pixels LEDs  → visual status (idle/signal/trade/win/loss/error)
//   Buzzer       → audio alerts (signal beep, trade open, win/loss, error)
//   Buttons      → human control (trigger cycle / toggle mode / emergency stop)
//   Knob         → real-time RSI param tuning (turn left/right)
//   Thermo       → environment logging (temp+humidity to vault every N cycles)
//   Distance     → proximity alert (< 5cm = shake the agent awake)
//   Motion       → tilt detection (severe tilt = pause trading)
//
// Everything degrades gracefully when sensors are not physically connected.
package hardware

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// ── Adapter config ────────────────────────────────────────────────────

// AdapterConfig controls how the hardware responds.
type AdapterConfig struct {
	// I2C bus number (1 on Orin Nano, Raspberry Pi; 0 on some others)
	I2CBusNum int

	// ButtonPollInterval — how often to sample button state
	ButtonPollInterval time.Duration

	// KnobPollInterval — how often to sample knob position
	KnobPollInterval time.Duration

	// ThermoLogInterval — how often to log environment to vault
	ThermoLogInterval time.Duration

	// DistanceAlertMM — trigger proximity alert below this distance
	DistanceAlertMM uint16

	// TiltAlertDeg — pause trading if absolute pitch/roll exceeds this
	TiltAlertDeg float64

	// BreatheInterval — idle LED pulse period
	BreatheInterval time.Duration

	// RSIKnobStep — RSI overbought/oversold delta per encoder tick
	RSIKnobStep int
}

// DefaultAdapterConfig returns sane defaults for Orin Nano.
func DefaultAdapterConfig() AdapterConfig {
	return AdapterConfig{
		I2CBusNum:          1,
		ButtonPollInterval: 100 * time.Millisecond,
		KnobPollInterval:   200 * time.Millisecond,
		ThermoLogInterval:  5 * time.Minute,
		DistanceAlertMM:    50,
		TiltAlertDeg:       45.0,
		BreatheInterval:    2 * time.Second,
		RSIKnobStep:        1,
	}
}

// ── Agent control callbacks ───────────────────────────────────────────

// AgentControls is the set of callbacks the adapter calls back into the
// OODA agent when a physical control is actuated.
type AgentControls struct {
	// TriggerCycle forces an immediate OODA observation cycle.
	TriggerCycle func()

	// SetMode switches the agent between "simulated" and "live".
	SetMode func(mode string)

	// EmergencyStop halts the agent and closes all open positions.
	EmergencyStop func()

	// AdjustRSI nudges the RSI overbought/oversold thresholds by delta
	// (positive = more conservative, negative = more aggressive).
	AdjustRSI func(delta int)
}

// ── HardwareAdapter ───────────────────────────────────────────────────

// HardwareAdapter implements agent.AgentHooks and drives the Modulino cluster.
// It also owns a background goroutine that polls physical inputs and calls
// back into the agent via AgentControls.
type HardwareAdapter struct {
	mu       sync.Mutex
	cfg      AdapterConfig
	hub      *HardwareHub   // nil if no hardware connected
	controls AgentControls

	// state
	currentStatus  string
	currentMode    string
	knobLastPos    int32
	lastThermo     time.Time
	tiltPaused     bool

	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewHardwareAdapter creates an adapter.  It attempts to open the I2C bus and
// scan for Modulino nodes.  If no hardware is found (e.g. dev machine), it
// operates in silent stub mode — all AgentHooks calls are no-ops.
func NewHardwareAdapter(cfg AdapterConfig, controls AgentControls) *HardwareAdapter {
	a := &HardwareAdapter{
		cfg:      cfg,
		controls: controls,
		stopCh:   make(chan struct{}),
	}

	hub, err := NewHardwareHub(cfg.I2CBusNum)
	if err != nil {
		log.Printf("[HW] No I2C hardware detected (bus %d): %v — running in stub mode", cfg.I2CBusNum, err)
		return a
	}

	found := hub.ListAvailable()
	if len(found) == 0 {
		log.Printf("[HW] I2C bus open but no Modulino® sensors found — stub mode")
		hub.Close()
		return a
	}

	log.Printf("[HW] Modulino® sensors detected: %v", found)
	a.hub = hub
	return a
}

// Start launches the input-polling goroutines.
func (a *HardwareAdapter) Start() {
	if a.hub == nil {
		return
	}

	a.wg.Add(3)
	go a.pollButtons()
	go a.pollKnob()
	go a.pollEnvironment()

	// Startup animation
	a.playStartup()
}

// Stop shuts down polling goroutines and clears hardware state.
func (a *HardwareAdapter) Stop() {
	close(a.stopCh)
	a.wg.Wait()
	if a.hub != nil {
		if a.hub.Pixels != nil {
			a.hub.Pixels.Clear()
		}
		a.hub.Close()
	}
}

// IsConnected reports whether physical hardware is available.
func (a *HardwareAdapter) IsConnected() bool {
	return a.hub != nil
}

// ConnectedSensors returns a list of detected sensor names.
func (a *HardwareAdapter) ConnectedSensors() []string {
	if a.hub == nil {
		return nil
	}
	return a.hub.ListAvailable()
}

// ── AgentHooks implementation ─────────────────────────────────────────

func (a *HardwareAdapter) OnAgentStart(mode string, watchlist []string) {
	a.mu.Lock()
	a.currentMode = mode
	a.mu.Unlock()

	log.Printf("[HW] Agent started: mode=%s watchlist=%v", mode, watchlist)

	if a.hub == nil {
		return
	}

	// Show mode on button LEDs: LED1=simulated, LED2=live
	if a.hub.Buttons != nil {
		live := mode == "live"
		a.hub.Buttons.SetLEDs(!live, live, false)
	}

	a.setStatus("running")
}

func (a *HardwareAdapter) OnAgentStop() {
	log.Printf("[HW] Agent stopped")
	if a.hub == nil {
		return
	}
	a.setStatus("idle")
	if a.hub.Buttons != nil {
		a.hub.Buttons.SetLEDs(false, false, false)
	}
}

func (a *HardwareAdapter) OnCycleStart(cycleNum int, solPrice float64) {
	if a.hub == nil {
		return
	}
	// Brief white flash on first LED to show activity
	if a.hub.Pixels != nil {
		a.hub.Pixels.Set(0, RGB{255, 255, 255})
		a.hub.Pixels.Show()
		go func() {
			time.Sleep(80 * time.Millisecond)
			a.mu.Lock()
			status := a.currentStatus
			a.mu.Unlock()
			a.setStatus(status)
		}()
	}
}

func (a *HardwareAdapter) OnCycleEnd(cycleNum int, openPositions int) {
	if a.hub == nil {
		return
	}
	// Show open position count as a progress bar (0-8 LEDs)
	if a.hub.Pixels != nil && openPositions > 0 {
		fraction := float64(openPositions) / 8.0
		if fraction > 1 {
			fraction = 1
		}
		a.hub.Pixels.ShowStatus("bar", fraction)
	}
}

func (a *HardwareAdapter) OnSignalDetected(symbol, direction string, strength, confidence float64) {
	log.Printf("[HW] 📡 Signal: %s %s (str=%.2f conf=%.2f)", direction, symbol, strength, confidence)
	if a.hub == nil {
		return
	}

	a.setStatus("signal")

	// Buzzer: double beep for signal
	if a.hub.Buzzer != nil {
		go func() {
			a.hub.Buzzer.BeepSignal()
			time.Sleep(150 * time.Millisecond)
			a.hub.Buzzer.BeepSignal()
		}()
	}

	// Flash: strength drives brightness
	if a.hub.Pixels != nil {
		bright := uint8(strength * 200)
		if direction == "long" {
			a.hub.Pixels.SetAll(RGB{0, bright, bright / 2})
		} else {
			a.hub.Pixels.SetAll(RGB{bright, 0, bright / 2})
		}
		a.hub.Pixels.Show()
		go func() {
			time.Sleep(500 * time.Millisecond)
			a.setStatus("running")
		}()
	}
}

func (a *HardwareAdapter) OnTradeOpen(symbol, direction string, price, sizeSOL float64) {
	log.Printf("[HW] 📈 Trade open: %s %s $%.6f (%.4f SOL)", direction, symbol, price, sizeSOL)
	if a.hub == nil {
		return
	}

	a.setStatus("trade")

	if a.hub.Buzzer != nil {
		go a.hub.Buzzer.BeepTrade()
	}
}

func (a *HardwareAdapter) OnTradeClose(symbol, direction string, pnlPct float64, outcome, reason string) {
	log.Printf("[HW] 📉 Trade close: %s %s PnL=%.2f%% (%s) [%s]", direction, symbol, pnlPct, outcome, reason)
	if a.hub == nil {
		return
	}

	if outcome == "win" {
		a.setStatus("idle") // will override below
		if a.hub.Pixels != nil {
			// Victory flash: sweep green left to right
			go func() {
				for i := 0; i < 8; i++ {
					a.hub.Pixels.Set(i, ColorWin)
					a.hub.Pixels.Show()
					time.Sleep(60 * time.Millisecond)
				}
				time.Sleep(400 * time.Millisecond)
				a.setStatus("running")
			}()
		}
		if a.hub.Buzzer != nil {
			go a.hub.Buzzer.BeepWin()
		}
	} else {
		if a.hub.Pixels != nil {
			// Loss flash: all red twice
			go func() {
				for i := 0; i < 2; i++ {
					a.hub.Pixels.SetAll(ColorLoss)
					a.hub.Pixels.Show()
					time.Sleep(250 * time.Millisecond)
					a.hub.Pixels.Clear()
					time.Sleep(150 * time.Millisecond)
				}
				a.setStatus("running")
			}()
		}
		if a.hub.Buzzer != nil {
			go a.hub.Buzzer.BeepLoss()
		}
	}
}

func (a *HardwareAdapter) OnLearningCycle(winRate, avgPnL float64, tradeCount int) {
	log.Printf("[HW] 🧠 Learning: wr=%.1f%% pnl=%.2f%% trades=%d", winRate*100, avgPnL, tradeCount)
	if a.hub == nil {
		return
	}

	// Purple pulse = brain thinking
	if a.hub.Pixels != nil {
		go func() {
			for i := 0; i < 3; i++ {
				a.hub.Pixels.SetAll(ColorSignal)
				a.hub.Pixels.Show()
				time.Sleep(200 * time.Millisecond)
				a.hub.Pixels.Clear()
				time.Sleep(200 * time.Millisecond)
			}
			a.setStatus("running")
		}()
	}
}

func (a *HardwareAdapter) OnParamsUpdated(reason string) {
	log.Printf("[HW] ⚡ Params updated: %s", reason)
	if a.hub == nil {
		return
	}
	// Amber flash on all LEDs
	if a.hub.Pixels != nil {
		go func() {
			a.hub.Pixels.SetAll(RGB{255, 170, 0})
			a.hub.Pixels.Show()
			time.Sleep(300 * time.Millisecond)
			a.setStatus("running")
		}()
	}
}

func (a *HardwareAdapter) OnError(context string, err error) {
	log.Printf("[HW] ❌ Error [%s]: %v", context, err)
	if a.hub == nil {
		return
	}
	a.setStatus("error")
	if a.hub.Buzzer != nil {
		go a.hub.Buzzer.BeepError()
	}
	// Auto-clear error status after 3s
	go func() {
		time.Sleep(3 * time.Second)
		a.setStatus("running")
	}()
}

func (a *HardwareAdapter) OnHeartbeat(cycleCount int, openPositions int) {
	if a.hub == nil {
		return
	}
	// Dim heartbeat pulse on LED 7 (last)
	if a.hub.Pixels != nil {
		go func() {
			a.hub.Pixels.Set(7, RGB{0, 40, 0})
			a.hub.Pixels.Show()
			time.Sleep(100 * time.Millisecond)
			a.hub.Pixels.Set(7, RGB{0, 5, 0})
			a.hub.Pixels.Show()
		}()
	}
}

// ── Input polling goroutines ──────────────────────────────────────────

func (a *HardwareAdapter) pollButtons() {
	defer a.wg.Done()
	if a.hub == nil || a.hub.Buttons == nil {
		return
	}

	ticker := time.NewTicker(a.cfg.ButtonPollInterval)
	defer ticker.Stop()

	var prevState ButtonState

	for {
		select {
		case <-a.stopCh:
			return
		case <-ticker.C:
			state, err := a.hub.Buttons.Read()
			if err != nil {
				continue
			}

			// Detect rising edges (button press, not hold)
			b1Pressed := state.Button1 && !prevState.Button1
			b2Pressed := state.Button2 && !prevState.Button2
			b3Pressed := state.Button3 && !prevState.Button3

			if b1Pressed {
				log.Printf("[HW] 🔘 Button A — triggering OODA cycle")
				// Short confirm beep
				if a.hub.Buzzer != nil {
					go a.hub.Buzzer.Tone(1000, 80)
				}
				if a.controls.TriggerCycle != nil {
					go a.controls.TriggerCycle()
				}
			}

			if b2Pressed {
				// Toggle simulated ↔ live
				a.mu.Lock()
				newMode := "live"
				if a.currentMode == "live" {
					newMode = "simulated"
				}
				a.currentMode = newMode
				a.mu.Unlock()

				log.Printf("[HW] 🔘 Button B — mode → %s", newMode)
				if a.hub.Buzzer != nil {
					go a.hub.Buzzer.Tone(800, 150)
				}
				// Update button LEDs
				live := newMode == "live"
				a.hub.Buttons.SetLEDs(!live, live, false)

				if a.controls.SetMode != nil {
					go a.controls.SetMode(newMode)
				}
			}

			if b3Pressed {
				// Hold B3 for 1s = emergency stop
				log.Printf("[HW] 🔘 Button C — emergency stop")
				if a.hub.Buzzer != nil {
					go func() {
						a.hub.Buzzer.Tone(300, 100)
						time.Sleep(120 * time.Millisecond)
						a.hub.Buzzer.Tone(200, 300)
					}()
				}
				a.hub.Buttons.SetLEDs(false, false, true)
				if a.controls.EmergencyStop != nil {
					go a.controls.EmergencyStop()
				}
			}

			prevState = *state
		}
	}
}

func (a *HardwareAdapter) pollKnob() {
	defer a.wg.Done()
	if a.hub == nil || a.hub.Knob == nil {
		return
	}

	ticker := time.NewTicker(a.cfg.KnobPollInterval)
	defer ticker.Stop()

	// Seed initial position
	if state, err := a.hub.Knob.Read(); err == nil {
		a.knobLastPos = state.Position
	}

	for {
		select {
		case <-a.stopCh:
			return
		case <-ticker.C:
			state, err := a.hub.Knob.Read()
			if err != nil {
				continue
			}

			delta := state.Position - a.knobLastPos
			if delta != 0 {
				a.knobLastPos = state.Position
				// Each encoder tick adjusts RSI by RSIKnobStep
				rsiDelta := int(delta) * a.cfg.RSIKnobStep
				log.Printf("[HW] 🎛 Knob delta=%d → RSI adjust %+d", delta, rsiDelta)
				if a.controls.AdjustRSI != nil {
					go a.controls.AdjustRSI(rsiDelta)
				}
				// Teal flash to confirm
				if a.hub.Pixels != nil {
					go func() {
						a.hub.Pixels.Set(3, ColorTrade)
						a.hub.Pixels.Set(4, ColorTrade)
						a.hub.Pixels.Show()
						time.Sleep(200 * time.Millisecond)
						a.setStatus(a.currentStatus)
					}()
				}
			}

			// Knob press = reset RSI to defaults
			if state.Pressed {
				log.Printf("[HW] 🎛 Knob pressed — resetting RSI to defaults")
				if a.hub.Buzzer != nil {
					go a.hub.Buzzer.Tone(1200, 100)
				}
				if a.controls.AdjustRSI != nil {
					go a.controls.AdjustRSI(0) // 0 = reset signal
				}
			}
		}
	}
}

func (a *HardwareAdapter) pollEnvironment() {
	defer a.wg.Done()
	if a.hub == nil {
		return
	}

	thermoTicker := time.NewTicker(a.cfg.ThermoLogInterval)
	sensorTicker := time.NewTicker(500 * time.Millisecond)
	defer thermoTicker.Stop()
	defer sensorTicker.Stop()

	for {
		select {
		case <-a.stopCh:
			return

		case <-thermoTicker.C:
			if a.hub.Thermo != nil {
				if data, err := a.hub.Thermo.Read(); err == nil {
					log.Printf("[HW] 🌡 Environment: %.1f°C  %.1f%%RH", data.Temperature, data.Humidity)
				}
			}

		case <-sensorTicker.C:
			// Distance: proximity alert
			if a.hub.Distance != nil && a.hub.Distance.Available() {
				if mm, err := a.hub.Distance.ReadMM(); err == nil {
					if mm < a.cfg.DistanceAlertMM && mm > 0 {
						log.Printf("[HW] ⚡ Proximity alert: %dmm", mm)
						if a.hub.Buzzer != nil {
							go a.hub.Buzzer.Tone(2000, 50)
						}
					}
				}
			}

			// Motion: tilt detection
			if a.hub.Movement != nil {
				if data, err := a.hub.Movement.Read(); err == nil {
					severe := absFloat(data.Pitch) > a.cfg.TiltAlertDeg ||
						absFloat(data.Roll) > a.cfg.TiltAlertDeg

					a.mu.Lock()
					waspaused := a.tiltPaused
					a.tiltPaused = severe
					a.mu.Unlock()

					if severe && !waspaused {
						log.Printf("[HW] ⚠ Tilt alert: pitch=%.1f° roll=%.1f° — trading paused",
							data.Pitch, data.Roll)
						a.setStatus("error")
					} else if !severe && waspaused {
						log.Printf("[HW] ✓ Tilt resolved — resuming")
						a.setStatus("running")
					}
				}
			}
		}
	}
}

// IsTiltPaused reports whether the device is tilted beyond safe limits.
// The OODA agent should check this before executing live trades.
func (a *HardwareAdapter) IsTiltPaused() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.tiltPaused
}

// ── LED status helpers ────────────────────────────────────────────────

func (a *HardwareAdapter) setStatus(status string) {
	if a.hub == nil || a.hub.Pixels == nil {
		return
	}
	a.mu.Lock()
	a.currentStatus = status
	a.mu.Unlock()
	a.hub.Pixels.ShowStatus(status, 0)
}

func (a *HardwareAdapter) playStartup() {
	if a.hub == nil {
		return
	}

	if a.hub.Buzzer != nil {
		go func() {
			a.hub.Buzzer.BeepStartup()
			time.Sleep(200 * time.Millisecond)
			a.hub.Buzzer.Tone(1200, 100)
			time.Sleep(150 * time.Millisecond)
			a.hub.Buzzer.Tone(1600, 200)
		}()
	}

	if a.hub.Pixels != nil {
		go func() {
			// Cylon sweep: green left→right→left
			colors := []RGB{
				ColorRunning, ColorSignal, ColorTrade, ColorWin,
				ColorWin, ColorTrade, ColorSignal, ColorRunning,
			}
			for rep := 0; rep < 2; rep++ {
				for i, c := range colors {
					a.hub.Pixels.Clear()
					a.hub.Pixels.Set(i%8, c)
					a.hub.Pixels.Show()
					time.Sleep(80 * time.Millisecond)
				}
			}
			a.hub.Pixels.SetAll(ColorRunning)
			a.hub.Pixels.Show()
			time.Sleep(400 * time.Millisecond)
			a.setStatus("idle")
		}()
	}
}

// ── Environment snapshot ──────────────────────────────────────────────

// EnvironmentSnapshot returns a map of current sensor readings.
// Can be stored to ClawVault for context-aware trading.
func (a *HardwareAdapter) EnvironmentSnapshot() map[string]interface{} {
	if a.hub == nil {
		return nil
	}
	env := a.hub.GetEnvironment()
	env["hw_connected"] = true
	env["hw_sensors"] = a.hub.ListAvailable()
	env["tilt_paused"] = a.IsTiltPaused()
	env["timestamp"] = time.Now().Unix()
	return env
}

// ── Display helpers ───────────────────────────────────────────────────

// ShowSOLPrice encodes the SOL price change as a pixel bar.
// green = up, red = down, brightness = magnitude.
func (a *HardwareAdapter) ShowSOLPrice(changePct float64) {
	if a.hub == nil || a.hub.Pixels == nil {
		return
	}
	mag := changePct
	if mag < 0 {
		mag = -mag
	}
	bright := uint8(mag * 25) // 4% change = full brightness
	if bright > 255 {
		bright = 255
	}
	if changePct >= 0 {
		a.hub.Pixels.SetAll(RGB{0, bright, bright / 4})
	} else {
		a.hub.Pixels.SetAll(RGB{bright, 0, 0})
	}
	a.hub.Pixels.Show()
}

// ShowPnL encodes unrealized PnL across the 8-pixel strip.
// LEDs 0-3 show loss magnitude (red), LEDs 4-7 show profit (green).
func (a *HardwareAdapter) ShowPnL(pnlPct float64) {
	if a.hub == nil || a.hub.Pixels == nil {
		return
	}
	a.hub.Pixels.Clear()
	if pnlPct >= 0 {
		lit := int(pnlPct / 5.0) // 5% per LED
		if lit > 4 {
			lit = 4
		}
		for i := 4; i < 4+lit; i++ {
			a.hub.Pixels.Set(i, ColorWin)
		}
	} else {
		lit := int(-pnlPct / 5.0)
		if lit > 4 {
			lit = 4
		}
		for i := 3; i >= 4-lit; i-- {
			a.hub.Pixels.Set(i, ColorLoss)
		}
	}
	a.hub.Pixels.Show()
}

// PrintStatus writes a human-readable sensor summary to the log.
func (a *HardwareAdapter) PrintStatus() {
	if a.hub == nil {
		fmt.Println("[HW] No hardware connected (stub mode)")
		return
	}
	sensors := a.hub.ListAvailable()
	fmt.Printf("[HW] Connected sensors (%d): %v\n", len(sensors), sensors)

	if a.hub.Thermo != nil {
		if data, err := a.hub.Thermo.Read(); err == nil {
			fmt.Printf("  Thermo:   %.1f°C  %.1f%%RH\n", data.Temperature, data.Humidity)
		}
	}
	if a.hub.Distance != nil {
		if mm, err := a.hub.Distance.ReadMM(); err == nil {
			fmt.Printf("  Distance: %dmm\n", mm)
		}
	}
	if a.hub.Movement != nil {
		if data, err := a.hub.Movement.Read(); err == nil {
			fmt.Printf("  Motion:   pitch=%.1f° roll=%.1f°\n", data.Pitch, data.Roll)
		}
	}
	if a.hub.Knob != nil {
		if state, err := a.hub.Knob.Read(); err == nil {
			fmt.Printf("  Knob:     pos=%d pressed=%v\n", state.Position, state.Pressed)
		}
	}
	if a.hub.Buttons != nil {
		if state, err := a.hub.Buttons.Read(); err == nil {
			fmt.Printf("  Buttons:  [%v %v %v]\n", state.Button1, state.Button2, state.Button3)
		}
	}
}

// ── Helpers ───────────────────────────────────────────────────────────

func absFloat(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}
