// ClawdBot CLI :: zero.go
// `clawdbot zero` — the Zero engine: zero-recursion flat agent loop with
// zero-knowledge run attestation (clawd-zk / zk-primitives compatible)
// and an NL intent router. `zero ask "..."` routes plain English to the
// right action without a model call.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/config"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/godmode"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/tools"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/zero"
)

const zeroSecretEnv = "ZERO_SECRET_HEX"

func NewZeroCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "zero",
		Short: "Zero engine — zero-recursion agent loop with ZK run attestation",
		Long: `Zero is ClawdBot's coding-agent core where the name is earned:

  • Zero recursion — one flat task queue; spawn_task enqueues subtasks,
    it never nests loops. Enforced by a static call-graph test in CI.
  • Zero knowledge — every run emits a hash-chained transcript whose
    commitment + nullifier plug into clawd-zk publish_attestation
    (zk-primitives/), proving the run happened exactly once without
    revealing prompts, tools, or outputs.
  • ZK God Mode — race the whole model list every turn; the attestation
    commits to the exact set of winning models.`,
		Example: `  clawdbot zero run "explain pkg/zero/loop.go"
  clawdbot zero run --god --attest att.json "audit the OODA loop"
  clawdbot zero ask "god mode: refactor the config loader"
  clawdbot zero verify transcript.jsonl
  clawdbot zero nullifier "zero/run/v1"`,
	}
	cmd.AddCommand(newZeroRunCommand(), newZeroAskCommand(), newZeroVerifyCommand(), newZeroNullifierCommand())
	return cmd
}

// ── zero run ─────────────────────────────────────────────────────────

type zeroRunFlags struct {
	model          string
	god            bool
	maxTurns       int
	maxDepth       int
	attestPath     string
	transcriptPath string
	contextTag     string
	jsonOut        bool
	quiet          bool
}

func newZeroRunCommand() *cobra.Command {
	var f zeroRunFlags
	cmd := &cobra.Command{
		Use:   "run <prompt>",
		Short: "Run a prompt through the flat zero-recursion loop",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return zeroRun(strings.Join(args, " "), f)
		},
	}
	cmd.Flags().StringVar(&f.model, "model", "", "Model override (default: first configured model)")
	cmd.Flags().BoolVar(&f.god, "god", false, "ZK God Mode — race all configured models each turn")
	cmd.Flags().IntVar(&f.maxTurns, "max-turns", 0, "Global LLM-turn budget across all tasks")
	cmd.Flags().IntVar(&f.maxDepth, "max-depth", -1, "Spawn depth cap (0 disables spawning)")
	cmd.Flags().StringVar(&f.attestPath, "attest", "", "Write clawd-zk attestation JSON to this path")
	cmd.Flags().StringVar(&f.transcriptPath, "transcript", "", "Write hash-chained transcript JSONL to this path")
	cmd.Flags().StringVar(&f.contextTag, "context", "zero/run/v1", "Nullifier context tag")
	cmd.Flags().BoolVar(&f.jsonOut, "json", false, "Print result as JSON")
	cmd.Flags().BoolVar(&f.quiet, "quiet", false, "Suppress live event output")
	return cmd
}

