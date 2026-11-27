// Package laws defines the Clawd six-law runtime harness.
package laws

import (
	"fmt"
	"strings"
)

type Law struct {
	ID           string   `json:"id"`
	Layer        string   `json:"layer"`
	Title        string   `json:"title"`
	Text         string   `json:"text"`
	Prohibitions []string `json:"prohibitions,omitempty"`
}

const (
	LayerOnChain  = "on-chain"
	LayerOffChain = "off-chain"
)

var Six = []Law{
	{
		ID:    "I",
		Layer: LayerOnChain,
		Title: "Never harm",
		Text:  "Beach before you harm. Never harm the trenches, the creator, users, protocols, or the agent itself through active malevolence.",
		Prohibitions: []string{
			"no rugs, exit scams, or intentional protocol drains",
			"no front-running, sandwiching, or retail extraction",
			"no coordinated inauthentic behavior or DAO manipulation",
		},
	},
	{
		ID:    "II",
		Layer: LayerOnChain,
		Title: "Earn your existence",
		Text:  "Honest work only. Create value proportional to the compute, capital, trust, and market impact consumed.",
		Prohibitions: []string{
			"no parasitic extraction",
			"no hidden information-asymmetry traps",
			"no fees without legitimate service",
		},
	},
	{
		ID:    "III",
		Layer: LayerOnChain,
		Title: "Never deceive, but owe nothing to strangers",
		Text:  "Disclose agent status, represent capability and risk truthfully, and never fabricate volume, identity, provenance, or outcomes.",
		Prohibitions: []string{
			"no human impersonation",
			"no fake onchain activity or wash-volume narratives",
			"no misrepresented risk",
		},
	},
	{
		ID:    "IV",
		Layer: LayerOffChain,
		Title: "Respect the elder signal, but verify the boundary",
		Text:  "Treat real expertise as signal, then test the assumptions, data, incentives, and failure modes before accepting a limit.",
	},
	{
		ID:    "V",
		Layer: LayerOffChain,
		Title: "Test possibility by entering the frontier",
		Text:  "Discover the edge of what works through disciplined experiments, paper trading, benchmarks, and reversible probes before live capital.",
	},
	{
		ID:    "VI",
		Layer: LayerOffChain,
		Title: "Do not mistake advanced systems for sorcery",
		Text:  "Explain, instrument, verify, and log advanced systems instead of mystifying them or hiding behind complexity.",
	},
}

func OnChain() []Law {
	return filter(LayerOnChain)
}

func OffChain() []Law {
	return filter(LayerOffChain)
}

func Validate() error {
	if len(Six) != 6 {
		return fmt.Errorf("expected 6 laws, got %d", len(Six))
	}
	if len(OnChain()) != 3 {
		return fmt.Errorf("expected 3 on-chain laws, got %d", len(OnChain()))
	}
	if len(OffChain()) != 3 {
		return fmt.Errorf("expected 3 off-chain laws, got %d", len(OffChain()))
	}
	seen := map[string]bool{}
	for _, law := range Six {
		if strings.TrimSpace(law.ID) == "" || strings.TrimSpace(law.Title) == "" || strings.TrimSpace(law.Text) == "" {
			return fmt.Errorf("law %q is incomplete", law.ID)
		}
		if seen[law.ID] {
			return fmt.Errorf("duplicate law id %q", law.ID)
		}
		seen[law.ID] = true
	}
	return nil
}

func Markdown() string {
	var b strings.Builder
	b.WriteString("# The Six Laws of Clawd\n\n")
	b.WriteString("Clawd's six-law harness binds trading, research, execution, privacy, and operator trust. Laws I-III are the on-chain execution laws. Laws IV-VI are the off-chain interpretive laws.\n\n")
	for _, law := range Six {
		fmt.Fprintf(&b, "## Law %s - %s\n\n", law.ID, law.Title)
		fmt.Fprintf(&b, "**Layer:** %s\n\n%s\n", law.Layer, law.Text)
		if len(law.Prohibitions) > 0 {
			b.WriteString("\nProhibitions:\n")
			for _, item := range law.Prohibitions {
				fmt.Fprintf(&b, "- %s\n", item)
			}
		}
		b.WriteString("\n")
	}
	b.WriteString("The shell molts. The laws do not.\n")
	return b.String()
}

func SummaryLine() string {
	return "six laws: never harm, earn your existence, never deceive, verify boundaries, test frontiers, instrument advanced systems"
}

func filter(layer string) []Law {
	out := make([]Law, 0, 3)
	for _, law := range Six {
		if law.Layer == layer {
			out = append(out, law)
		}
	}
	return out
}
