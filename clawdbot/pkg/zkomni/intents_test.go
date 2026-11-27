package zkomni

import "testing"

func TestRouteIntent(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		ctx      IntentContext
		intent   Intent
		action   string
		argKey   string
		argValue string
	}{
		{
			name:     "attest with hash",
			input:    "attest this model 0xab12cd34eeff00112233445566778899aabbccddeeff00112233445566778899 with proof.json",
			intent:   IntentAttestModel,
			action:   "attestModel",
			argKey:   "modelHash",
			argValue: "0xab12cd34eeff00112233445566778899aabbccddeeff00112233445566778899",
		},
		{
			name:     "commit encrypted state",
			input:    "commit this encrypted state",
			ctx:      IntentContext{CiphertextCommitment: "0x" + "ab", ProofPath: "./proof.json"},
			intent:   IntentCommitState,
			action:   "commitEncryptedState",
			argKey:   "proofPath",
			argValue: "./proof.json",
		},
		{
			name:     "verify groth16",
			input:    "verify this Groth16 proof against proof.json",
			intent:   IntentVerifyProof,
			action:   "verifyProof",
			argKey:   "proofPath",
			argValue: "proof.json",
		},
		{
			name:     "nullifier quoted context",
			input:    `derive a nullifier for context "foo"`,
			intent:   IntentNullifier,
			action:   "computeNullifier",
			argKey:   "context",
			argValue: "foo",
		},
		{
			name:     "nullifier unquoted context",
			input:    "derive a nullifier for context foo",
			intent:   IntentNullifier,
			action:   "computeNullifier",
			argKey:   "context",
			argValue: "foo",
		},
		{
			name:   "inspect config",
			input:  "show me the ZK Shark config",
			intent: IntentInspect,
			action: "describe",
		},
		{
			name:   "help",
			input:  "what can the zk shark agent do",
			intent: IntentHelp,
			action: "help",
		},
		{
			name:   "unrecognised falls back to help",
			input:  "buy sol with jupiter",
			intent: IntentHelp,
			action: "help",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			route := RouteIntentWithContext(tt.input, tt.ctx)
			if route.Intent != tt.intent {
				t.Fatalf("intent = %q, want %q rationale=%q", route.Intent, tt.intent, route.Rationale)
			}
			if route.Action != tt.action {
				t.Fatalf("action = %q, want %q", route.Action, tt.action)
			}
			if route.Args == nil {
				t.Fatal("args must be non-nil")
			}
			if tt.argKey == "" {
				return
			}
			if got := route.Args[tt.argKey]; got != tt.argValue {
				t.Fatalf("args[%s] = %q, want %q args=%v", tt.argKey, got, tt.argValue, route.Args)
			}
		})
	}
}

func TestKnownIntentsMatchSharkAgent(t *testing.T) {
	if len(KnownIntents) != 6 {
		t.Fatalf("KnownIntents = %d", len(KnownIntents))
	}
	if KnownIntents[0] != IntentAttestModel || KnownIntents[5] != IntentHelp {
		t.Fatalf("KnownIntents = %#v", KnownIntents)
	}
}
