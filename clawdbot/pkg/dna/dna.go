// Package dna generates a synthetic DNA profile for a Clawd agent.
package dna

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	SchemaVersion         = "clawd.agent.dna/v1"
	DefaultFileName       = "agent-dna.json"
	DefaultSequenceLength = 256
	MinSequenceLength     = 64
	MaxSequenceLength     = 4096
)

type Options struct {
	AgentName   string
	Role        string
	Seed        string
	Length      int
	GeneratedAt time.Time
}

type AgentDNA struct {
	SchemaVersion string       `json:"schemaVersion"`
	GeneratedAt   string       `json:"generatedAt"`
	Agent         AgentProfile `json:"agent"`
	Sequence      Sequence     `json:"sequence"`
	Metrics       Metrics      `json:"metrics"`
	Traits        Traits       `json:"traits"`
	Proof         Proof        `json:"proof"`
	Attestation   Attestation  `json:"attestation"`
	Safety        string       `json:"safety"`
}

type AgentProfile struct {
	Name    string   `json:"name"`
	Slug    string   `json:"slug"`
	Role    string   `json:"role"`
	Lineage []string `json:"lineage"`
}

type Sequence struct {
	Alphabet string `json:"alphabet"`
	Length   int    `json:"length"`
	Value    string `json:"value"`
	SeedHash string `json:"seedHash"`
}

type Metrics struct {
	GCContent     float64    `json:"gcContent"`
	ATContent     float64    `json:"atContent"`
	PAMSites      []MotifHit `json:"pamSites"`
	TATABoxes     []MotifHit `json:"tataBoxes"`
	UtilityScore  int        `json:"utilityScore"`
	StabilityBand string     `json:"stabilityBand"`
}

type MotifHit struct {
	Motif string `json:"motif"`
	Index int    `json:"index"`
}

type Traits struct {
	Observation int `json:"observation"`
	Orientation int `json:"orientation"`
	Decision    int `json:"decision"`
	Action      int `json:"action"`
	Risk        int `json:"risk"`
	Privacy     int `json:"privacy"`
	Attestation int `json:"attestation"`
}

type Proof struct {
	DNAID          string `json:"dnaId"`
	SequenceSHA256 string `json:"sequenceSha256"`
	Nullifier      string `json:"nullifier"`
}

type Attestation struct {
	Status  string `json:"status"`
	Network string `json:"network"`
	Schema  string `json:"schema"`
	PDASeed string `json:"pdaSeed"`
}

func DefaultPath(workspace string) string {
	if strings.TrimSpace(workspace) == "" {
		workspace = "."
	}
	return filepath.Join(workspace, DefaultFileName)
}

func Generate(opts Options) (AgentDNA, error) {
	name := strings.TrimSpace(opts.AgentName)
	if name == "" {
		name = "ClawdBot"
	}
	role := strings.TrimSpace(opts.Role)
	if role == "" {
		role = "sovereign Solana trading agent"
	}
	length := opts.Length
	if length == 0 {
		length = DefaultSequenceLength
	}
	if length < MinSequenceLength || length > MaxSequenceLength {
		return AgentDNA{}, fmt.Errorf("sequence length must be between %d and %d", MinSequenceLength, MaxSequenceLength)
	}
	generatedAt := opts.GeneratedAt
	if generatedAt.IsZero() {
		generatedAt = time.Now()
	}
	generatedAt = generatedAt.UTC()

	seed := strings.TrimSpace(opts.Seed)
	if seed == "" {
		randomSeed, err := randomHex(32)
		if err != nil {
			return AgentDNA{}, err
		}
		seed = randomSeed
	}

	seedHash := hashHex("seed:" + seed + "|name:" + name + "|role:" + role)
	sequence := imprintMotifs(buildSequence(seedHash, length), seedHash)
	traits := buildTraits(seedHash)
	metrics := Analyze(sequence, traits)
	sequenceHash := hashHex(sequence)
	nullifier := hashHex("nullifier:" + seedHash + ":" + sequenceHash)
	dnaID := "clawd-dna-" + sequenceHash[:16]

	return AgentDNA{
		SchemaVersion: SchemaVersion,
		GeneratedAt:   generatedAt.Format(time.RFC3339),
		Agent: AgentProfile{
			Name: name,
			Slug: slugify(name),
			Role: role,
			Lineage: []string{
				"clawdbot-go",
				"six-law-harness",
				"zk-primitives",
			},
		},
		Sequence: Sequence{
			Alphabet: "ACGT",
			Length:   len(sequence),
			Value:    sequence,
			SeedHash: seedHash,
		},
		Metrics: metrics,
		Traits:  traits,
		Proof: Proof{
			DNAID:          dnaID,
			SequenceSHA256: sequenceHash,
			Nullifier:      nullifier,
		},
		Attestation: Attestation{
			Status:  "local_pending",
			Network: "solana-devnet",
			Schema:  SchemaVersion,
			PDASeed: "sas-devnet-" + hashHex("sas:" + dnaID + ":" + nullifier)[:32],
		},
		Safety: "Synthetic agent DNA for identity, scoring, and attestation metadata. Not biological or clinical instruction.",
	}, nil
}

