// Package agent — smart_routing.go selects the best model for a given task.
// Adapted from Hermes Agent's smart_model_routing.py.
//
// Routes requests to the cheapest sufficient model based on task complexity.
package agent

import (
	"strings"
)

// TaskComplexity classifies how hard a request is.
type TaskComplexity int

const (
	ComplexitySimple   TaskComplexity = iota // quick lookup, status check
	ComplexityModerate                        // analysis, comparison, multi-step
	ComplexityComplex                         // research, strategy, code generation
	ComplexityExpert                           // multi-tool orchestration, novel reasoning
)

// ClassifyComplexity estimates task complexity from the user's message.
func ClassifyComplexity(message string) TaskComplexity {
	lower := strings.ToLower(message)
	length := len(message)

	// Expert: long messages with research/strategy keywords
	expertSignals := []string{
		"research", "analyze in detail", "comprehensive", "deep dive",
		"compare all", "build a strategy", "write a",
	}
	for _, s := range expertSignals {
		if strings.Contains(lower, s) {
			return ComplexityExpert
		}
	}

	// Complex: multi-step or analytical tasks
	complexSignals := []string{
		"explain", "why", "how does", "strategy", "calculate",
		"create", "generate", "implement", "debug",
	}
	for _, s := range complexSignals {
		if strings.Contains(lower, s) {
			return ComplexityComplex
		}
	}

	// Simple: short commands and status checks
	if length < 30 {
		return ComplexitySimple
	}

	simpleSignals := []string{
		"/status", "/wallet", "/balance", "/trending", "/pet",
		"price of", "what is", "show me",
	}
	for _, s := range simpleSignals {
		if strings.Contains(lower, s) {
			return ComplexitySimple
		}
	}

	return ComplexityModerate
}

// RouteModel selects the best model for the task complexity.
// Returns the model ID to use.
func RouteModel(complexity TaskComplexity, defaultModel, fastModel, powerModel string) string {
	if fastModel == "" {
		fastModel = defaultModel
	}
	if powerModel == "" {
		powerModel = defaultModel
	}

	switch complexity {
	case ComplexitySimple:
		return fastModel
	case ComplexityModerate:
		return defaultModel
	case ComplexityComplex, ComplexityExpert:
		return powerModel
	default:
		return defaultModel
	}
}
