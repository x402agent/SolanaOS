// Package zero :: intents.go
// Natural-language intent router for the Zero engine — the Go twin of
// @clawd/zk-agent's routeIntent (zk-primitives/agent/src/intents.ts).
// Deterministic and rule-based: no model calls, no network, so routing
// itself never costs a turn and never leaks the utterance anywhere.
package zero

import (
	"regexp"
	"strings"
)

// Intent is a recognized natural-language action.
type Intent string

const (
	IntentRun       Intent = "run"       // run an agent task
	IntentAttest    Intent = "attest"    // build a clawd-zk attestation
	IntentVerify    Intent = "verify"    // verify a transcript / commitment
	IntentNullifier Intent = "nullifier" // derive a nullifier
	IntentGodMode   Intent = "god-mode"  // race models (ZK God Mode)
	IntentInspect   Intent = "inspect"   // show config / status
	IntentHelp      Intent = "help"      // usage
)

// Route is the result of routing an utterance.
type Route struct {
	Intent     Intent
	Confidence float64
	// Prompt is the utterance with any leading verb phrase stripped —
	// what should be forwarded to Engine.Run for IntentRun/IntentGodMode.
	Prompt string
	// Args holds extracted artifacts: hex strings, file paths, contexts.
	Args map[string]string
}

var (
	hexRe  = regexp.MustCompile(`0x[0-9a-fA-F]{8,}`)
	pathRe = regexp.MustCompile(`\S+\.(json|jsonl)\b`)

	// Ordered — first match wins. God Mode outranks plain run so
	// "race models on X" and "god mode: X" route correctly.
	intentRules = []struct {
		re     *regexp.Regexp
		intent Intent
		conf   float64
	}{
		{regexp.MustCompile(`(?i)\b(god\s*-?\s*mode|race\s+(the\s+)?models?|multi-?model)\b`), IntentGodMode, 0.9},
		{regexp.MustCompile(`(?i)\b(attest(ation)?|publish)\b`), IntentAttest, 0.9},
		{regexp.MustCompile(`(?i)\b(verify|check|validate|replay)\b`), IntentVerify, 0.85},
		{regexp.MustCompile(`(?i)\b(nullifier|derive|compute[_\s]nullifier)\b`), IntentNullifier, 0.9},
		{regexp.MustCompile(`(?i)\b(inspect|config|status|show\s+(config|status))\b`), IntentInspect, 0.8},
		{regexp.MustCompile(`(?i)\b(help|usage|how\s+do|what\s+can)\b`), IntentHelp, 0.75},
		{regexp.MustCompile(`(?i)\b(run|exec(ute)?|do|build|fix|write|analyze|research)\b`), IntentRun, 0.7},
	}

	// Leading verb phrases stripped from run prompts:
	// "run", "exec", "execute", "please run", "zero run", etc.
	runPrefixRe = regexp.MustCompile(`(?i)^\s*(please\s+)?(zero\s+)?(run|exec(ute)?)\s*[:,-]?\s*`)
	godPrefixRe = regexp.MustCompile(`(?i)^\s*(please\s+)?(zero\s+)?(god\s*-?\s*mode|race\s+(the\s+)?models?)\s*[:,-]?\s*(on\s+)?`)
)

// RouteIntent classifies an utterance. Unmatched utterances fall back to
// IntentRun with low confidence — the agent is the default handler.
func RouteIntent(utterance string) Route {
	text := strings.TrimSpace(utterance)
	route := Route{Intent: IntentRun, Confidence: 0.5, Prompt: text, Args: map[string]string{}}
	if text == "" {
		route.Intent = IntentHelp
		route.Confidence = 1
		return route
	}

	for _, rule := range intentRules {
		if rule.re.MatchString(text) {
			route.Intent = rule.intent
			route.Confidence = rule.conf
			break
		}
	}

	if hexes := hexRe.FindAllString(text, -1); len(hexes) > 0 {
		route.Args["hex"] = hexes[0]
		if len(hexes) > 1 {
			route.Args["hex2"] = hexes[1]
		}
	}
	if p := pathRe.FindString(text); p != "" {
		route.Args["path"] = p
	}
	if q := extractQuoted(text); q != "" {
		route.Args["context"] = q
	}

	switch route.Intent {
	case IntentRun:
		route.Prompt = strings.TrimSpace(runPrefixRe.ReplaceAllString(text, ""))
	case IntentGodMode:
		route.Prompt = strings.TrimSpace(godPrefixRe.ReplaceAllString(text, ""))
	}
	if route.Prompt == "" {
		route.Prompt = text
	}
	return route
}

// extractQuoted returns the first single- or double-quoted span, if any.
func extractQuoted(s string) string {
	for _, q := range []byte{'"', '\''} {
		start := strings.IndexByte(s, q)
		if start < 0 {
			continue
		}
		end := strings.IndexByte(s[start+1:], q)
		if end > 0 {
			return s[start+1 : start+1+end]
		}
	}
	return ""
}
