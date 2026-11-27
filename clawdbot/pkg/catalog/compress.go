package catalog

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	PackSchemaVersion = "clawd.catalog.pack/v1"
	PackFormat        = "tar+gzip"
)

type PackOptions struct {
	OutputPath    string `json:"outputPath,omitempty"`
	Query         string `json:"query,omitempty"`
	IncludeSkills bool   `json:"includeSkills"`
	IncludeAgents bool   `json:"includeAgents"`
	IncludeZK     bool   `json:"includeZk"`
	DryRun        bool   `json:"dryRun,omitempty"`
}

type PackResult struct {
	OutputPath       string      `json:"outputPath,omitempty"`
	Format           string      `json:"format"`
	SchemaVersion    string      `json:"schemaVersion"`
	FileCount        int         `json:"fileCount"`
	SkillCount       int         `json:"skillCount"`
	AgentCount       int         `json:"agentCount"`
	ZKFileCount      int         `json:"zkFileCount"`
	OriginalBytes    int64       `json:"originalBytes"`
	PackedBytes      int64       `json:"packedBytes"`
	SavedBytes       int64       `json:"savedBytes"`
	CompressionRatio float64     `json:"compressionRatio"`
	SavingsPercent   float64     `json:"savingsPercent"`
	Entries          []PackEntry `json:"entries,omitempty"`
	Warnings         []string    `json:"warnings,omitempty"`
}

type PackEntry struct {
	Path          string `json:"path"`
	SourcePath    string `json:"sourcePath,omitempty"`
	Kind          string `json:"kind"`
	OriginalBytes int64  `json:"originalBytes"`
	PayloadBytes  int64  `json:"payloadBytes"`
}

type packManifest struct {
	SchemaVersion string      `json:"schemaVersion"`
	Format        string      `json:"format"`
	Query         string      `json:"query,omitempty"`
	Components    []string    `json:"components"`
	FileCount     int         `json:"fileCount"`
	SkillCount    int         `json:"skillCount"`
	AgentCount    int         `json:"agentCount"`
	ZKFileCount   int         `json:"zkFileCount"`
	OriginalBytes int64       `json:"originalBytes"`
	PayloadBytes  int64       `json:"payloadBytes"`
	Entries       []PackEntry `json:"entries"`
	Warnings      []string    `json:"warnings,omitempty"`
}

type packFile struct {
	archivePath   string
	sourcePath    string
	kind          string
	originalBytes int64
	payload       []byte
}

var packExcludedDirs = map[string]bool{
	".cache":          true,
	".git":            true,
	".next":           true,
	"__screenshots__": true,
	"build":           true,
	"coverage":        true,
	"dist":            true,
	"node_modules":    true,
	"target":          true,
}

var packExcludedFiles = map[string]bool{
	".DS_Store":         true,
	".npmrc":            true,
	".pypirc":           true,
	"bun.lockb":         true,
	"credentials.json":  true,
	"coverage.out":      true,
	"id_ed25519":        true,
	"id_rsa":            true,
	"package-lock.json": true,
	"pnpm-lock.yaml":    true,
	"secret.json":       true,
	"secrets.json":      true,
	"token.json":        true,
	"tokens.json":       true,
	"yarn.lock":         true,
}

func DefaultPackOptions(outputPath string) PackOptions {
	return PackOptions{
		OutputPath:    outputPath,
		IncludeSkills: true,
		IncludeAgents: true,
		IncludeZK:     true,
	}
}

func CompressReport(report Report, opts PackOptions) (PackResult, error) {
	opts = normalizePackOptions(opts)

	files, result, err := collectPackFiles(report, opts)
	if err != nil {
		return PackResult{}, err
	}
	if len(files) == 0 {
		return PackResult{}, errors.New("no catalog files matched compression options")
	}

	sort.SliceStable(files, func(i, j int) bool {
		return files[i].archivePath < files[j].archivePath
	})

	result.Format = PackFormat
	result.SchemaVersion = PackSchemaVersion
	result.OutputPath = opts.OutputPath
	result.FileCount = len(files)
	result.Warnings = append(result.Warnings, report.Warnings...)
	result.Entries = make([]PackEntry, 0, len(files))

	var payloadBytes int64
	for _, file := range files {
		payloadBytes += int64(len(file.payload))
		result.OriginalBytes += file.originalBytes
		result.Entries = append(result.Entries, PackEntry{
			Path:          file.archivePath,
			SourcePath:    file.sourcePath,
			Kind:          file.kind,
			OriginalBytes: file.originalBytes,
			PayloadBytes:  int64(len(file.payload)),
		})
	}

	manifest, err := buildPackManifest(opts, result, payloadBytes)
	if err != nil {
		return PackResult{}, err
	}

	packedBytes, err := writePackArchive(opts.OutputPath, manifest, files, opts.DryRun)
	if err != nil {
		return PackResult{}, err
	}
	result.PackedBytes = packedBytes
	result.SavedBytes = result.OriginalBytes - result.PackedBytes
	if result.OriginalBytes > 0 {
		result.CompressionRatio = float64(result.PackedBytes) / float64(result.OriginalBytes)
		result.SavingsPercent = float64(result.SavedBytes) / float64(result.OriginalBytes) * 100
	}
	return result, nil
}

