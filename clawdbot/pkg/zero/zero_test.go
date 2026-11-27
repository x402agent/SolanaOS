// Package zero :: zero_test.go
// Behavior tests: flat scheduling, spawn/park/resume, depth caps,
// transcript chaining + verification, nullifier compatibility with
// @clawd/zk-client, ZK God Mode winner attestation, and NL routing.
package zero

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/tools"
)

// ── Scripted provider ────────────────────────────────────────────────

type scriptedProvider struct {
	calls   int
	prompts []string // last user/tool content per call, for assertions
	script  func(call int, opts providers.ChatOptions) *providers.Response
}

func (p *scriptedProvider) Name() string { return "scripted" }
func (p *scriptedProvider) Chat(_ context.Context, opts providers.ChatOptions) (*providers.Response, error) {
	p.calls++
	var all []string
	for _, m := range opts.Messages {
		all = append(all, m.Content)
	}
	p.prompts = append(p.prompts, strings.Join(all, "\n"))
	return p.script(p.calls, opts), nil
}

func done(text string) *providers.Response {
	return &providers.Response{Content: text, StopReason: "end_turn"}
}

func spawn(prompts ...string) *providers.Response {
	calls := make([]providers.ToolCall, len(prompts))
	for i, pr := range prompts {
		calls[i] = providers.ToolCall{Name: spawnToolName, Input: map[string]any{"prompt": pr}}
	}
	return &providers.Response{StopReason: "tool_use", ToolCalls: calls}
}

// ── Flat scheduling ──────────────────────────────────────────────────

func TestFlatSpawnParkResume(t *testing.T) {
	// Root spawns A and B; children finish; root resumes and answers.
	p := &scriptedProvider{script: func(call int, opts providers.ChatOptions) *providers.Response {
		switch call {
		case 1:
			return spawn("child A", "child B")
		case 2:
			return done("result A")
		case 3:
			return done("result B")
		case 4:
			return done("final answer")
		}
		t.Fatalf("unexpected call %d", call)
		return nil
	}}

	eng, err := NewEngine(Config{Model: "test/model", Provider: p, MaxDepth: 1})
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Run(context.Background(), "root prompt")
	if err != nil {
		t.Fatal(err)
	}
	if res.Answer != "final answer" {
		t.Fatalf("answer = %q", res.Answer)
	}
	if p.calls != 4 {
		t.Fatalf("expected 4 provider calls, got %d", p.calls)
	}
	if res.Tasks != 3 {
		t.Fatalf("expected 3 tasks, got %d", res.Tasks)
	}
	// Root's resume turn must carry both child results as tool messages.
	if !strings.Contains(p.prompts[3], "result A") || !strings.Contains(p.prompts[3], "result B") {
		t.Fatalf("root did not receive child results: %q", p.prompts[3])
	}
	if res.Commitment == "" || len(res.Commitment) != 66 {
		t.Fatalf("bad commitment %q", res.Commitment)
	}
}

func TestDepthCapBlocksSpawn(t *testing.T) {
	// MaxDepth 0 → spawn tool is never offered and a stray spawn call
	// gets an error tool-result instead of a new task.
	p := &scriptedProvider{script: func(call int, opts providers.ChatOptions) *providers.Response {
		switch call {
		case 1:
			for _, d := range opts.Tools {
				if d.Name == spawnToolName {
					t.Fatal("spawn_task offered at max depth")
				}
			}
			return spawn("should not run")
		case 2:
			if !strings.Contains(opts.Messages[len(opts.Messages)-1].Content, "max spawn depth") {
				t.Fatalf("expected depth error, got %q", opts.Messages[len(opts.Messages)-1].Content)
			}
			return done("gave up spawning")
		}
		t.Fatalf("unexpected call %d", call)
		return nil
	}}
	eng, _ := NewEngine(Config{Model: "test/model", Provider: p, MaxDepth: 0})
	res, err := eng.Run(context.Background(), "prompt")
	if err != nil {
		t.Fatal(err)
	}
	if res.Tasks != 1 {
		t.Fatalf("spawn escaped the depth cap: %d tasks", res.Tasks)
	}
	if res.Answer != "gave up spawning" {
		t.Fatalf("answer = %q", res.Answer)
	}
}

