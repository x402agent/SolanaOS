package llm

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	mistralAPIBase       = "https://api.mistral.ai/v1"
	mistralTTSModel      = "voxtral-mini-tts-2603"
	mistralSTTModel      = "voxtral-mini-transcribe-2507"
	mistralDefaultVoice  = "98559b22-62b5-4a64-a7cd-fc78ca41faa8" // Paul - Confident
)

// MistralAudioClient handles Mistral TTS and STT.
type MistralAudioClient struct {
	apiKey string
	http   *http.Client
}

// NewMistralAudioClient creates a client from env.
func NewMistralAudioClient() *MistralAudioClient {
	key := strings.TrimSpace(os.Getenv("MISTRAL_API_KEY"))
	if key == "" {
		return nil
	}
	return &MistralAudioClient{
		apiKey: key,
		http:   &http.Client{Timeout: 60 * time.Second},
	}
}

// IsConfigured returns true if the API key is set.
func (c *MistralAudioClient) IsConfigured() bool {
	return c != nil && c.apiKey != ""
}

// ── TTS ─────────────────────────────────────────────────────────

// Speak generates speech from text using Mistral TTS.
// Returns the audio data as bytes (MP3 format).
func (c *MistralAudioClient) Speak(ctx context.Context, text string, voiceID string) ([]byte, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("mistral: MISTRAL_API_KEY not set")
	}
	if voiceID == "" {
		voiceID = mistralDefaultVoice
	}

	payload := map[string]interface{}{
		"input":           text,
		"model":           mistralTTSModel,
		"voice_id":        voiceID,
		"response_format": "mp3",
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", mistralAPIBase+"/audio/speech", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mistral tts: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("mistral tts %d: %s", resp.StatusCode, truncateStr(string(respBody), 200))
	}

	var result struct {
		AudioData string `json:"audio_data"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("mistral tts decode: %w", err)
	}
	if result.AudioData == "" {
		return nil, fmt.Errorf("mistral tts: empty audio_data")
	}

	return base64.StdEncoding.DecodeString(result.AudioData)
}

// ── STT ─────────────────────────────────────────────────────────

// TranscriptionResult holds the output from STT.
type TranscriptionResult struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

// Transcribe converts audio to text using Mistral STT.
// audioData is the raw audio bytes, filename is the original filename (for format detection).
func (c *MistralAudioClient) Transcribe(ctx context.Context, audioData []byte, filename string) (*TranscriptionResult, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("mistral: MISTRAL_API_KEY not set")
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	// model field
	if err := w.WriteField("model", mistralSTTModel); err != nil {
		return nil, err
	}

	// file field
	if filename == "" {
		filename = "audio.ogg"
	}
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(audioData); err != nil {
		return nil, err
	}
	w.Close()

	req, err := http.NewRequestWithContext(ctx, "POST", mistralAPIBase+"/audio/transcriptions", &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mistral stt: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("mistral stt %d: %s", resp.StatusCode, truncateStr(string(respBody), 200))
	}

	var result TranscriptionResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("mistral stt decode: %w", err)
	}
	return &result, nil
}

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
