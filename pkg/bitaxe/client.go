// Package bitaxe provides a polling client for the Bitaxe AxeOS REST API.
// Compatible with Bitaxe Gamma 602 (BM1370 ASIC) and other AxeOS devices.
//
// AxeOS endpoints:
//
//	GET  http://<host>/api/system/info   — live stats
//	POST http://<host>/api/system/restart — reboot device
//	PATCH http://<host>/api/system       — update frequency, voltage, stratum, etc.
package bitaxe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// Stats mirrors the AxeOS /api/system/info response.
type Stats struct {
	HashRate        float64 `json:"hashRate"`    // GH/s
	Temp            float64 `json:"temp"`        // °C (ASIC)
	VRTemp          float64 `json:"vrTemp"`      // °C (voltage regulator)
	Power           float64 `json:"power"`       // Watts
	Voltage         float64 `json:"voltage"`     // mV input
	Current         float64 `json:"current"`     // mA
	CoreVoltage     int     `json:"coreVoltage"` // mV target
	CoreVoltageAct  int     `json:"coreVoltageActual"`
	Frequency       int     `json:"frequency"` // MHz
	SharesAccepted  int     `json:"sharesAccepted"`
	SharesRejected  int     `json:"sharesRejected"`
	BestDiff        string  `json:"bestDiff"`
	BestSessionDiff string  `json:"bestSessionDiff"`
	UptimeSeconds   int     `json:"uptimeSeconds"`
	ASICModel       string  `json:"ASICModel"`
	AsicCount       int     `json:"asicCount"`
	SmallCoreCount  int     `json:"smallCoreCount"`
	Hostname        string  `json:"hostname"`
	MacAddr         string  `json:"macAddr"`
	SSID            string  `json:"ssid"`
	WifiStatus      string  `json:"wifiStatus"`
	StratumURL      string  `json:"stratumURL"`
	StratumPort     int     `json:"stratumPort"`
	StratumUser     string  `json:"stratumUser"`
	StratumDiff     int     `json:"stratumDiff"`
	IsRunning       bool    `json:"isRunning"`
	OverheatMode    int     `json:"overheat_mode"`
	FanPercent      int     `json:"fanPercent"`
	FanRPM          int     `json:"fanrpm"`
	FreeHeap        int     `json:"freeHeap"`
	Version         string  `json:"version"`
	BoardVersion    string  `json:"boardVersion"`
	FlipScreen      int     `json:"flipScreen"`
	InvertFanPol    int     `json:"invertFanPolarity"`
	AutoFanSpeed    int     `json:"autofanspeed"`

	// Computed by client
	Online    bool      `json:"online"`
	UpdatedAt time.Time `json:"updatedAt"`
	Error     string    `json:"error,omitempty"`
}

// Efficiency returns hashrate per watt (GH/J). Returns 0 if power is zero.
func (s *Stats) Efficiency() float64 {
	if s.Power <= 0 {
		return 0
	}
	return s.HashRate / s.Power
}

// ShareAcceptRate returns accepted/(accepted+rejected) as 0-100%.
func (s *Stats) ShareAcceptRate() float64 {
	total := s.SharesAccepted + s.SharesRejected
	if total == 0 {
		return 100
	}
	return float64(s.SharesAccepted) / float64(total) * 100
}

// AlertFunc is called when an alert condition is detected.
type AlertFunc func(level AlertLevel, msg string)

// AlertLevel indicates severity.
type AlertLevel int

const (
	AlertInfo AlertLevel = iota
	AlertWarning
	AlertCritical
)

// AlertConfig defines thresholds for automated monitoring.
type AlertConfig struct {
	TempWarning       float64 // °C — warn above this (default 60)
	TempCritical      float64 // °C — critical above this (default 70)
	HashRateMinGH     float64 // GH/s — alert if drops below (default 0 = disabled)
	OfflineAfterSec   int     // seconds with no response before offline alert (default 120)
	CooldownSec       int     // minimum seconds between repeated alerts (default 300)
	ShareRejectMaxPct float64 // reject rate % threshold (default 5)
}

// DefaultAlertConfig returns sensible defaults for Bitaxe Gamma 602.
func DefaultAlertConfig() AlertConfig {
	return AlertConfig{
		TempWarning:       60,
		TempCritical:      70,
		HashRateMinGH:     0,
		OfflineAfterSec:   120,
		CooldownSec:       300,
		ShareRejectMaxPct: 5,
	}
}