func normalizePackOptions(opts PackOptions) PackOptions {
	if !opts.IncludeSkills && !opts.IncludeAgents && !opts.IncludeZK {
		opts.IncludeSkills = true
		opts.IncludeAgents = true
		opts.IncludeZK = true
	}
	return opts
}

func collectPackFiles(report Report, opts PackOptions) ([]packFile, PackResult, error) {
	result := PackResult{}
	seen := map[string]bool{}
	files := []packFile{}
	add := func(file packFile) {
		if seen[file.archivePath] {
			return
		}
		seen[file.archivePath] = true
		files = append(files, file)
		if file.kind == "zk" {
			result.ZKFileCount++
		}
	}

	if opts.IncludeAgents {
		agents := FilterAgents(report.Agents, opts.Query)
		result.AgentCount = len(agents)
		for _, agent := range agents {
			file, ok, err := readPackFile(
				agent.FilePath,
				path.Join("agents", filepath.Base(agent.FilePath)),
				"agent",
			)
			if err != nil {
				return nil, PackResult{}, err
			}
			if ok {
				add(file)
			}
		}
	}

	if opts.IncludeSkills {
		skills := packSkills(FilterSkills(report.Skills, opts.Query), opts)
		result.SkillCount = len(skills)
		for _, skill := range skills {
			skillFiles, err := collectSkillPackFiles(skill)
			if err != nil {
				return nil, PackResult{}, err
			}
			for _, file := range skillFiles {
				add(file)
			}
		}
	}

	if opts.IncludeZK && report.ZK != nil {
		zkFiles, err := collectZKPackFiles(*report.ZK)
		if err != nil {
			return nil, PackResult{}, err
		}
		for _, file := range zkFiles {
			add(file)
		}
	}

	return files, result, nil
}

func packSkills(skills []SkillEntry, opts PackOptions) []SkillEntry {
	out := make([]SkillEntry, 0, len(skills))
	for _, skill := range skills {
		if opts.IncludeZK && skill.Source == "zk-primitives" {
			continue
		}
		out = append(out, skill)
	}
	return out
}

func collectSkillPackFiles(skill SkillEntry) ([]packFile, error) {
	baseDir := skill.BaseDir
	if baseDir == "" && skill.FilePath != "" {
		baseDir = filepath.Dir(skill.FilePath)
	}
	if baseDir == "" {
		return nil, nil
	}

	archiveRoot := path.Join("skills", pathSafeName(firstNonEmpty(skill.Slug, filepath.Base(baseDir))))
	return collectDirectoryPackFiles(baseDir, archiveRoot, "skill")
}

func collectZKPackFiles(surface ZKSurface) ([]packFile, error) {
	if surface.Root == "" {
		return nil, nil
	}
	return collectDirectoryPackFiles(surface.Root, "zk-primitives", "zk")
}