func Analyze(sequence string, traits Traits) Metrics {
	sequence = strings.ToUpper(strings.TrimSpace(sequence))
	total := len(sequence)
	if total == 0 {
		return Metrics{StabilityBand: "empty"}
	}

	gc := 0
	at := 0
	for _, base := range sequence {
		switch base {
		case 'G', 'C':
			gc++
		case 'A', 'T':
			at++
		}
	}

	gcContent := round2(float64(gc) / float64(total) * 100)
	atContent := round2(float64(at) / float64(total) * 100)
	pamSites := findPAMSites(sequence)
	tataBoxes := findTATABoxes(sequence)
	stabilityBand := "balanced"
	if gcContent < 35 {
		stabilityBand = "low_gc"
	} else if gcContent > 65 {
		stabilityBand = "high_gc"
	}

	gcBalance := 1 - math.Abs(gcContent-50)/50
	pamScore := math.Min(float64(len(pamSites)), 4) / 4
	tataScore := math.Min(float64(len(tataBoxes)), 2) / 2
	traitScore := float64(traits.sum()) / 700
	utility := int(math.Round(100 * (0.35*gcBalance + 0.20*pamScore + 0.20*tataScore + 0.25*traitScore)))
	if utility < 0 {
		utility = 0
	}
	if utility > 100 {
		utility = 100
	}

	return Metrics{
		GCContent:     gcContent,
		ATContent:     atContent,
		PAMSites:      pamSites,
		TATABoxes:     tataBoxes,
		UtilityScore:  utility,
		StabilityBand: stabilityBand,
	}
}

func WriteFile(path string, value AgentDNA) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("dna path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

func ReadFile(path string) (AgentDNA, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return AgentDNA{}, err
	}
	var value AgentDNA
	if err := json.Unmarshal(data, &value); err != nil {
		return AgentDNA{}, err
	}
	return value, nil
}

func EnsureFile(path string, opts Options) (AgentDNA, bool, error) {
	if existing, err := ReadFile(path); err == nil {
		return existing, false, nil
	} else if !os.IsNotExist(err) {
		return AgentDNA{}, false, err
	}
	value, err := Generate(opts)
	if err != nil {
		return AgentDNA{}, false, err
	}
	if err := WriteFile(path, value); err != nil {
		return AgentDNA{}, false, err
	}
	return value, true, nil
}