// Client polls the Bitaxe AxeOS API at a fixed interval and caches the latest stats.
type Client struct {
	host     string
	interval time.Duration
	mu       sync.RWMutex
	latest   *Stats
	hc       *http.Client

	// Alerts
	alertCfg      AlertConfig
	alertFn       AlertFunc
	lastAlertTime map[string]time.Time
	wasOffline    bool

	// History (circular buffer for sparkline/trend)
	history    []Stats
	historyMax int
}

// New creates a Bitaxe client for the given host (IP or hostname, no scheme).
// pollInterval is how often to query the device; 10s is a good default.
func New(host string, pollInterval time.Duration) *Client {
	return &Client{
		host:          host,
		interval:      pollInterval,
		hc:            &http.Client{Timeout: 5 * time.Second},
		latest:        &Stats{Online: false},
		alertCfg:      DefaultAlertConfig(),
		lastAlertTime: make(map[string]time.Time),
		historyMax:    360, // 1 hour at 10s intervals
	}
}

// SetAlertConfig updates alert thresholds.
func (c *Client) SetAlertConfig(cfg AlertConfig) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.alertCfg = cfg
}

// OnAlert registers a callback for alert events.
func (c *Client) OnAlert(fn AlertFunc) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.alertFn = fn
}

// Host returns the configured host address.
func (c *Client) Host() string { return c.host }

// Start begins background polling. It is non-blocking; pass a cancellable context
// to stop it when the daemon shuts down.
func (c *Client) Start(ctx context.Context) {
	c.fetch() // immediate first poll
	go func() {
		tick := time.NewTicker(c.interval)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				c.fetch()
			}
		}
	}()
	log.Printf("[BITAXE] polling %s every %s", c.host, c.interval)
}

// Latest returns a snapshot of the most recently polled stats.
// Never returns nil — returns an offline stats struct if not yet polled.
func (c *Client) Latest() *Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	s := *c.latest // copy
	return &s
}

// Refresh performs an immediate foreground poll and returns the latest snapshot.
// This is used by interactive commands like /miner so they don't rely solely on
// the background polling cadence.
func (c *Client) Refresh() *Stats {
	c.fetch()
	return c.Latest()
}

// History returns up to the last N stat snapshots (oldest first).
func (c *Client) History(n int) []Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if n <= 0 || len(c.history) == 0 {
		return nil
	}
	start := 0
	if len(c.history) > n {
		start = len(c.history) - n
	}
	out := make([]Stats, len(c.history)-start)
	copy(out, c.history[start:])
	return out
}

// ── Control Methods (AxeOS REST API) ─────────────────────────────────

// Restart sends a restart command to the Bitaxe device.
func (c *Client) Restart(ctx context.Context) error {
	url := fmt.Sprintf("http://%s/api/system/restart", c.host)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return fmt.Errorf("bitaxe restart: %w", err)
	}
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("bitaxe restart: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("bitaxe restart: HTTP %d", resp.StatusCode)
	}
	log.Printf("[BITAXE] restart command sent to %s", c.host)
	return nil
}

// SetFrequency changes the ASIC clock frequency (MHz).
// Typical range for BM1370: 400-600 MHz.
func (c *Client) SetFrequency(ctx context.Context, mhz int) error {
	return c.patchSystem(ctx, map[string]any{"frequency": mhz})
}

// SetCoreVoltage changes the ASIC core voltage (mV).
// Typical range for BM1370: 1100-1300 mV.
func (c *Client) SetCoreVoltage(ctx context.Context, mv int) error {
	return c.patchSystem(ctx, map[string]any{"coreVoltage": mv})
}

// SetFanSpeed sets the fan speed percentage (0-100). Set to 0 for auto.
func (c *Client) SetFanSpeed(ctx context.Context, pct int) error {
	return c.patchSystem(ctx, map[string]any{"fanPercent": pct})
}

// SetStratumURL updates the pool stratum URL and port.
func (c *Client) SetStratumURL(ctx context.Context, url string, port int) error {
	return c.patchSystem(ctx, map[string]any{"stratumURL": url, "stratumPort": port})
}