func collectDirectoryPackFiles(root, archiveRoot, kind string) ([]packFile, error) {
	var files []packFile
	err := filepath.WalkDir(root, func(filePath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		name := entry.Name()
		if entry.IsDir() {
			if shouldSkipPackDir(name) {
				return filepath.SkipDir
			}
			return nil
		}
		if shouldSkipPackFile(name) {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		rel, err := filepath.Rel(root, filePath)
		if err != nil {
			return err
		}
		archivePath := path.Join(archiveRoot, filepath.ToSlash(rel))
		file, ok, err := readPackFile(filePath, archivePath, kind)
		if err != nil {
			return err
		}
		if ok {
			files = append(files, file)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

func readPackFile(sourcePath, archivePath, kind string) (packFile, bool, error) {
	archivePath, ok := cleanArchivePath(archivePath)
	if !ok {
		return packFile{}, false, nil
	}
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return packFile{}, false, err
	}
	originalBytes := int64(len(data))
	data = compactJSONPayload(sourcePath, data)
	return packFile{
		archivePath:   archivePath,
		sourcePath:    sourcePath,
		kind:          kind,
		originalBytes: originalBytes,
		payload:       data,
	}, true, nil
}

func compactJSONPayload(sourcePath string, data []byte) []byte {
	if !strings.EqualFold(filepath.Ext(sourcePath), ".json") {
		return data
	}
	var compacted bytes.Buffer
	if err := json.Compact(&compacted, data); err != nil {
		return data
	}
	compacted.WriteByte('\n')
	return compacted.Bytes()
}

func buildPackManifest(opts PackOptions, result PackResult, payloadBytes int64) ([]byte, error) {
	entries := make([]PackEntry, 0, len(result.Entries))
	for _, entry := range result.Entries {
		entry.SourcePath = ""
		entries = append(entries, entry)
	}
	manifest := packManifest{
		SchemaVersion: PackSchemaVersion,
		Format:        PackFormat,
		Query:         strings.TrimSpace(opts.Query),
		Components:    packComponents(opts),
		FileCount:     result.FileCount,
		SkillCount:    result.SkillCount,
		AgentCount:    result.AgentCount,
		ZKFileCount:   result.ZKFileCount,
		OriginalBytes: result.OriginalBytes,
		PayloadBytes:  payloadBytes,
		Entries:       entries,
		Warnings:      result.Warnings,
	}
	return json.MarshalIndent(manifest, "", "  ")
}

func writePackArchive(outputPath string, manifest []byte, files []packFile, dryRun bool) (int64, error) {
	var (
		destination io.Writer = io.Discard
		closeFile   func() error
		commitFile  func() error
	)

	if !dryRun {
		if strings.TrimSpace(outputPath) == "" {
			return 0, errors.New("output path is required")
		}
		outDir := filepath.Dir(outputPath)
		if err := os.MkdirAll(outDir, 0o755); err != nil {
			return 0, err
		}
		tmp, err := os.CreateTemp(outDir, ".clawd-pack-*.tar.gz")
		if err != nil {
			return 0, err
		}
		tmpPath := tmp.Name()
		destination = tmp
		closeFile = tmp.Close
		commitFile = func() error {
			if err := os.Rename(tmpPath, outputPath); err != nil {
				_ = os.Remove(tmpPath)
				return err
			}
			return nil
		}
		defer func() {
			_ = tmp.Close()
			_ = os.Remove(tmpPath)
		}()
	}

	counter := &countingWriter{writer: destination}
	gz, err := gzip.NewWriterLevel(counter, gzip.BestCompression)
	if err != nil {
		return 0, err
	}
	gz.Header.Name = "clawd-agent-pack.tar"
	gz.Header.ModTime = time.Unix(0, 0)

	tw := tar.NewWriter(gz)
	if err := writeTarFile(tw, "manifest.json", manifest); err != nil {
		return 0, err
	}
	for _, file := range files {
		if err := writeTarFile(tw, file.archivePath, file.payload); err != nil {
			return 0, err
		}
	}
	if err := tw.Close(); err != nil {
		return 0, err
	}
	if err := gz.Close(); err != nil {
		return 0, err
	}
	if closeFile != nil {
		if err := closeFile(); err != nil {
			return 0, err
		}
	}
	if commitFile != nil {
		if err := commitFile(); err != nil {
			return 0, err
		}
	}
	return counter.n, nil
}

func writeTarFile(tw *tar.Writer, name string, data []byte) error {
	header := &tar.Header{
		Name:    name,
		Mode:    0o644,
		Size:    int64(len(data)),
		ModTime: time.Unix(0, 0),
	}
	if err := tw.WriteHeader(header); err != nil {
		return err
	}
	_, err := tw.Write(data)
	return err
}

type countingWriter struct {
	writer io.Writer
	n      int64
}

func (w *countingWriter) Write(data []byte) (int, error) {
	n, err := w.writer.Write(data)
	w.n += int64(n)
	return n, err
}

func shouldSkipPackDir(name string) bool {
	return packExcludedDirs[name]
}

func shouldSkipPackFile(name string) bool {
	if packExcludedFiles[name] {
		return true
	}
	lower := strings.ToLower(name)
	if strings.HasPrefix(lower, ".env") {
		return true
	}
	for _, suffix := range []string{".key", ".pem", ".p8"} {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	return false
}

func cleanArchivePath(value string) (string, bool) {
	value = strings.TrimSpace(filepath.ToSlash(value))
	if value == "" {
		return "", false
	}
	cleaned := path.Clean(value)
	if cleaned == "." || strings.HasPrefix(cleaned, "../") || strings.HasPrefix(cleaned, "/") || cleaned == ".." {
		return "", false
	}
	return cleaned, true
}

func pathSafeName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unnamed"
	}
	value = filepath.Base(value)
	value = strings.ReplaceAll(value, "\\", "-")
	value = strings.ReplaceAll(value, "/", "-")
	return value
}

func packComponents(opts PackOptions) []string {
	components := []string{}
	if opts.IncludeAgents {
		components = append(components, "agents")
	}
	if opts.IncludeSkills {
		components = append(components, "skills")
	}
	if opts.IncludeZK {
		components = append(components, "zk")
	}
	return components
}

func FormatPackSummary(result PackResult) string {
	return fmt.Sprintf(
		"%d files, %s -> %s, saved %s (%.1f%%)",
		result.FileCount,
		FormatBytes(result.OriginalBytes),
		FormatBytes(result.PackedBytes),
		FormatBytes(result.SavedBytes),
		result.SavingsPercent,
	)
}

func FormatBytes(value int64) string {
	sign := ""
	if value < 0 {
		sign = "-"
		value = -value
	}
	units := []string{"B", "KB", "MB", "GB", "TB"}
	size := float64(value)
	unit := units[0]
	for _, candidate := range units[1:] {
		if size < 1024 {
			break
		}
		size /= 1024
		unit = candidate
	}
	if unit == "B" {
		return fmt.Sprintf("%s%d B", sign, value)
	}
	return fmt.Sprintf("%s%.1f %s", sign, size, unit)
}
