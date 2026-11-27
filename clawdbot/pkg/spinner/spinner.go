// Package spinner renders themed terminal loading indicators using the
// solana-clawd spinner verb packs (mirrored from spinners/ into packs/).
package spinner

import (
	"embed"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed packs/*.json
var packFS embed.FS

const (
	DefaultPack = "developer"
	EnvPack     = "CLAWDBOT_SPINNER_PACK"
)

type packFile struct {
	SpinnerVerbs struct {
		Verbs []string `json:"verbs"`
	} `json:"spinnerVerbs"`
}

var (
	loadOnce sync.Once
	packs    map[string][]string
)

func load() {
	packs = make(map[string][]string)
	entries, err := packFS.ReadDir("packs")
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		data, err := packFS.ReadFile("packs/" + e.Name())
		if err != nil {
			continue
		}
		var p packFile
		if err := json.Unmarshal(data, &p); err != nil || len(p.SpinnerVerbs.Verbs) == 0 {
			continue
		}
		packs[strings.TrimSuffix(e.Name(), ".json")] = p.SpinnerVerbs.Verbs
	}
}

// Packs returns the sorted list of available spinner pack names.
func Packs() []string {
	loadOnce.Do(load)
	names := make([]string, 0, len(packs))
	for name := range packs {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// Verbs returns the verb list for a named pack. An empty name falls back to
// CLAWDBOT_SPINNER_PACK, then DefaultPack, then a small built-in set.
func Verbs(name string) []string {
	loadOnce.Do(load)
	if strings.TrimSpace(name) == "" {
		name = os.Getenv(EnvPack)
	}
	if strings.TrimSpace(name) == "" {
		name = DefaultPack
	}
	if v, ok := packs[name]; ok {
		return v
	}
	if v, ok := packs[DefaultPack]; ok {
		return v
	}
	return []string{"Thinking", "Working", "Processing"}
}

var frames = [...]string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// Spinner animates a rotating frame with a randomized themed verb while a
// long-running operation is in flight. Not safe for concurrent Start/Stop.
type Spinner struct {
	verbs []string
	color string
	reset string

	stopCh chan struct{}
	doneCh chan struct{}
}

// New builds a Spinner using the named pack (see Verbs for fallback rules).
// color/reset are ANSI escape codes applied around the rendered line; pass
// "" for either to render without color.
func New(pack, color, reset string) *Spinner {
	return &Spinner{verbs: Verbs(pack), color: color, reset: reset}
}

// Start begins animating on stderr. Call Stop when the operation completes.
func (s *Spinner) Start() {
	s.stopCh = make(chan struct{})
	s.doneCh = make(chan struct{})
	go func() {
		defer close(s.doneCh)
		verb := s.verbs[rand.Intn(len(s.verbs))]
		start := time.Now()
		ticker := time.NewTicker(80 * time.Millisecond)
		defer ticker.Stop()
		i := 0
		for {
			select {
			case <-s.stopCh:
				fmt.Fprint(os.Stderr, "\r\033[K")
				return
			case <-ticker.C:
				elapsed := time.Since(start).Round(time.Second)
				fmt.Fprintf(os.Stderr, "\r\033[K%s%s %s… (%s)%s", s.color, frames[i%len(frames)], verb, elapsed, s.reset)
				i++
			}
		}
	}()
}

// Stop halts the animation and clears the line.
func (s *Spinner) Stop() {
	if s.stopCh == nil {
		return
	}
	close(s.stopCh)
	<-s.doneCh
}
