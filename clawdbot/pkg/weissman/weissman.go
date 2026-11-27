// Package weissman computes a live footprint report for the ClawdBot source
// tree and a Weissman score for its compressibility.
//
// The Weissman score (Dr. Tsachy Weissman / HBO's Silicon Valley "Pied Piper")
// rates a target compressor against a standard one:
//
//	W = alpha * (r / r_std) * (log(T_std) / log(T))
//
// where r is the compression ratio (uncompressed/compressed), T is the compression
// time, and alpha is scaled so the standard compressor scores 1.0. Here the
// standard is gzip and the target is zstd (max level); a score above 1.0 means
// zstd beats gzip on the ratio/time tradeoff for this corpus.
package weissman

import (
	"bytes"
	"compress/gzip"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/klauspost/compress/zstd"
)

// TargetBytes is the footprint budget the console tracks against (2.0 MB).
const TargetBytes = 2_000_000

// Report is the full footprint + compressibility snapshot.
type Report struct {
	Files       int     `json:"files"`
	RawBytes    int64   `json:"rawBytes"`
	RawMB       float64 `json:"rawMB"`
	TargetBytes int64   `json:"targetBytes"`
	TargetMB    float64 `json:"targetMB"`
	UnderTarget bool    `json:"underTarget"`
	PctOfTarget float64 `json:"pctOfTarget"`

	GzipBytes  int64   `json:"gzipBytes"`
	GzipRatio  float64 `json:"gzipRatio"`
	GzipMicros int64   `json:"gzipMicros"`

	ZstdBytes  int64   `json:"zstdBytes"`
	ZstdRatio  float64 `json:"zstdRatio"`
	ZstdMicros int64   `json:"zstdMicros"`

	WeissmanScore float64 `json:"weissmanScore"`
	Verdict       string  `json:"verdict"`
	GeneratedAt   string  `json:"generatedAt"`
}

// sourceExts are the extensions counted as "source" for the footprint.
var sourceExts = map[string]bool{
	".go": true, ".ts": true, ".tsx": true, ".js": true, ".jsx": true,
	".rs": true, ".py": true, ".sh": true, ".md": true, ".toml": true,
	".sql": true, ".html": true, ".css": true, ".json": true, ".mod": true,
}

// skipDirs are never descended into when scanning the source tree.
var skipDirs = map[string]bool{
	".git": true, "node_modules": true, "dist": true, "build": true,
	".gomodcache": true, ".wrangler": true, "vendor": true,
}

// ScanSource walks root and returns the concatenated bytes of all source files
// plus the file count, so the same corpus feeds both the size and the score.
func ScanSource(root string) ([]byte, int, error) {
	var buf bytes.Buffer
	files := 0
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries rather than abort the whole scan
		}
		if d.IsDir() {
			if skipDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if !sourceExts[strings.ToLower(filepath.Ext(d.Name()))] {
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil
		}
		buf.Write(data)
		files++
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return buf.Bytes(), files, nil
}

// Analyze compresses corpus with gzip (standard) and zstd (target) and computes
// the Weissman score. files is the source file count for reporting.
func Analyze(corpus []byte, files int) Report {
	raw := int64(len(corpus))
	r := Report{
		Files:       files,
		RawBytes:    raw,
		RawMB:       bytesToMB(raw),
		TargetBytes: TargetBytes,
		TargetMB:    bytesToMB(TargetBytes),
		UnderTarget: raw <= TargetBytes,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if TargetBytes > 0 {
		r.PctOfTarget = float64(raw) / float64(TargetBytes) * 100
	}
	if raw == 0 {
		r.Verdict = "no source found"
		return r
	}

	gzBytes, gzMicros := gzipCompress(corpus)
	r.GzipBytes = gzBytes
	r.GzipMicros = gzMicros
	r.GzipRatio = ratio(raw, gzBytes)

	zsBytes, zsMicros := zstdCompress(corpus)
	r.ZstdBytes = zsBytes
	r.ZstdMicros = zsMicros
	r.ZstdRatio = ratio(raw, zsBytes)

	r.WeissmanScore = weissman(r.ZstdRatio, r.GzipRatio, zsMicros, gzMicros)
	r.Verdict = verdict(r)
	return r
}

// Run scans root and analyzes it in one call.
func Run(root string) (Report, error) {
	corpus, files, err := ScanSource(root)
	if err != nil {
		return Report{}, err
	}
	return Analyze(corpus, files), nil
}

// weissman implements W = (rTarget/rStd) * (log(tStd)/log(tTarget)), with alpha=1
// so the standard compressor scores exactly 1.0 against itself. Times are in
// microseconds; a floor keeps log() well-defined for sub-microsecond runs.
func weissman(rTarget, rStd float64, tTargetMicros, tStdMicros int64) float64 {
	if rStd <= 0 || rTarget <= 0 {
		return 0
	}
	tTarget := math.Max(float64(tTargetMicros), 2)
	tStd := math.Max(float64(tStdMicros), 2)
	logTarget := math.Log(tTarget)
	logStd := math.Log(tStd)
	if logTarget <= 0 {
		return 0
	}
	score := (rTarget / rStd) * (logStd / logTarget)
	if math.IsNaN(score) || math.IsInf(score, 0) {
		return 0
	}
	return score
}

func gzipCompress(data []byte) (int64, int64) {
	var buf bytes.Buffer
	start := time.Now()
	zw, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	_, _ = zw.Write(data)
	_ = zw.Close()
	elapsed := time.Since(start).Microseconds()
	return int64(buf.Len()), elapsed
}

func zstdCompress(data []byte) (int64, int64) {
	var buf bytes.Buffer
	start := time.Now()
	zw, err := zstd.NewWriter(&buf, zstd.WithEncoderLevel(zstd.SpeedBestCompression))
	if err != nil {
		return 0, 0
	}
	_, _ = zw.Write(data)
	_ = zw.Close()
	elapsed := time.Since(start).Microseconds()
	return int64(buf.Len()), elapsed
}

func ratio(raw, compressed int64) float64 {
	if compressed <= 0 {
		return 0
	}
	return float64(raw) / float64(compressed)
}

func bytesToMB(b int64) float64 {
	return float64(b) / 1_000_000
}

func verdict(r Report) string {
	switch {
	case !r.UnderTarget:
		return "over budget — trim the tree"
	case r.WeissmanScore >= 1.0:
		return "lean & highly compressible — Pied Piper approved"
	case r.PctOfTarget < 50:
		return "well under budget"
	default:
		return "within budget"
	}
}
