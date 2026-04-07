// Package agent — AgentHooks interface.
// Hardware adapters, loggers, and telemetry sinks implement this to receive
// real-time OODA lifecycle events without coupling into the agent core.
package agent

// AgentHooks is the event bus between the OODA loop and external systems.
// All methods are called synchronously from the agent goroutine — keep them fast.
// Use go func() inside if you need async work (e.g. I2C writes).
type AgentHooks interface {
	// Lifecycle
	OnAgentStart(mode string, watchlist []string)
	OnAgentStop()
	OnCycleStart(cycleNum int, solPrice float64)
	OnCycleEnd(cycleNum int, openPositions int)

	// Signals
	OnSignalDetected(symbol, direction string, strength, confidence float64)

	// Positions
	OnTradeOpen(symbol, direction string, price, sizeSOL float64)
	OnTradeClose(symbol, direction string, pnlPct float64, outcome, reason string)

	// Learning
	OnLearningCycle(winRate, avgPnL float64, tradeCount int)
	OnParamsUpdated(reason string)

	// Health
	OnError(context string, err error)
	OnHeartbeat(cycleCount int, openPositions int)
}

// NoopHooks is the default implementation — all methods are silent.
// Embed in partial implementations so you only override what you need.
type NoopHooks struct{}

func (NoopHooks) OnAgentStart(_ string, _ []string)                               {}
func (NoopHooks) OnAgentStop()                                                    {}
func (NoopHooks) OnCycleStart(_ int, _ float64)                                   {}
func (NoopHooks) OnCycleEnd(_ int, _ int)                                         {}
func (NoopHooks) OnSignalDetected(_ string, _ string, _ float64, _ float64)       {}
func (NoopHooks) OnTradeOpen(_ string, _ string, _ float64, _ float64)            {}
func (NoopHooks) OnTradeClose(_ string, _ string, _ float64, _ string, _ string)  {}
func (NoopHooks) OnLearningCycle(_ float64, _ float64, _ int)                     {}
func (NoopHooks) OnParamsUpdated(_ string)                                        {}
func (NoopHooks) OnError(_ string, _ error)                                       {}
func (NoopHooks) OnHeartbeat(_ int, _ int)                                        {}

// MultiHooks fans out a single event to multiple hook implementations.
// Useful when you want both hardware + logging + telemetry simultaneously.
type MultiHooks []AgentHooks

func NewMultiHooks(hooks ...AgentHooks) MultiHooks { return MultiHooks(hooks) }

func (m MultiHooks) OnAgentStart(mode string, wl []string) {
	for _, h := range m { h.OnAgentStart(mode, wl) }
}
func (m MultiHooks) OnAgentStop() {
	for _, h := range m { h.OnAgentStop() }
}
func (m MultiHooks) OnCycleStart(n int, sol float64) {
	for _, h := range m { h.OnCycleStart(n, sol) }
}
func (m MultiHooks) OnCycleEnd(n int, pos int) {
	for _, h := range m { h.OnCycleEnd(n, pos) }
}
func (m MultiHooks) OnSignalDetected(sym, dir string, str, conf float64) {
	for _, h := range m { h.OnSignalDetected(sym, dir, str, conf) }
}
func (m MultiHooks) OnTradeOpen(sym, dir string, price, size float64) {
	for _, h := range m { h.OnTradeOpen(sym, dir, price, size) }
}
func (m MultiHooks) OnTradeClose(sym, dir string, pnl float64, outcome, reason string) {
	for _, h := range m { h.OnTradeClose(sym, dir, pnl, outcome, reason) }
}
func (m MultiHooks) OnLearningCycle(wr, pnl float64, count int) {
	for _, h := range m { h.OnLearningCycle(wr, pnl, count) }
}
func (m MultiHooks) OnParamsUpdated(reason string) {
	for _, h := range m { h.OnParamsUpdated(reason) }
}
func (m MultiHooks) OnError(ctx string, err error) {
	for _, h := range m { h.OnError(ctx, err) }
}
func (m MultiHooks) OnHeartbeat(count int, pos int) {
	for _, h := range m { h.OnHeartbeat(count, pos) }
}
