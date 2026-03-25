// Package voice provides audio transcription for MawdBot.
// Adapted from PicoClaw — supports Whisper API for voice input.
package voice

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type TranscribeResult struct {
	Text     string  `json:"text"`
	Language string  `json:"language"`
	Duration float64 `json:"duration"`
}

type Transcriber interface {
	Transcribe(ctx context.Context, audioPath string) (*TranscribeResult, error)
}

// WhisperTranscriber uses OpenAI Whisper API.
type WhisperTranscriber struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewWhisperTranscriber(apiKey string) *WhisperTranscriber {
	return &WhisperTranscriber{
		apiKey:  apiKey,
		baseURL: "https://api.openai.com/v1/audio/transcriptions",
		client:  &http.Client{Timeout: 60 * time.Second},
	}
}

func (w *WhisperTranscriber) Transcribe(ctx context.Context, audioPath string) (*TranscribeResult, error) {
	f, err := os.Open(audioPath)
	if err != nil {
		return nil, fmt.Errorf("open audio: %w", err)
	}
	defer f.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filepath.Base(audioPath))
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, f); err != nil {
		return nil, err
	}
	writer.WriteField("model", "whisper-1")
	writer.Close()

	req, err := http.NewRequestWithContext(ctx, "POST", w.baseURL, &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+w.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("whisper request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("whisper HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result TranscribeResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// NoopTranscriber returns empty results (for when voice is disabled).
type NoopTranscriber struct{}

func (n *NoopTranscriber) Transcribe(ctx context.Context, audioPath string) (*TranscribeResult, error) {
	return &TranscribeResult{Text: "[voice transcription disabled]"}, nil
}
