// Package vulcan wraps the official Vulcan CLI for Phoenix perpetual futures.
package vulcan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultBinary       = "vulcan"
	DefaultPaperBalance = 10000

	ModeObserve     = "observe"
	ModePaper       = "paper"
	ModeDryRun      = "dry-run"
	ModeConfirmEach = "confirm-each"
	ModeAutoExecute = "auto-execute"
	ModeLive        = "live"
)

type Config struct {
	Binary               string
	DefaultMode          string
	PaperBalance         float64
	Timeout              time.Duration
	MaxStepNotionalUSDC  float64
	MaxTotalNotionalUSDC float64
	MaxPriceDriftBPS     int
	MaxExposureRatio     float64
	Wallet               string
}

func (c Config) normalized() Config {
	if strings.TrimSpace(c.Binary) == "" {
		c.Binary = DefaultBinary
	}
	if strings.TrimSpace(c.DefaultMode) == "" {
		c.DefaultMode = ModePaper
	}
	if c.PaperBalance <= 0 {
		c.PaperBalance = DefaultPaperBalance
	}
	if c.Timeout <= 0 {
		c.Timeout = 30 * time.Second
	}
	if c.MaxStepNotionalUSDC <= 0 {
		c.MaxStepNotionalUSDC = 100
	}
	if c.MaxTotalNotionalUSDC <= 0 {
		c.MaxTotalNotionalUSDC = 500
	}
	if c.MaxPriceDriftBPS <= 0 {
		c.MaxPriceDriftBPS = 75
	}
	if c.MaxExposureRatio <= 0 {
		c.MaxExposureRatio = 2
	}
	c.DefaultMode = NormalizeMode(c.DefaultMode)
	return c
}

type Runner struct {
	cfg Config
}

type Result struct {
	Command  []string        `json:"command"`
	OK       bool            `json:"ok"`
	JSON     json.RawMessage `json:"json,omitempty"`
	Stdout   string          `json:"stdout,omitempty"`
	Stderr   string          `json:"stderr,omitempty"`
	ExitCode int             `json:"exitCode"`
}

func New(cfg Config) *Runner {
	return &Runner{cfg: cfg.normalized()}
}

func (r *Runner) Config() Config {
	return r.cfg
}

