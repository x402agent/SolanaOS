// Package commands provides the chat command registry for ClawdBot.
// ClawdBot Go slash commands dispatched from chat input.
package commands

import "context"

type Definition struct {
	Name        string
	Description string
	Aliases     []string
	Handler     func(ctx context.Context, args string) (string, error)
}

type Registry struct {
	defs map[string]*Definition
}

func NewRegistry(builtins []Definition) *Registry {
	r := &Registry{defs: make(map[string]*Definition)}
	for i := range builtins {
		r.Register(&builtins[i])
	}
	return r
}

func (r *Registry) Register(def *Definition) {
	r.defs[def.Name] = def
	for _, alias := range def.Aliases {
		r.defs[alias] = def
	}
}

func (r *Registry) Get(name string) (*Definition, bool) {
	d, ok := r.defs[name]
	return d, ok
}

func (r *Registry) List() []*Definition {
	seen := make(map[string]bool)
	var result []*Definition
	for _, d := range r.defs {
		if !seen[d.Name] {
			seen[d.Name] = true
			result = append(result, d)
		}
	}
	return result
}

// BuiltinDefinitions returns the default ClawdBot chat commands.
func BuiltinDefinitions() []Definition {
	return []Definition{
		{Name: "help", Description: "Show available commands", Aliases: []string{"?", "h"}},
		{Name: "status", Description: "Show agent and connector status", Aliases: []string{"s"}},
		{Name: "recall", Description: "Search vault memory", Aliases: []string{"r"}},
		{Name: "remember", Description: "Store to vault", Aliases: []string{"rem"}},
		{Name: "trades", Description: "Show trade history", Aliases: []string{"t"}},
		{Name: "lessons", Description: "Show learned patterns", Aliases: []string{"l"}},
		{Name: "research", Description: "Deep research a token", Aliases: []string{"res"}},
		{Name: "checkpoint", Description: "Save agent state", Aliases: []string{"cp"}},
		{Name: "strategy", Description: "Show strategy params", Aliases: []string{"strat"}},
		{Name: "whatdoiknow", Description: "Epistemological state for an asset", Aliases: []string{"wdik"}},
	}
}