func TestTurnBudget(t *testing.T) {
	p := &scriptedProvider{script: func(call int, opts providers.ChatOptions) *providers.Response {
		// Loop forever via a registered tool call.
		return &providers.Response{StopReason: "tool_use", ToolCalls: []providers.ToolCall{
			{Name: "noop", Input: map[string]any{}},
		}}
	}}
	reg := tools.NewRegistry()
	reg.Register(&tools.ToolDef{ToolName: "noop", Desc: "no-op", ExecuteFn: func(context.Context, map[string]any) (string, error) {
		return "ok", nil
	}})
	eng, _ := NewEngine(Config{Model: "test/model", Provider: p, Registry: reg, MaxTurns: 3})
	_, err := eng.Run(context.Background(), "spin")
	if err == nil {
		t.Fatal("expected root failure on turn budget")
	}
	if p.calls != 3 {
		t.Fatalf("budget not enforced: %d calls", p.calls)
	}
}

// ── Transcript ───────────────────────────────────────────────────────

func TestTranscriptVerifyRoundTrip(t *testing.T) {
	tr := NewTranscript()
	_ = tr.Append("task_start", 0, map[string]any{"prompt": "hi"})
	_ = tr.Append("llm_turn", 0, map[string]any{"content": "hello"})
	_ = tr.Append("run_done", 0, map[string]any{"answer": "hello"})

	var buf bytes.Buffer
	if err := tr.WriteJSONL(&buf); err != nil {
		t.Fatal(err)
	}
	got, err := VerifyJSONL(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if got != tr.CommitmentHex() {
		t.Fatalf("verify %s != commitment %s", got, tr.CommitmentHex())
	}

	// Tampering must be detected.
	tampered := bytes.Replace(buf.Bytes(), []byte("hello"), []byte("hacked"), 1)
	if _, err := VerifyJSONL(bytes.NewReader(tampered)); err == nil {
		t.Fatal("tampered transcript verified")
	}
}

func TestTranscriptDeterminism(t *testing.T) {
	a, b := NewTranscript(), NewTranscript()
	for _, tr := range []*Transcript{a, b} {
		_ = tr.Append("k", 1, map[string]any{"x": 1})
	}
	if a.CommitmentHex() != b.CommitmentHex() {
		t.Fatal("same events, different commitments")
	}
	_ = b.Append("k", 1, map[string]any{"x": 2})
	if a.CommitmentHex() == b.CommitmentHex() {
		t.Fatal("different events, same commitment")
	}
}

// ── Nullifier — must match @clawd/zk-client computeNullifier ────────

func TestNullifierMatchesZkClient(t *testing.T) {
	secret := bytes.Repeat([]byte{0xAB}, 32)
	contextTag := "solana-clawd/attestation/v1"

	// Reference construction, independent of the implementation:
	// SHA-256(secret || utf8(context)) — no nonce.
	h := sha256.New()
	h.Write(secret)
	h.Write([]byte(contextTag))
	want := hex.EncodeToString(h.Sum(nil))

	got, err := Nullifier(secret, contextTag)
	if err != nil {
		t.Fatal(err)
	}
	if hex.EncodeToString(got[:]) != want {
		t.Fatalf("nullifier mismatch: %x != %s", got, want)
	}

	// With nonce: SHA-256(secret || context || u64le(7)).
	h = sha256.New()
	h.Write(secret)
	h.Write([]byte(contextTag))
	h.Write([]byte{7, 0, 0, 0, 0, 0, 0, 0})
	want = hex.EncodeToString(h.Sum(nil))
	nonce := uint64(7)
	got, err = NullifierWithNonce(secret, contextTag, &nonce)
	if err != nil {
		t.Fatal(err)
	}
	if hex.EncodeToString(got[:]) != want {
		t.Fatalf("nonce nullifier mismatch")
	}

	if _, err := Nullifier([]byte("short"), contextTag); err == nil {
		t.Fatal("accepted <16-byte secret")
	}
}

func TestAttestation(t *testing.T) {
	tr := NewTranscript()
	_ = tr.Append("run_done", 0, map[string]any{"answer": "42"})
	secret := bytes.Repeat([]byte{1}, 32)

	att, err := tr.Attest(secret, "zero/run/v1", "test/model")
	if err != nil {
		t.Fatal(err)
	}
	if att.PayloadCommitment != tr.CommitmentHex() {
		t.Fatal("attestation commitment mismatch")
	}
	wantModel := sha256.Sum256([]byte("test/model"))
	if att.ModelHash != "0x"+hex.EncodeToString(wantModel[:]) {
		t.Fatal("modelHash mismatch")
	}
	if att.Schema != attestationSchema || att.Events != 1 {
		t.Fatalf("bad attestation: %+v", att)
	}
}

func TestModelSetID(t *testing.T) {
	a := ModelSetID([]string{"b/model", "a/model", "b/model", ""})
	b := ModelSetID([]string{"a/model", "b/model"})
	if a != b || a != "a/model,b/model" {
		t.Fatalf("ModelSetID not canonical: %q vs %q", a, b)
	}
}

// ── ZK God Mode winner tracking ──────────────────────────────────────

func TestWinnerModelsTracked(t *testing.T) {
	p := &scriptedProvider{script: func(call int, opts providers.ChatOptions) *providers.Response {
		return done(fmt.Sprintf("answer %d", call))
	}}
	eng, _ := NewEngine(Config{Model: "solo/model", Provider: p})
	res, err := eng.Run(context.Background(), "q")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.WinnerModels) != 1 || res.WinnerModels[0] != "solo/model" {
		t.Fatalf("winners = %v", res.WinnerModels)
	}
}