func Format(value AgentDNA) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Agent DNA: %s (%s)\n", value.Agent.Name, value.Agent.Role)
	fmt.Fprintf(&b, "id: %s\n", value.Proof.DNAID)
	fmt.Fprintf(&b, "schema: %s\n", value.SchemaVersion)
	fmt.Fprintf(&b, "generated: %s\n", value.GeneratedAt)
	fmt.Fprintf(&b, "sequence: %d bases, GC %.2f%%, stability %s\n", value.Sequence.Length, value.Metrics.GCContent, value.Metrics.StabilityBand)
	fmt.Fprintf(&b, "motifs: %d PAM, %d TATA\n", len(value.Metrics.PAMSites), len(value.Metrics.TATABoxes))
	fmt.Fprintf(&b, "utility: %d/100\n", value.Metrics.UtilityScore)
	fmt.Fprintf(&b, "proof: %s\n", value.Proof.SequenceSHA256)
	fmt.Fprintf(&b, "attestation: %s (%s)\n", value.Attestation.Status, value.Attestation.PDASeed)
	return strings.TrimRight(b.String(), "\n")
}

func buildSequence(seedHash string, length int) string {
	const alphabet = "ACGT"
	var b strings.Builder
	b.Grow(length)
	for counter := 0; b.Len() < length; counter++ {
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", seedHash, counter)))
		for _, value := range sum[:] {
			if b.Len() >= length {
				break
			}
			b.WriteByte(alphabet[int(value)%len(alphabet)])
		}
	}
	return b.String()
}

func imprintMotifs(sequence string, seedHash string) string {
	if len(sequence) >= 96 {
		limit := len(sequence)/3 - len("TATAAA")
		sequence = replaceAt(sequence, "TATAAA", indexFromHash(seedHash, "tata", limit))
	}
	if len(sequence) >= 64 {
		options := []string{"AGG", "CGG", "TGG", "GGG"}
		motif := options[indexFromHash(seedHash, "pam-option", len(options)-1)]
		start := len(sequence) / 3
		limit := len(sequence) - start - len(motif)
		sequence = replaceAt(sequence, motif, start+indexFromHash(seedHash, "pam", limit))
	}
	return sequence
}

func replaceAt(sequence, motif string, index int) string {
	if index < 0 || index+len(motif) > len(sequence) {
		return sequence
	}
	return sequence[:index] + motif + sequence[index+len(motif):]
}

func buildTraits(seedHash string) Traits {
	sum := sha256.Sum256([]byte("traits:" + seedHash))
	score := func(index int) int {
		return 50 + int(sum[index]%51)
	}
	return Traits{
		Observation: score(0),
		Orientation: score(1),
		Decision:    score(2),
		Action:      score(3),
		Risk:        score(4),
		Privacy:     score(5),
		Attestation: score(6),
	}
}

func (t Traits) sum() int {
	return t.Observation + t.Orientation + t.Decision + t.Action + t.Risk + t.Privacy + t.Attestation
}

func findPAMSites(sequence string) []MotifHit {
	hits := []MotifHit{}
	for i := 0; i+2 < len(sequence); i++ {
		if sequence[i+1] == 'G' && sequence[i+2] == 'G' {
			hits = append(hits, MotifHit{Motif: sequence[i : i+3], Index: i})
		}
	}
	return hits
}

func findTATABoxes(sequence string) []MotifHit {
	motifs := []string{"TATAAA", "TATATA"}
	hits := []MotifHit{}
	for _, motif := range motifs {
		offset := 0
		for {
			idx := strings.Index(sequence[offset:], motif)
			if idx < 0 {
				break
			}
			hits = append(hits, MotifHit{Motif: motif, Index: offset + idx})
			offset += idx + 1
		}
	}
	return hits
}

func indexFromHash(seedHash, label string, max int) int {
	if max <= 0 {
		return 0
	}
	sum := sha256.Sum256([]byte(label + ":" + seedHash))
	return int(binary.BigEndian.Uint64(sum[:8]) % uint64(max+1))
}

func hashHex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("random seed: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

var nonSlugChar = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	slug := strings.Trim(nonSlugChar.ReplaceAllString(strings.ToLower(value), "-"), "-")
	if slug == "" {
		return "clawdbot"
	}
	return slug
}
