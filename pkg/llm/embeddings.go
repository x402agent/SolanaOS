// Package llm :: embeddings.go
// OpenRouter Embeddings API client.
// Endpoint: POST https://openrouter.ai/api/v1/embeddings
// Falls back to pure keyword scoring when no API key is configured.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	DefaultEmbeddingEndpoint = "https://openrouter.ai/api/v1/embeddings"
	DefaultEmbeddingModel    = "openai/text-embedding-3-small"
	DefaultEmbeddingDims     = 1536
)

// EmbeddingClient handles embedding requests via OpenRouter.
// It caches vectors in-memory to avoid re-embedding identical strings.
type EmbeddingClient struct {
	apiKey   string
	model    string
	endpoint string
	dims     int
	http     *http.Client
	mu       sync.Mutex
	cache    map[string][]float64
}

// NewEmbeddingClient creates a client from env vars.
// Uses OPENROUTER_API_KEY automatically.
func NewEmbeddingClient() *EmbeddingClient {
	model := strings.TrimSpace(os.Getenv("OPENROUTER_EMBEDDING_MODEL"))
	if model == "" {
		model = DefaultEmbeddingModel
	}
	return &EmbeddingClient{
		apiKey:   strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY")),
		model:    model,
		endpoint: DefaultEmbeddingEndpoint,
		dims:     DefaultEmbeddingDims,
		http:     &http.Client{Timeout: 30 * time.Second},
		cache:    make(map[string][]float64),
	}
}

// IsConfigured returns true if an API key is present.
func (e *EmbeddingClient) IsConfigured() bool {
	return e.apiKey != ""
}

// Model returns the active embedding model slug.
func (e *EmbeddingClient) Model() string {
	return e.model
}

// Embed returns the embedding vector for a single string.
// Results are cached by content string.
func (e *EmbeddingClient) Embed(ctx context.Context, text string) ([]float64, error) {
	if text == "" {
		return nil, fmt.Errorf("embeddings: empty input")
	}
	if !e.IsConfigured() {
		return nil, fmt.Errorf("embeddings: OPENROUTER_API_KEY not set")
	}

	// Cache check
	e.mu.Lock()
	if v, ok := e.cache[text]; ok {
		e.mu.Unlock()
		return v, nil
	}
	e.mu.Unlock()

	vec, err := e.fetchOne(ctx, text)
	if err != nil {
		return nil, err
	}

	e.mu.Lock()
	e.cache[text] = vec
	e.mu.Unlock()
	return vec, nil
}

// EmbedBatch returns embedding vectors for multiple strings in a single request.
func (e *EmbeddingClient) EmbedBatch(ctx context.Context, texts []string) ([][]float64, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	if !e.IsConfigured() {
		return nil, fmt.Errorf("embeddings: OPENROUTER_API_KEY not set")
	}

	// Resolve cache hits; collect misses
	results := make([][]float64, len(texts))
	var missIndices []int
	var missTexts []string

	e.mu.Lock()
	for i, t := range texts {
		if v, ok := e.cache[t]; ok {
			results[i] = v
		} else {
			missIndices = append(missIndices, i)
			missTexts = append(missTexts, t)
		}
	}
	e.mu.Unlock()

	if len(missTexts) == 0 {
		return results, nil
	}

	vecs, err := e.fetchBatch(ctx, missTexts)
	if err != nil {
		return nil, err
	}

	e.mu.Lock()
	for j, idx := range missIndices {
		results[idx] = vecs[j]
		e.cache[texts[idx]] = vecs[j]
	}
	e.mu.Unlock()

	return results, nil
}

// CosineSimilarity computes cosine similarity between two vectors.
// Returns a value in [-1, 1]; higher = more similar.
func CosineSimilarity(a, b []float64) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// SemanticSearch ranks candidates by cosine similarity to the query.
// Returns indices sorted highest → lowest similarity (above threshold).
func (e *EmbeddingClient) SemanticSearch(ctx context.Context, query string, candidates []string, threshold float64) ([]SemanticResult, error) {
	if len(candidates) == 0 {
		return nil, nil
	}

	// Embed query + all candidates in one shot
	all := append([]string{query}, candidates...)
	vecs, err := e.EmbedBatch(ctx, all)
	if err != nil {
		return nil, err
	}

	queryVec := vecs[0]
	var results []SemanticResult
	for i, vec := range vecs[1:] {
		sim := CosineSimilarity(queryVec, vec)
		if sim >= threshold {
			results = append(results, SemanticResult{Index: i, Score: sim, Text: candidates[i]})
		}
	}

	// Sort descending by score
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
	return results, nil
}

// SemanticResult holds the ranked output of SemanticSearch.
type SemanticResult struct {
	Index int
	Score float64
	Text  string
}

// ClearCache drops all cached embeddings.
func (e *EmbeddingClient) ClearCache() {
	e.mu.Lock()
	e.cache = make(map[string][]float64)
	e.mu.Unlock()
}

// ── internal HTTP helpers ─────────────────────────────────────────────

type embeddingRequest struct {
	Input          interface{} `json:"input"`
	Model          string      `json:"model"`
	Dimensions     int         `json:"dimensions,omitempty"`
	EncodingFormat string      `json:"encoding_format,omitempty"`
}

type embeddingResponse struct {
	Object string `json:"object"`
	Data   []struct {
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Model string `json:"model"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error"`
}

func (e *EmbeddingClient) fetchOne(ctx context.Context, text string) ([]float64, error) {
	vecs, err := e.fetchBatch(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(vecs) == 0 {
		return nil, fmt.Errorf("embeddings: no vector returned")
	}
	return vecs[0], nil
}

func (e *EmbeddingClient) fetchBatch(ctx context.Context, texts []string) ([][]float64, error) {
	payload := embeddingRequest{
		Input:      texts,
		Model:      e.model,
		Dimensions: e.dims,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("embeddings: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("embeddings: request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+e.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://solanaos.net")
	req.Header.Set("X-Title", "SolanaOS")

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embeddings: http: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("embeddings: %d: %s", resp.StatusCode, truncate(string(respBody), 200))
	}

	var result embeddingResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("embeddings: decode: %w", err)
	}
	if result.Error != nil && result.Error.Message != "" {
		return nil, fmt.Errorf("embeddings: api error: %s", result.Error.Message)
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("embeddings: empty response")
	}

	// Re-order by .Index (OpenRouter preserves order but let's be safe)
	vecs := make([][]float64, len(texts))
	for _, d := range result.Data {
		if d.Index < len(vecs) {
			vecs[d.Index] = d.Embedding
		}
	}
	return vecs, nil
}