// ── NL intent routing ────────────────────────────────────────────────

func TestRouteIntent(t *testing.T) {
	cases := []struct {
		in     string
		intent Intent
	}{
		{"attest this model 0xab12cd34ef567890 with proof.json", IntentAttest},
		{"verify transcript.jsonl", IntentVerify},
		{"derive a nullifier for 'zero/run/v1'", IntentNullifier},
		{"god mode: refactor the config loader", IntentGodMode},
		{"race models on summarizing the repo", IntentGodMode},
		{"run: fix the failing test in ./pkg", IntentRun},
		{"show status", IntentInspect},
		{"help", IntentHelp},
		{"", IntentHelp},
		{"summarize SOL price action today", IntentRun},
		{"zk-omni message attest demo", IntentZkOmni},
		{"send cross-chain message robinhood to solana", IntentZkOmni},
		{"plan an omnichain message", IntentZkOmni},
	}
	for _, c := range cases {
		r := RouteIntent(c.in)
		if r.Intent != c.intent {
			t.Errorf("RouteIntent(%q) = %s, want %s", c.in, r.Intent, c.intent)
		}
	}

	r := RouteIntent("run: fix the failing test in ./pkg")
	if r.Prompt != "fix the failing test in ./pkg" {
		t.Errorf("run prefix not stripped: %q", r.Prompt)
	}
	r = RouteIntent("god mode: refactor the config loader")
	if r.Prompt != "refactor the config loader" {
		t.Errorf("god-mode prefix not stripped: %q", r.Prompt)
	}
	r = RouteIntent("attest 0xabcdef1234567890 using proof.json for 'my-model/v1'")
	if r.Args["hex"] != "0xabcdef1234567890" || r.Args["path"] != "proof.json" || r.Args["context"] != "my-model/v1" {
		t.Errorf("args not extracted: %v", r.Args)
	}
}
