package media

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ── PDF to Markdown Converter ───────────────────────────────────────
// Converts PDF files to clean Markdown for LLM context.
// Two modes: fast (PyMuPDF) and accurate (IBM Docling).
// Integrates with Telegram for upload → convert → respond flow.

// PDFConvertOpts controls PDF conversion behavior.
type PDFConvertOpts struct {
	Docling     bool    // Use accurate Docling mode (slower)
	ImagesScale float64 // Image resolution multiplier (default: 4.0)
	ClearCache  bool    // Clear cache before converting
	NoProgress  bool    // Suppress progress output
}

// PDFConvertResult holds the conversion output.
type PDFConvertResult struct {
	Markdown   string `json:"markdown"`
	OutputPath string `json:"output_path"`
	TotalPages int    `json:"total_pages"`
	FromCache  bool   `json:"from_cache"`
	ImageCount int    `json:"image_count"`
}

// ConvertPDF converts a PDF file to Markdown using the Python converter.
func ConvertPDF(ctx context.Context, pdfPath string, opts PDFConvertOpts) (*PDFConvertResult, error) {
	if _, err := os.Stat(pdfPath); err != nil {
		return nil, fmt.Errorf("pdf: file not found: %s", pdfPath)
	}

	// Determine output path
	ext := filepath.Ext(pdfPath)
	outputPath := strings.TrimSuffix(pdfPath, ext) + ".md"

	// Build command args
	args := []string{findConverterScript(), pdfPath, outputPath}
	if opts.Docling {
		args = append(args, "--docling")
	}
	if opts.ClearCache {
		args = append(args, "--clear-cache")
	}
	if opts.NoProgress {
		args = append(args, "--no-progress")
	}

	cmd := exec.CommandContext(ctx, "python3", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("pdf: conversion failed: %s\n%s", err, stderr.String())
	}

	// Read output
	content, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, fmt.Errorf("pdf: read output: %w", err)
	}

	// Count pages from metadata header
	totalPages := 0
	fromCache := false
	if idx := strings.Index(string(content), "total_pages:"); idx >= 0 {
		fmt.Sscanf(string(content[idx:]), "total_pages: %d", &totalPages)
	}
	if strings.Contains(string(content[:min(500, len(content))]), "from_cache: true") {
		fromCache = true
	}

	// Count images
	imageCount := strings.Count(string(content), "![")

	return &PDFConvertResult{
		Markdown:   string(content),
		OutputPath: outputPath,
		TotalPages: totalPages,
		FromCache:  fromCache,
		ImageCount: imageCount,
	}, nil
}

// ConvertPDFFromURL downloads a PDF from a URL and converts it.
func ConvertPDFFromURL(ctx context.Context, url, destDir string, opts PDFConvertOpts) (*PDFConvertResult, error) {
	// Download PDF
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("pdf: create request: %w", err)
	}

	resp, err := (&http.Client{Timeout: 120 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("pdf: download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pdf: download failed (%d)", resp.StatusCode)
	}

	// Write to temp file
	if destDir == "" {
		destDir = os.TempDir()
	}
	filename := "downloaded.pdf"
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		if idx := strings.Index(cd, "filename="); idx >= 0 {
			filename = strings.Trim(cd[idx+9:], `"' `)
		}
	}

	pdfPath := filepath.Join(destDir, filename)
	f, err := os.Create(pdfPath)
	if err != nil {
		return nil, fmt.Errorf("pdf: create temp file: %w", err)
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return nil, fmt.Errorf("pdf: write temp file: %w", err)
	}
	f.Close()

	return ConvertPDF(ctx, pdfPath, opts)
}

// ConvertPDFFromTelegram handles a PDF file sent via Telegram.
// Downloads the file using the Telegram Bot API, converts, and returns markdown.
func ConvertPDFFromTelegram(ctx context.Context, botToken, fileID, destDir string, opts PDFConvertOpts) (*PDFConvertResult, error) {
	// Get file path from Telegram
	fileURL := fmt.Sprintf("https://api.telegram.org/bot%s/getFile?file_id=%s", botToken, fileID)
	resp, err := http.Get(fileURL)
	if err != nil {
		return nil, fmt.Errorf("pdf: telegram getFile: %w", err)
	}
	defer resp.Body.Close()

	var fileResp struct {
		OK     bool `json:"ok"`
		Result struct {
			FilePath string `json:"file_path"`
			FileSize int    `json:"file_size"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&fileResp); err != nil {
		return nil, fmt.Errorf("pdf: decode telegram response: %w", err)
	}
	if !fileResp.OK || fileResp.Result.FilePath == "" {
		return nil, fmt.Errorf("pdf: telegram file not found")
	}

	// Download the actual file
	downloadURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", botToken, fileResp.Result.FilePath)
	return ConvertPDFFromURL(ctx, downloadURL, destDir, opts)
}

// CacheStats returns PDF cache statistics.
func CacheStats(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "python3", findConverterScript(), "--cache-stats")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("pdf: cache stats: %s", stderr.String())
	}
	return stderr.String(), nil
}

// ClearAllCache clears the entire PDF conversion cache.
func ClearAllCache(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, "python3", findConverterScript(), "--clear-all-cache")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pdf: clear cache: %s", stderr.String())
	}
	return nil
}

// findConverterScript locates the pdf_to_md.py script.
func findConverterScript() string {
	// Check common locations
	candidates := []string{
		"pdf_to_md.py",
		filepath.Join("scripts", "pdf_to_md.py"),
		filepath.Join(os.Getenv("SOLANAOS_HOME"), "scripts", "pdf_to_md.py"),
		filepath.Join(os.Getenv("HOME"), ".nanosolana", "scripts", "pdf_to_md.py"),
	}

	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}

	// Fallback: assume it's on PATH or in cwd
	return "pdf_to_md.py"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// TruncateForTelegram trims markdown to fit within Telegram's 4096 char message limit.
func TruncateForTelegram(markdown string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = 4000
	}
	if len(markdown) <= maxLen {
		return markdown
	}
	truncated := markdown[:maxLen]
	// Try to break at a paragraph boundary
	if idx := strings.LastIndex(truncated, "\n\n"); idx > maxLen/2 {
		truncated = truncated[:idx]
	}
	return truncated + "\n\n... (truncated, full output saved to file)"
}

// FormatTelegramSummary creates a concise summary for Telegram.
func FormatTelegramSummary(result *PDFConvertResult) string {
	var b strings.Builder
	b.WriteString("📄 *PDF Converted*\n\n")
	fmt.Fprintf(&b, "Pages: %d\n", result.TotalPages)
	if result.ImageCount > 0 {
		fmt.Fprintf(&b, "Images: %d\n", result.ImageCount)
	}
	if result.FromCache {
		b.WriteString("Source: cache\n")
	}
	fmt.Fprintf(&b, "Output: `%s`\n", filepath.Base(result.OutputPath))
	b.WriteString("\nMarkdown preview:\n\n")

	// Extract first meaningful content (skip YAML header)
	content := result.Markdown
	if idx := strings.Index(content, "---\n\n"); idx > 0 {
		content = content[idx+5:]
	}
	preview := TruncateForTelegram(content, 3000)
	b.WriteString(preview)

	return b.String()
}

func init() {
	// Log availability on import
	if _, err := exec.LookPath("python3"); err != nil {
		log.Printf("[media/pdf] python3 not found — PDF conversion unavailable")
	}
}
