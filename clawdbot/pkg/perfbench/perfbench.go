// Package perfbench provides a small Zero-inspired performance smoke benchmark.
package perfbench

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"time"
)

type Thresholds struct {
	ColdStartP95Ms   float64 `json:"coldStartP95Ms"`
	FirstOutputP95Ms float64 `json:"firstOutputP95Ms"`
}

type NumericStats struct {
	Samples []float64 `json:"samples"`
	Min     float64   `json:"min"`
	Median  float64   `json:"median"`
	Average float64   `json:"average"`
	P95     float64   `json:"p95"`
	Max     float64   `json:"max"`
}

type Warning struct {
	Metric    string  `json:"metric"`
	Observed  float64 `json:"observed"`
	Threshold float64 `json:"threshold"`
	Message   string  `json:"message"`
}

type Result struct {
	Timestamp           string       `json:"timestamp"`
	Command             []string     `json:"command"`
	Iterations          int          `json:"iterations"`
	WarmupIterations    int          `json:"warmupIterations"`
	GoVersion           string       `json:"goVersion"`
	GOOS                string       `json:"goos"`
	GOARCH              string       `json:"goarch"`
	ColdStartMs         NumericStats `json:"coldStartMs"`
	FirstOutputMs       NumericStats `json:"firstOutputMs"`
	BenchmarkDurationMs float64      `json:"benchmarkDurationMs"`
	Thresholds          Thresholds   `json:"thresholds"`
	Warnings            []Warning    `json:"warnings"`
}

type Options struct {
	Command          []string
	Iterations       int
	WarmupIterations int
	Thresholds       Thresholds
}

var DefaultThresholds = Thresholds{
	ColdStartP95Ms:   300,
	FirstOutputP95Ms: 500,
}

func Run(ctx context.Context, options Options) (Result, error) {
	if options.Iterations <= 0 {
		return Result{}, errors.New("iterations must be positive")
	}
	if options.WarmupIterations < 0 {
		return Result{}, errors.New("warmup iterations must be non-negative")
	}
	command := options.Command
	if len(command) == 0 {
		exe, err := os.Executable()
		if err != nil {
			return Result{}, err
		}
		command = []string{exe, "version"}
	}
	if options.Thresholds.ColdStartP95Ms == 0 {
		options.Thresholds = DefaultThresholds
	}

	start := time.Now()
	for i := 0; i < options.WarmupIterations; i++ {
		if _, err := measureColdStart(ctx, command); err != nil {
			return Result{}, err
		}
		if _, err := measureFirstOutput(ctx, command); err != nil {
			return Result{}, err
		}
	}

	cold := make([]float64, 0, options.Iterations)
	first := make([]float64, 0, options.Iterations)
	for i := 0; i < options.Iterations; i++ {
		v, err := measureColdStart(ctx, command)
		if err != nil {
			return Result{}, err
		}
		cold = append(cold, v)
		v, err = measureFirstOutput(ctx, command)
		if err != nil {
			return Result{}, err
		}
		first = append(first, v)
	}

	result := Result{
		Timestamp:           time.Now().UTC().Format(time.RFC3339Nano),
		Command:             append([]string(nil), command...),
		Iterations:          options.Iterations,
		WarmupIterations:    options.WarmupIterations,
		GoVersion:           runtime.Version(),
		GOOS:                runtime.GOOS,
		GOARCH:              runtime.GOARCH,
		ColdStartMs:         summarize(cold),
		FirstOutputMs:       summarize(first),
		BenchmarkDurationMs: roundMs(time.Since(start)),
		Thresholds:          options.Thresholds,
	}
	result.Warnings = warnings(result)
	return result, nil
}

func Format(result Result) string {
	lines := []string{
		fmt.Sprintf("ClawdBot performance bench (%s/%s, %s)", result.GOOS, result.GOARCH, result.GoVersion),
		"command: " + strings.Join(result.Command, " "),
		fmt.Sprintf("iterations: %d measured, %d warmup", result.Iterations, result.WarmupIterations),
		fmt.Sprintf("cold start: median %.2fms, p95 %.2fms (warn > %.2fms)", result.ColdStartMs.Median, result.ColdStartMs.P95, result.Thresholds.ColdStartP95Ms),
		fmt.Sprintf("first output: median %.2fms, p95 %.2fms (warn > %.2fms)", result.FirstOutputMs.Median, result.FirstOutputMs.P95, result.Thresholds.FirstOutputP95Ms),
	}
	if len(result.Warnings) == 0 {
		lines = append(lines, "warnings: none")
	} else {
		lines = append(lines, "warnings:")
		for _, warning := range result.Warnings {
			lines = append(lines, "- "+warning.Message)
		}
	}
	return strings.Join(lines, "\n")
}

func WriteJSON(w io.Writer, result Result) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(result)
}

func measureColdStart(ctx context.Context, command []string) (float64, error) {
	start := time.Now()
	cmd := exec.CommandContext(ctx, command[0], command[1:]...)
	if err := cmd.Run(); err != nil {
		return 0, err
	}
	return roundMs(time.Since(start)), nil
}

func measureFirstOutput(ctx context.Context, command []string) (float64, error) {
	start := time.Now()
	cmd := exec.CommandContext(ctx, command[0], command[1:]...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return 0, err
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		return 0, err
	}
	reader := bufio.NewReader(stdout)
	_, _ = reader.ReadBytes('\n')
	first := roundMs(time.Since(start))
	if err := cmd.Wait(); err != nil {
		return 0, err
	}
	return first, nil
}

func summarize(samples []float64) NumericStats {
	sorted := append([]float64(nil), samples...)
	sort.Float64s(sorted)
	total := 0.0
	for _, sample := range sorted {
		total += sample
	}
	return NumericStats{
		Samples: sorted,
		Min:     sorted[0],
		Median:  percentile(sorted, 50),
		Average: total / float64(len(sorted)),
		P95:     percentile(sorted, 95),
		Max:     sorted[len(sorted)-1],
	}
}

func percentile(sorted []float64, p int) float64 {
	if len(sorted) == 0 {
		return 0
	}
	index := (p*len(sorted) + 99) / 100
	if index < 1 {
		index = 1
	}
	if index > len(sorted) {
		index = len(sorted)
	}
	return sorted[index-1]
}

func warnings(result Result) []Warning {
	out := []Warning{}
	if result.ColdStartMs.P95 > result.Thresholds.ColdStartP95Ms {
		out = append(out, Warning{
			Metric:    "coldStartMs.p95",
			Observed:  result.ColdStartMs.P95,
			Threshold: result.Thresholds.ColdStartP95Ms,
			Message:   fmt.Sprintf("cold start p95 %.2fms exceeds %.2fms", result.ColdStartMs.P95, result.Thresholds.ColdStartP95Ms),
		})
	}
	if result.FirstOutputMs.P95 > result.Thresholds.FirstOutputP95Ms {
		out = append(out, Warning{
			Metric:    "firstOutputMs.p95",
			Observed:  result.FirstOutputMs.P95,
			Threshold: result.Thresholds.FirstOutputP95Ms,
			Message:   fmt.Sprintf("first output p95 %.2fms exceeds %.2fms", result.FirstOutputMs.P95, result.Thresholds.FirstOutputP95Ms),
		})
	}
	return out
}

func roundMs(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000
}