func (r *Runner) Run(ctx context.Context, args []string) (*Result, error) {
	if len(args) == 0 {
		return nil, errors.New("vulcan args are required")
	}
	runCtx, cancel := context.WithTimeout(ctx, r.cfg.Timeout)
	defer cancel()

	full := append([]string{r.cfg.Binary}, args...)
	cmd := exec.CommandContext(runCtx, r.cfg.Binary, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	result := &Result{
		Command:  full,
		OK:       err == nil,
		Stdout:   strings.TrimSpace(stdout.String()),
		Stderr:   strings.TrimSpace(stderr.String()),
		ExitCode: exitCode(err),
	}
	if json.Valid(stdout.Bytes()) {
		result.JSON = append(json.RawMessage(nil), bytes.TrimSpace(stdout.Bytes())...)
		result.Stdout = ""
	}
	if runCtx.Err() != nil {
		return result, runCtx.Err()
	}
	if err != nil {
		return result, fmt.Errorf("%s: %w", strings.Join(full, " "), err)
	}
	return result, nil
}

func (r *Runner) LookPath() (string, error) {
	return exec.LookPath(r.cfg.Binary)
}

func NormalizeMode(mode string) string {
	m := strings.ToLower(strings.TrimSpace(mode))
	m = strings.ReplaceAll(m, "_", "-")
	switch m {
	case "", "default":
		return ModePaper
	case "paper", "sim", "simulate", "simulated":
		return ModePaper
	case "dry", "dryrun", "dry-run":
		return ModeDryRun
	case "confirm", "confirm-each", "confirm_each":
		return ModeConfirmEach
	case "auto", "auto-execute", "auto_execute", "autonomous":
		return ModeAutoExecute
	case "live":
		return ModeLive
	case "observe", "read", "readonly", "read-only":
		return ModeObserve
	default:
		return m
	}
}

func IsLiveMode(mode string) bool {
	switch NormalizeMode(mode) {
	case ModeConfirmEach, ModeAutoExecute, ModeLive:
		return true
	default:
		return false
	}
}

func IsPaperMode(mode string) bool {
	return NormalizeMode(mode) == ModePaper
}

func NeedLiveAck(mode string, yes bool) error {
	if IsLiveMode(mode) && !yes {
		return fmt.Errorf("live Vulcan execution requires --yes after explicit user approval")
	}
	return nil
}

type OrderSpec struct {
	Mode         string
	Symbol       string
	Side         string
	OrderType    string
	Size         float64
	Tokens       float64
	NotionalUSDC float64
	Price        float64
	TP           float64
	SL           float64
	Isolated     bool
	Collateral   float64
	ReduceOnly   bool
	Yes          bool
	Wallet       string
}

func (r *Runner) PaperInitArgs(balance float64) []string {
	if balance <= 0 {
		balance = r.cfg.PaperBalance
	}
	return []string{"paper", "init", "--balance", formatFloat(balance), "-o", "json"}
}

func (r *Runner) StatusArgs() []string {
	return []string{"status", "-o", "json"}
}

func (r *Runner) AgentHealthArgs() []string {
	return []string{"agent", "health", "-o", "json"}
}

func (r *Runner) StrategyPreflightArgs(wallet string) []string {
	args := []string{"strategy", "preflight", "-o", "json"}
	if wallet != "" {
		args = append(args, "-w", wallet)
	}
	return args
}

func (r *Runner) MarketArgs(kind, symbol string) []string {
	switch kind {
	case "list", "markets":
		return []string{"market", "list", "-o", "json"}
	case "ticker":
		return []string{"market", "ticker", strings.ToUpper(symbol), "-o", "json"}
	case "info":
		return []string{"market", "info", strings.ToUpper(symbol), "-o", "json"}
	case "orderbook":
		return []string{"market", "orderbook", strings.ToUpper(symbol), "-o", "json"}
	default:
		return []string{"market", kind, strings.ToUpper(symbol), "-o", "json"}
	}
}

func (r *Runner) OrderArgs(spec OrderSpec) ([]string, error) {
	spec.Mode = NormalizeMode(firstNonEmpty(spec.Mode, r.cfg.DefaultMode))
	spec.Symbol = strings.ToUpper(strings.TrimSpace(spec.Symbol))
	spec.Side = strings.ToLower(strings.TrimSpace(spec.Side))
	spec.OrderType = strings.ToLower(strings.TrimSpace(spec.OrderType))
	if spec.OrderType == "" {
		spec.OrderType = "market"
	}
	spec.Wallet = firstNonEmpty(spec.Wallet, r.cfg.Wallet)
	if spec.Symbol == "" {
		return nil, errors.New("symbol is required")
	}
	if spec.Side != "buy" && spec.Side != "sell" {
		return nil, errors.New("side must be buy or sell")
	}
	if spec.OrderType != "market" && spec.OrderType != "limit" {
		return nil, errors.New("order type must be market or limit")
	}
	if spec.OrderType == "limit" && spec.Price <= 0 {
		return nil, errors.New("limit orders require --price")
	}
	if countPositive(spec.Size, spec.Tokens, spec.NotionalUSDC) != 1 {
		return nil, errors.New("provide exactly one of --size, --tokens, or --notional-usdc")
	}
	if err := NeedLiveAck(spec.Mode, spec.Yes); err != nil {
		return nil, err
	}

	if spec.Mode == ModePaper {
		return paperOrderArgs(spec), nil
	}

	args := []string{"trade"}
	switch spec.OrderType {
	case "market":
		args = append(args, "market-"+spec.Side, spec.Symbol)
	case "limit":
		if spec.Size <= 0 {
			return nil, errors.New("live Vulcan limit orders require --size in base lots; run `vulcan market info <symbol> -o json` before choosing size")
		}
		args = append(args, "limit-"+spec.Side, spec.Symbol, formatFloat(spec.Size), formatFloat(spec.Price))
	}
	if spec.Mode == ModeDryRun {
		args = append(args, "--dry-run")
	}
	if spec.Mode == ModeLive || spec.Mode == ModeConfirmEach || spec.Mode == ModeAutoExecute {
		args = append(args, "--yes")
	}
	if spec.Wallet != "" {
		args = append(args, "-w", spec.Wallet)
	}
	if spec.OrderType == "market" {
		if spec.Size > 0 {
			args = append(args, formatFloat(spec.Size))
		} else {
			args = appendSizeFlags(args, 0, spec.Tokens, spec.NotionalUSDC)
		}
	}
	if spec.TP > 0 {
		args = append(args, "--tp", formatFloat(spec.TP))
	}
	if spec.SL > 0 {
		args = append(args, "--sl", formatFloat(spec.SL))
	}
	if spec.Isolated {
		args = append(args, "--isolated")
	}
	if spec.Collateral > 0 {
		args = append(args, "--collateral", formatFloat(spec.Collateral))
	}
	if spec.ReduceOnly {
		args = append(args, "--reduce-only")
	}
	args = append(args, "-o", "json")
	return args, nil
}

type TWAPSpec struct {
	Mode                 string
	Symbol               string
	Side                 string
	NotionalUSDC         float64
	Tokens               float64
	Slices               int
	IntervalSeconds      int
	MarginMode           string
	IsolatedCollateral   float64
	RunLabel             string
	Detached             bool
	Yes                  bool
	Wallet               string
	MaxStepNotionalUSDC  float64
	MaxTotalNotionalUSDC float64
	MaxPriceDriftBPS     int
	MaxExposureRatio     float64
}

func (r *Runner) TWAPArgs(spec TWAPSpec) ([]string, error) {
	spec.Mode = NormalizeMode(firstNonEmpty(spec.Mode, r.cfg.DefaultMode))
	spec.Symbol = strings.ToUpper(strings.TrimSpace(spec.Symbol))
	spec.Side = strings.ToLower(strings.TrimSpace(spec.Side))
	spec.Wallet = firstNonEmpty(spec.Wallet, r.cfg.Wallet)
	if spec.Symbol == "" {
		return nil, errors.New("symbol is required")
	}
	if spec.Side != "buy" && spec.Side != "sell" {
		return nil, errors.New("side must be buy or sell")
	}
	if countPositive(spec.Tokens, spec.NotionalUSDC) != 1 {
		return nil, errors.New("provide exactly one of --tokens or --notional-usdc")
	}
	if spec.Slices <= 0 {
		return nil, errors.New("slices must be positive")
	}
	if spec.IntervalSeconds <= 0 {
		spec.IntervalSeconds = 60
	}
	if err := NeedLiveAck(spec.Mode, spec.Yes); err != nil {
		return nil, err
	}
	args := []string{"strategy", "twap", "start",
		"--symbol", spec.Symbol,
		"--side", spec.Side,
		"--slices", strconv.Itoa(spec.Slices),
		"--interval-seconds", strconv.Itoa(spec.IntervalSeconds),
		"--mode", strategyMode(spec.Mode),
	}
	args = appendStrategyWallet(args, spec.Mode, spec.Wallet)
	args = appendSizeFlags(args, 0, spec.Tokens, spec.NotionalUSDC)
	args = appendStrategyCommon(args, r.cfg, strategyGuardrails{
		MaxStepNotionalUSDC:  spec.MaxStepNotionalUSDC,
		MaxTotalNotionalUSDC: spec.MaxTotalNotionalUSDC,
		MaxPriceDriftBPS:     spec.MaxPriceDriftBPS,
		MaxExposureRatio:     spec.MaxExposureRatio,
	})
	if spec.MarginMode != "" {
		args = append(args, "--margin-mode", spec.MarginMode)
	}
	if spec.IsolatedCollateral > 0 {
		args = append(args, "--isolated-collateral", formatFloat(spec.IsolatedCollateral))
	}
	if spec.RunLabel != "" {
		args = append(args, "--run-label", spec.RunLabel)
	}
	if spec.Detached {
		args = append(args, "--detached")
	}
	args = append(args, "-o", "json")
	return args, nil
}

type GridSpec struct {
	Mode                 string
	Symbol               string
	CenterOnMark         bool
	WidthPct             float64
	LowerPrice           float64
	UpperPrice           float64
	LevelsPerSide        int
	TokensPerLevel       float64
	SizeLotsPerLevel     float64
	IntervalSeconds      int
	Ticks                int
	RunUntilStopped      bool
	RunLabel             string
	Detached             bool
	Yes                  bool
	Wallet               string
	MaxStepNotionalUSDC  float64
	MaxTotalNotionalUSDC float64
	MaxPriceDriftBPS     int
	MaxExposureRatio     float64
}

func (r *Runner) GridArgs(spec GridSpec) ([]string, error) {
	spec.Mode = NormalizeMode(firstNonEmpty(spec.Mode, r.cfg.DefaultMode))
	spec.Symbol = strings.ToUpper(strings.TrimSpace(spec.Symbol))
	spec.Wallet = firstNonEmpty(spec.Wallet, r.cfg.Wallet)
	if spec.Symbol == "" {
		return nil, errors.New("symbol is required")
	}
	if spec.LevelsPerSide <= 0 {
		return nil, errors.New("levels per side must be positive")
	}
	if countPositive(spec.TokensPerLevel, spec.SizeLotsPerLevel) != 1 {
		return nil, errors.New("provide exactly one of --tokens-per-level or --size-lots-per-level")
	}
	if !spec.CenterOnMark && (spec.LowerPrice <= 0 || spec.UpperPrice <= 0) {
		return nil, errors.New("grid requires --center-on-mark with --width-pct or explicit --lower-price and --upper-price")
	}
	if spec.CenterOnMark && spec.WidthPct <= 0 {
		return nil, errors.New("--center-on-mark requires --width-pct")
	}
	if spec.IntervalSeconds <= 0 {
		spec.IntervalSeconds = 60
	}
	if spec.Ticks <= 0 && !spec.RunUntilStopped {
		spec.Ticks = 60
	}
	if err := NeedLiveAck(spec.Mode, spec.Yes); err != nil {
		return nil, err
	}
	args := []string{"strategy", "grid", "start",
		"--symbol", spec.Symbol,
		"--levels-per-side", strconv.Itoa(spec.LevelsPerSide),
		"--interval-seconds", strconv.Itoa(spec.IntervalSeconds),
		"--mode", strategyMode(spec.Mode),
	}
	args = appendStrategyWallet(args, spec.Mode, spec.Wallet)
	if spec.CenterOnMark {
		args = append(args, "--center-on-mark", "--width-pct", formatFloat(spec.WidthPct))
	} else {
		args = append(args, "--lower-price", formatFloat(spec.LowerPrice), "--upper-price", formatFloat(spec.UpperPrice))
	}
	if spec.TokensPerLevel > 0 {
		args = append(args, "--tokens-per-level", formatFloat(spec.TokensPerLevel))
	}
	if spec.SizeLotsPerLevel > 0 {
		args = append(args, "--size-lots-per-level", formatFloat(spec.SizeLotsPerLevel))
	}
	if spec.RunUntilStopped {
		args = append(args, "--run-until-stopped")
	} else {
		args = append(args, "--ticks", strconv.Itoa(spec.Ticks))
	}
	args = appendStrategyCommon(args, r.cfg, strategyGuardrails{
		MaxStepNotionalUSDC:  spec.MaxStepNotionalUSDC,
		MaxTotalNotionalUSDC: spec.MaxTotalNotionalUSDC,
		MaxPriceDriftBPS:     spec.MaxPriceDriftBPS,
		MaxExposureRatio:     spec.MaxExposureRatio,
	})
	if spec.RunLabel != "" {
		args = append(args, "--run-label", spec.RunLabel)
	}
	if spec.Detached {
		args = append(args, "--detached")
	}
	args = append(args, "-o", "json")
	return args, nil
}

func paperOrderArgs(spec OrderSpec) []string {
	args := []string{"paper", spec.Side, spec.Symbol, "--type", spec.OrderType}
	args = appendSizeFlags(args, spec.Size, spec.Tokens, spec.NotionalUSDC)
	if spec.Price > 0 {
		args = append(args, "--price", formatFloat(spec.Price))
	}
	args = append(args, "-o", "json")
	return args
}

func appendSizeFlags(args []string, size, tokens, notional float64) []string {
	switch {
	case size > 0:
		return append(args, "--size", formatFloat(size))
	case tokens > 0:
		return append(args, "--tokens", formatFloat(tokens))
	case notional > 0:
		return append(args, "--notional-usdc", formatFloat(notional))
	default:
		return args
	}
}

type strategyGuardrails struct {
	MaxStepNotionalUSDC  float64
	MaxTotalNotionalUSDC float64
	MaxPriceDriftBPS     int
	MaxExposureRatio     float64
}

func appendStrategyCommon(args []string, cfg Config, g strategyGuardrails) []string {
	cfg = cfg.normalized()
	if g.MaxStepNotionalUSDC <= 0 {
		g.MaxStepNotionalUSDC = cfg.MaxStepNotionalUSDC
	}
	if g.MaxTotalNotionalUSDC <= 0 {
		g.MaxTotalNotionalUSDC = cfg.MaxTotalNotionalUSDC
	}
	if g.MaxPriceDriftBPS <= 0 {
		g.MaxPriceDriftBPS = cfg.MaxPriceDriftBPS
	}
	if g.MaxExposureRatio <= 0 {
		g.MaxExposureRatio = cfg.MaxExposureRatio
	}
	return append(args,
		"--max-step-notional-usdc", formatFloat(g.MaxStepNotionalUSDC),
		"--max-total-notional-usdc", formatFloat(g.MaxTotalNotionalUSDC),
		"--max-price-drift-bps", strconv.Itoa(g.MaxPriceDriftBPS),
		"--max-exposure-ratio", formatFloat(g.MaxExposureRatio),
	)
}

func appendStrategyWallet(args []string, mode, wallet string) []string {
	if IsLiveMode(mode) && wallet != "" {
		return append(args, "-w", wallet)
	}
	return args
}

func strategyMode(mode string) string {
	switch NormalizeMode(mode) {
	case ModeConfirmEach:
		return "confirm-each"
	case ModeAutoExecute, ModeLive:
		return "auto-execute"
	case ModeDryRun:
		return "dry-run"
	default:
		return "paper"
	}
}

func countPositive(values ...float64) int {
	n := 0
	for _, v := range values {
		if v > 0 {
			n++
		}
	}
	return n
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode()
	}
	return -1
}
