package zkomni

import (
	"regexp"
	"strings"
)

// Intent is a zk-shark-agent action (Go twin of agent/src/intents.ts).
type Intent string

const (
	IntentAttestModel Intent = "attest-model"
	IntentCommitState Intent = "commit-state"
	IntentVerifyProof Intent = "verify-proof"
	IntentNullifier   Intent = "compute-nullifier"
	IntentInspect     Intent = "inspect"
	IntentHelp        Intent = "help"
)

// KnownIntents is the ordered list exported by @clawd/zk-shark-agent.
var KnownIntents = []Intent{
	IntentAttestModel,
	IntentCommitState,
	IntentVerifyProof,
	IntentNullifier,
	IntentInspect,
	IntentHelp,
}

// IntentContext is extra structured input the caller can supply.
type IntentContext struct {
	ModelHash            string
	PayloadCommitment    string
	CiphertextCommitment string
	StateVersion         string
	Context              string
	ProofPath            string
}

// Route is a deterministic plan — no model calls, no network.
type Route struct {
	Intent     Intent            `json:"intent"`
	Action     string            `json:"action"`
	Confidence float64           `json:"confidence"`
	Rationale  string            `json:"rationale"`
	Args       map[string]string `json:"args"`
}

type intentCandidate struct {
	intent    Intent
	action    string
	weight    float64
	rationale string
	args      map[string]string
}

var (
	hexRe             = regexp.MustCompile(`0x[0-9a-fA-F]+`)
	proofPathRe       = regexp.MustCompile(`\S+\.(json)\b`)
	attestIntentRe    = regexp.MustCompile(`(?i)\b(attest|attestation|publish|publish_attestation)\b`)
	commitIntentRe    = regexp.MustCompile(`(?i)\b(commit|commit_state|encrypted.?state|ciphertext)\b`)
	verifyIntentRe    = regexp.MustCompile(`(?i)\b(verify|check|validate)\b`)
	nullifierIntentRe = regexp.MustCompile(`(?i)\b(nullifier|derive|compute_nullifier)\b`)
	inspectIntentRe   = regexp.MustCompile(`(?i)\b(inspect|config|status|show)\b`)
	helpIntentRe      = regexp.MustCompile(`(?i)\b(help|usage|how|what)\b`)
	contextWordRe     = regexp.MustCompile(`(?i)\bcontext\s+([^\s"']+)`)
)

// RouteIntent classifies a free-form utterance for zk-shark-agent.
func RouteIntent(text string) Route {
	return RouteIntentWithContext(text, IntentContext{})
}

// RouteIntentWithContext is the Go twin of routeIntent() in intents.ts.
func RouteIntentWithContext(text string, ctx IntentContext) Route {
	text = strings.TrimSpace(text)
	candidates := make([]intentCandidate, 0, 4)
	hex := pickHex(text)
	proofPath := firstNonEmpty(ctx.ProofPath, proofPathRe.FindString(text))

	if attestIntentRe.MatchString(text) {
		modelHash := firstNonEmpty(hex, ctx.ModelHash)
		payload := ctx.PayloadCommitment
		weight := 0.7
		if modelHash != "" {
			weight += 0.2
		}
		if payload != "" {
			weight += 0.1
		}
		candidates = append(candidates, intentCandidate{
			intent: IntentAttestModel,
			action: "attestModel",
			weight: weight,
			rationale: func() string {
				if modelHash != "" {
					return "Matched attestation verb + model hash."
				}
				return "Matched attestation verb."
			}(),
			args: compactArgs(map[string]string{
				"modelHash":         modelHash,
				"payloadCommitment": payload,
				"context":           firstNonEmpty(ctx.Context, "model-attest:v1:"+orDefault(modelHash, "adhoc")),
				"proofPath":         proofPath,
			}),
		})
	}

	if commitIntentRe.MatchString(text) {
		ciphertext := firstNonEmpty(hex, ctx.CiphertextCommitment)
		weight := 0.7
		if ciphertext != "" {
			weight += 0.2
		}
		if ctx.ModelHash != "" {
			weight += 0.1
		}
		candidates = append(candidates, intentCandidate{
			intent: IntentCommitState,
			action: "commitEncryptedState",
			weight: weight,
			rationale: func() string {
				if ciphertext != "" {
					return "Matched commit verb + ciphertext commitment."
				}
				return "Matched commit verb."
			}(),
			args: compactArgs(map[string]string{
				"modelHash":            ctx.ModelHash,
				"ciphertextCommitment": ciphertext,
				"stateVersion":         firstNonEmpty(ctx.StateVersion, "1"),
				"proofPath":            proofPath,
			}),
		})
	}

	if verifyIntentRe.MatchString(text) {
		candidates = append(candidates, intentCandidate{
			intent:    IntentVerifyProof,
			action:    "verifyProof",
			weight:    0.8,
			rationale: "Matched verify verb.",
			args: compactArgs(map[string]string{
				"proofPath":         proofPath,
				"modelHash":         ctx.ModelHash,
				"payloadCommitment": ctx.PayloadCommitment,
				"nullifier":         ctx.CiphertextCommitment,
			}),
		})
	}

	if nullifierIntentRe.MatchString(text) {
		candidates = append(candidates, intentCandidate{
			intent:    IntentNullifier,
			action:    "computeNullifier",
			weight:    0.85,
			rationale: "Matched nullifier verb.",
			args: compactArgs(map[string]string{
				"context": firstNonEmpty(ctx.Context, extractQuoted(text), pickContextWord(text), hex, "default"),
			}),
		})
	}

	if inspectIntentRe.MatchString(text) && !attestIntentRe.MatchString(text) && !commitIntentRe.MatchString(text) {
		candidates = append(candidates, intentCandidate{
			intent:    IntentInspect,
			action:    "describe",
			weight:    0.7,
			rationale: "Matched inspect verb.",
			args:      map[string]string{},
		})
	}

	if helpIntentRe.MatchString(text) && !attestIntentRe.MatchString(text) && !commitIntentRe.MatchString(text) {
		candidates = append(candidates, intentCandidate{
			intent:    IntentHelp,
			action:    "help",
			weight:    0.6,
			rationale: "Matched help verb.",
			args:      map[string]string{},
		})
	}

	if len(candidates) == 0 {
		return Route{
			Intent:     IntentHelp,
			Action:     "help",
			Confidence: 0.1,
			Rationale:  "No verb match; defaulting to help.",
			Args: map[string]string{
				"reason": `Could not match any known intent in: "` + text + `"`,
			},
		}
	}

	winner := candidates[0]
	for _, c := range candidates[1:] {
		if c.weight > winner.weight {
			winner = c
		}
	}
	confidence := winner.weight
	if confidence > 1 {
		confidence = 1
	}
	if winner.args == nil {
		winner.args = map[string]string{}
	}
	return Route{
		Intent:     winner.intent,
		Action:     winner.action,
		Confidence: confidence,
		Rationale:  winner.rationale,
		Args:       winner.args,
	}
}

func pickHex(s string) string {
	return hexRe.FindString(s)
}

func pickContextWord(s string) string {
	m := contextWordRe.FindStringSubmatch(s)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

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

func compactArgs(in map[string]string) map[string]string {
	out := map[string]string{}
	for k, v := range in {
		if strings.TrimSpace(v) == "" {
			continue
		}
		out[k] = v
	}
	return out
}