// SetStratumUser updates the pool username (BTC address).
func (c *Client) SetStratumUser(ctx context.Context, user string) error {
	return c.patchSystem(ctx, map[string]any{"stratumUser": user})
}

func (c *Client) patchSystem(ctx context.Context, payload map[string]any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("bitaxe patch: %w", err)
	}
	url := fmt.Sprintf("http://%s/api/system", c.host)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("bitaxe patch: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("bitaxe patch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("bitaxe patch: HTTP %d", resp.StatusCode)
	}
	log.Printf("[BITAXE] patched system on %s: %s", c.host, string(body))
	return nil
}

// ── Internal ─────────────────────────────────────────────────────────

func (c *Client) fetch() {
	url := fmt.Sprintf("http://%s/api/system/info", c.host)
	resp, err := c.hc.Get(url)
	if err != nil {
		c.mu.Lock()
		c.latest.Online = false
		c.latest.UpdatedAt = time.Now()
		c.latest.Error = err.Error()
		c.mu.Unlock()
		c.checkAlerts(&Stats{Online: false, Error: err.Error(), UpdatedAt: time.Now()})
		return
	}
	defer resp.Body.Close()

	var s Stats
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		c.mu.Lock()
		c.latest.Online = false
		c.latest.UpdatedAt = time.Now()
		c.latest.Error = "decode: " + err.Error()
		c.mu.Unlock()
		return
	}

	s.Online = s.IsRunning || s.HashRate > 0
	s.UpdatedAt = time.Now()
	s.Error = ""

	c.mu.Lock()
	c.latest = &s
	// Append to history ring buffer
	if c.history == nil {
		c.history = make([]Stats, 0, c.historyMax)
	}
	if len(c.history) >= c.historyMax {
		c.history = c.history[1:]
	}
	c.history = append(c.history, s)
	c.mu.Unlock()

	c.checkAlerts(&s)
}

func (c *Client) checkAlerts(s *Stats) {
	c.mu.RLock()
	fn := c.alertFn
	cfg := c.alertCfg
	c.mu.RUnlock()

	if fn == nil {
		return
	}

	now := time.Now()
	cooldown := time.Duration(cfg.CooldownSec) * time.Second

	fire := func(key string, level AlertLevel, msg string) {
		c.mu.Lock()
		last, exists := c.lastAlertTime[key]
		if exists && now.Sub(last) < cooldown {
			c.mu.Unlock()
			return
		}
		c.lastAlertTime[key] = now
		c.mu.Unlock()
		fn(level, msg)
	}

	// Offline detection
	if !s.Online {
		if !c.wasOffline {
			c.wasOffline = true
			fire("offline", AlertCritical, fmt.Sprintf("Bitaxe OFFLINE — cannot reach %s", c.host))
		}
		return
	}
	if c.wasOffline {
		c.wasOffline = false
		fire("online", AlertInfo, fmt.Sprintf("Bitaxe back ONLINE — %s (%.1f GH/s)", c.host, s.HashRate))
	}

	// Temperature alerts
	if cfg.TempCritical > 0 && s.Temp >= cfg.TempCritical {
		fire("temp_crit", AlertCritical, fmt.Sprintf("CRITICAL TEMP: %.1f°C (threshold: %.0f°C) — consider reducing frequency or restarting", s.Temp, cfg.TempCritical))
	} else if cfg.TempWarning > 0 && s.Temp >= cfg.TempWarning {
		fire("temp_warn", AlertWarning, fmt.Sprintf("High temp: %.1f°C (threshold: %.0f°C)", s.Temp, cfg.TempWarning))
	}

	// Hashrate drop
	if cfg.HashRateMinGH > 0 && s.HashRate < cfg.HashRateMinGH {
		fire("hashrate_low", AlertWarning, fmt.Sprintf("Hashrate dropped: %.1f GH/s (min: %.1f GH/s)", s.HashRate, cfg.HashRateMinGH))
	}

	// Share reject rate
	total := s.SharesAccepted + s.SharesRejected
	if cfg.ShareRejectMaxPct > 0 && total > 10 {
		rejectPct := float64(s.SharesRejected) / float64(total) * 100
		if rejectPct > cfg.ShareRejectMaxPct {
			fire("reject_rate", AlertWarning, fmt.Sprintf("High share reject rate: %.1f%% (%d rejected of %d)", rejectPct, s.SharesRejected, total))
		}
	}
}