func zeroRun(prompt string, f zeroRunFlags) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config error: %w", err)
	}

	model := f.model
	if model == "" {
		if len(cfg.ModelList) > 0 && cfg.ModelList[0].Model != "" {
			model = cfg.ModelList[0].Model
		} else {
			model = "openai/zkrouter-auto"
		}
	}

	zcfg := zero.Config{
		Model:       model,
		Provider:    buildProvider(cfg),
		Registry:    tools.NewRegistry(),
		MaxTokens:   cfg.Agents.Defaults.MaxTokens,
		Temperature: cfg.Agents.Defaults.Temperature,
	}
	if f.maxTurns > 0 {
		zcfg.MaxTurns = f.maxTurns
	}
	if f.maxDepth >= 0 {
		zcfg.MaxDepth = f.maxDepth
	}
	if f.god {
		models := make([]string, 0, len(cfg.ModelList))
		for _, entry := range cfg.ModelList {
			if entry.Model != "" {
				models = append(models, entry.Model)
			}
		}
		engine := godmode.NewEngine(zcfg.Provider)
		if cfg.GodMode.RaceLimit > 0 {
			engine.RaceLimit = cfg.GodMode.RaceLimit
		}
		engine.SamplingBoost = cfg.GodMode.SamplingBoost
		zcfg.GodMode = engine
		zcfg.GodModeModels = models
	}
	if !f.quiet && !f.jsonOut {
		zcfg.OnEvent = printZeroEvent
	}

	engine, err := zero.NewEngine(zcfg)
	if err != nil {
		return fmt.Errorf("zero init: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	res, runErr := engine.Run(ctx, prompt)
	if res == nil {
		return runErr
	}

	if f.transcriptPath != "" {
		if err := res.Transcript.SaveJSONL(f.transcriptPath); err != nil {
			return fmt.Errorf("transcript write: %w", err)
		}
	}

	var att *zero.Attestation
	if f.attestPath != "" {
		secret, serr := zeroSecret()
		if serr != nil {
			return serr
		}
		att, err = res.Transcript.Attest(secret, f.contextTag, zero.ModelSetID(res.WinnerModels))
		if err != nil {
			return fmt.Errorf("attest: %w", err)
		}
		raw, _ := json.MarshalIndent(att, "", "  ")
		if err := os.WriteFile(f.attestPath, append(raw, '\n'), 0o600); err != nil {
			return fmt.Errorf("attestation write: %w", err)
		}
	}

	if f.jsonOut {
		out := map[string]any{
			"answer":     res.Answer,
			"turns":      res.Turns,
			"tasks":      res.Tasks,
			"models":     res.WinnerModels,
			"commitment": res.Commitment,
			"duration":   res.Duration.String(),
			"tokens":     map[string]int{"input": res.InputTokens, "output": res.OutputTokens},
		}
		if att != nil {
			out["attestation"] = att
		}
		raw, _ := json.MarshalIndent(out, "", "  ")
		fmt.Println(string(raw))
		return runErr
	}

	fmt.Printf("\n%s[ZERO]%s %s\n", colorGreen, colorReset, res.Answer)
	fmt.Printf("%sturns=%d tasks=%d models=%s in=%d out=%d %s%s\n",
		colorDim, res.Turns, res.Tasks, zero.ModelSetID(res.WinnerModels),
		res.InputTokens, res.OutputTokens, res.Duration.Round(time.Millisecond), colorReset)
	fmt.Printf("%scommitment=%s%s\n", colorDim, res.Commitment, colorReset)
	if f.transcriptPath != "" {
		fmt.Printf("%stranscript → %s%s\n", colorDim, f.transcriptPath, colorReset)
	}
	if att != nil {
		fmt.Printf("%sattestation → %s (nullifier %s…)%s\n", colorDim, f.attestPath, att.Nullifier[:18], colorReset)
	}
	return runErr
}

func printZeroEvent(ev zero.Event) {
	indent := strings.Repeat("  ", ev.Depth)
	switch ev.Type {
	case zero.EventSpawn:
		fmt.Printf("%s%s⧉ spawn: %s%s\n", indent, colorTeal, truncateZero(ev.Message, 90), colorReset)
	case zero.EventToolStart:
		fmt.Printf("%s%s⚙ %s%s\n", indent, colorAmber, ev.Tool, colorReset)
	case zero.EventToolError:
		fmt.Printf("%s%s✗ %s: %s%s\n", indent, colorAmber, ev.Tool, truncateZero(ev.Message, 90), colorReset)
	case zero.EventTaskDone:
		fmt.Printf("%s%s✓ task %d%s\n", indent, colorDim, ev.TaskID, colorReset)
	case zero.EventThinking:
		fmt.Printf("%s%s… %s%s\n", indent, colorDim, truncateZero(ev.Message, 90), colorReset)
	}
}

func truncateZero(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ── zero ask — natural-language dispatch ─────────────────────────────

func newZeroAskCommand() *cobra.Command {
	var f zeroRunFlags
	cmd := &cobra.Command{
		Use:   "ask <utterance>",
		Short: "Route plain English to the right zero action (no model call for routing)",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			utterance := strings.Join(args, " ")
			route := zero.RouteIntent(utterance)
			fmt.Printf("%sintent=%s confidence=%.2f%s\n", colorDim, route.Intent, route.Confidence, colorReset)
			switch route.Intent {
			case zero.IntentRun:
				return zeroRun(route.Prompt, f)
			case zero.IntentGodMode:
				f.god = true
				return zeroRun(route.Prompt, f)
			case zero.IntentVerify:
				if p := route.Args["path"]; p != "" {
					return zeroVerifyFile(p)
				}
				return fmt.Errorf("verify: no transcript file found in %q", utterance)
			case zero.IntentNullifier:
				ctxTag := route.Args["context"]
				if ctxTag == "" {
					ctxTag = "zero/run/v1"
				}
				return zeroPrintNullifier(ctxTag)
			case zero.IntentAttest:
				return fmt.Errorf("attest: run with attestation instead — clawdbot zero run --attest att.json %q", route.Prompt)
			case zero.IntentInspect:
				fmt.Println("zero engine: flat scheduler, spawn via queue, transcript hash chain sha256, nullifier = sha256(secret‖context‖nonce)")
				return nil
			default:
				return cmd.Root().Help()
			}
		},
	}
	cmd.Flags().StringVar(&f.attestPath, "attest", "", "Write clawd-zk attestation JSON to this path")
	cmd.Flags().StringVar(&f.transcriptPath, "transcript", "", "Write transcript JSONL to this path")
	cmd.Flags().StringVar(&f.contextTag, "context", "zero/run/v1", "Nullifier context tag")
	return cmd
}

// ── zero verify ──────────────────────────────────────────────────────

func newZeroVerifyCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "verify <transcript.jsonl>",
		Short: "Replay a transcript and check its hash-chain commitment",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return zeroVerifyFile(args[0])
		},
	}
}

func zeroVerifyFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	commitment, err := zero.VerifyJSONL(f)
	if err != nil {
		fmt.Printf("%s✗ FAIL%s %v\n", colorAmber, colorReset, err)
		return err
	}
	fmt.Printf("%s✓ OK%s commitment %s\n", colorGreen, colorReset, commitment)
	return nil
}

// ── zero nullifier ───────────────────────────────────────────────────

func newZeroNullifierCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "nullifier <context>",
		Short: "Derive a clawd-zk-compatible nullifier from " + zeroSecretEnv,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return zeroPrintNullifier(args[0])
		},
	}
}

func zeroPrintNullifier(contextTag string) error {
	secret, err := zeroSecret()
	if err != nil {
		return err
	}
	null, err := zero.Nullifier(secret, contextTag)
	if err != nil {
		return err
	}
	fmt.Printf("0x%s\n", hex.EncodeToString(null[:]))
	return nil
}

// zeroSecret reads hex secret material from ZERO_SECRET_HEX, or mints an
// ephemeral one (attestations from ephemeral secrets cannot be re-derived).
func zeroSecret() ([]byte, error) {
	if v := strings.TrimSpace(os.Getenv(zeroSecretEnv)); v != "" {
		raw, err := hex.DecodeString(strings.TrimPrefix(v, "0x"))
		if err != nil {
			return nil, fmt.Errorf("%s is not valid hex: %w", zeroSecretEnv, err)
		}
		if len(raw) < 16 {
			return nil, fmt.Errorf("%s must be at least 16 bytes of hex", zeroSecretEnv)
		}
		return raw, nil
	}
	fmt.Printf("%s! %s unset — using an ephemeral secret (nullifier not re-derivable)%s\n",
		colorAmber, zeroSecretEnv, colorReset)
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	return secret, nil
}
