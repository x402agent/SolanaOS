package dna

import (
	"path/filepath"
	"testing"
	"time"
)

func TestGenerateDeterministicWithSeed(t *testing.T) {
	now := time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)
	opts := Options{
		AgentName:   "Test Agent",
		Role:        "research scout",
		Seed:        "fixed-seed",
		Length:      128,
		GeneratedAt: now,
	}

	first, err := Generate(opts)
	if err != nil {
		t.Fatalf("generate first: %v", err)
	}
	second, err := Generate(opts)
	if err != nil {
		t.Fatalf("generate second: %v", err)
	}

	if first.Sequence.Value != second.Sequence.Value {
		t.Fatalf("sequence should be deterministic with a seed")
	}
	if first.Proof.SequenceSHA256 != second.Proof.SequenceSHA256 {
		t.Fatalf("proof hash should be deterministic with a seed")
	}
	if first.Agent.Slug != "test-agent" {
		t.Fatalf("unexpected slug: %s", first.Agent.Slug)
	}
}

func TestGenerateIncludesMotifMetricsAndProof(t *testing.T) {
	value, err := Generate(Options{
		AgentName:   "Metrics Agent",
		Seed:        "metrics-seed",
		Length:      160,
		GeneratedAt: time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	if value.Sequence.Length != 160 {
		t.Fatalf("unexpected length: %d", value.Sequence.Length)
	}
	if len(value.Metrics.PAMSites) == 0 {
		t.Fatalf("expected at least one PAM motif")
	}
	if len(value.Metrics.TATABoxes) == 0 {
		t.Fatalf("expected at least one TATA motif")
	}
	if value.Metrics.UtilityScore <= 0 || value.Metrics.UtilityScore > 100 {
		t.Fatalf("utility score out of range: %d", value.Metrics.UtilityScore)
	}
	if value.Proof.DNAID == "" || value.Proof.SequenceSHA256 == "" || value.Proof.Nullifier == "" {
		t.Fatalf("proof fields should be populated: %#v", value.Proof)
	}
	if value.Attestation.Status != "local_pending" {
		t.Fatalf("unexpected attestation status: %s", value.Attestation.Status)
	}
}

func TestEnsureFileDoesNotOverwriteExistingDNA(t *testing.T) {
	path := filepath.Join(t.TempDir(), DefaultFileName)
	original, created, err := EnsureFile(path, Options{Seed: "original", GeneratedAt: time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)})
	if err != nil {
		t.Fatalf("ensure original: %v", err)
	}
	if !created {
		t.Fatalf("expected first ensure to create the file")
	}

	existing, created, err := EnsureFile(path, Options{Seed: "new", GeneratedAt: time.Date(2026, 7, 4, 12, 0, 0, 0, time.UTC)})
	if err != nil {
		t.Fatalf("ensure existing: %v", err)
	}
	if created {
		t.Fatalf("expected second ensure to preserve the file")
	}
	if existing.Proof.SequenceSHA256 != original.Proof.SequenceSHA256 {
		t.Fatalf("existing DNA was overwritten")
	}
}
