package ooda

// ResolveTickCount picks how many OODA cycles a CLI invocation should run.
//
//	ticksSet  — the user passed --ticks
//	ticks     — the flag value (0 means forever)
//	sim       — --sim was set
//
// README one-shot `clawdbot ooda --sim` runs a single simulated tick and exits.
// Continuous paper trading is `--sim --ticks 0`.
func ResolveTickCount(sim bool, ticks int, ticksSet bool) int {
	if ticksSet {
		if ticks < 0 {
			return 0
		}
		return ticks
	}
	if sim {
		return 1
	}
	return 0
}
