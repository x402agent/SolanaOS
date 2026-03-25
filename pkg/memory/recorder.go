package memory

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const defaultConvexMemoryRoute = "/nanosolana/memory/append"

type RecursiveRecorder struct {
	vault        *ClawVault
	convexURL    string
	authToken    string
	httpClient   *http.Client
	sessionHeads map[string]string
	headsPath    string
	mu           sync.Mutex
}

type CaptureTurnInput struct {
	SessionID string
	Role      string
	Channel   string
	ChatID    string
	Content   string
	Provider  string
	Model     string
	Metadata  map[string]any
	CreatedAt time.Time
}

func NewRecursiveRecorder(vaultPath, convexURL, authToken string) *RecursiveRecorder {
	abs, _ := filepath.Abs(vaultPath)
	if abs == "" {
		abs = vaultPath
	}
	vault := NewClawVault(vaultPath)
	return &RecursiveRecorder{
		vault:        vault,
		convexURL:    strings.TrimRight(strings.TrimSpace(convexURL), "/"),
		authToken:    strings.TrimSpace(authToken),
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		sessionHeads: make(map[string]string),
		headsPath:    filepath.Join(filepath.Dir(abs), ".clawvault", "session-heads.json"),
	}
}

func (r *RecursiveRecorder) Init() error {
	if r == nil {
		return nil
	}
	if err := r.vault.Init(); err != nil {
		return err
	}
	return r.loadHeads()
}

func (r *RecursiveRecorder) CaptureTurn(input CaptureTurnInput) (string, error) {
	if r == nil {
		return "", nil
	}
	content := strings.TrimSpace(input.Content)
	if content == "" {
		return "", nil
	}
	sessionID := strings.TrimSpace(input.SessionID)
	if sessionID == "" {
		sessionID = "default"
	}
	role := strings.ToLower(strings.TrimSpace(input.Role))
	if role == "" {
		role = "assistant"
	}
	now := input.CreatedAt
	if now.IsZero() {
		now = time.Now().UTC()
	}

	r.mu.Lock()
	parentID := r.sessionHeads[sessionID]
	r.mu.Unlock()

	metadata := cloneMap(input.Metadata)
	metadata["session_id"] = sessionID
	metadata["parent_id"] = parentID
	metadata["role"] = role
	metadata["channel"] = strings.TrimSpace(input.Channel)
	metadata["chat_id"] = strings.TrimSpace(input.ChatID)
	metadata["provider"] = strings.TrimSpace(input.Provider)
	metadata["model"] = strings.TrimSpace(input.Model)
	metadata["captured_at"] = now.Format(time.RFC3339)

	tags := []string{"chat", role}
	if input.Channel != "" {
		tags = append(tags, sanitizeTag(input.Channel))
	}
	if input.Provider != "" {
		tags = append(tags, sanitizeTag(input.Provider))
	}

	entry, err := r.vault.Remember(content, RememberOpts{
		Category: CatInbox,
		Title:    fmt.Sprintf("%s turn %s", displayRole(role), sessionID),
		Tags:     tags,
		Metadata: metadata,
		Score:    0.75,
	})
	if err != nil {
		return "", err
	}

	r.mu.Lock()
	r.sessionHeads[sessionID] = entry.ID
	saveErr := r.saveHeadsLocked()
	r.mu.Unlock()
	if saveErr != nil {
		return entry.ID, saveErr
	}

	if err := r.appendConvex(convexTurnPayload{
		EntryID:   entry.ID,
		SessionID: sessionID,
		ParentID:  parentID,
		Role:      role,
		Channel:   strings.TrimSpace(input.Channel),
		ChatID:    strings.TrimSpace(input.ChatID),
		Provider:  strings.TrimSpace(input.Provider),
		Model:     strings.TrimSpace(input.Model),
		Content:   content,
		Metadata:  metadata,
		CreatedAt: now.UnixMilli(),
	}); err != nil {
		return entry.ID, nil
	}

	return entry.ID, nil
}

type convexTurnPayload struct {
	EntryID   string         `json:"entryId"`
	SessionID string         `json:"sessionId"`
	ParentID  string         `json:"parentId,omitempty"`
	Role      string         `json:"role"`
	Channel   string         `json:"channel,omitempty"`
	ChatID    string         `json:"chatId,omitempty"`
	Provider  string         `json:"provider,omitempty"`
	Model     string         `json:"model,omitempty"`
	Content   string         `json:"content"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	CreatedAt int64          `json:"createdAt"`
}

func (r *RecursiveRecorder) appendConvex(payload convexTurnPayload) error {
	if r == nil || r.convexURL == "" || r.authToken == "" {
		return nil
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, r.convexURL+defaultConvexMemoryRoute, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.authToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("convex %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}

func (r *RecursiveRecorder) loadHeads() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(r.headsPath), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(r.headsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var heads map[string]string
	if err := json.Unmarshal(data, &heads); err != nil {
		return err
	}
	if heads != nil {
		r.sessionHeads = heads
	}
	return nil
}

func (r *RecursiveRecorder) saveHeadsLocked() error {
	data, err := json.MarshalIndent(r.sessionHeads, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.headsPath, data, 0o644)
}

func sanitizeTag(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	raw = strings.ReplaceAll(raw, " ", "_")
	raw = strings.ReplaceAll(raw, ":", "_")
	return raw
}

func displayRole(role string) string {
	if role == "" {
		return "Assistant"
	}
	return strings.ToUpper(role[:1]) + role[1:]
}

func cloneMap(src map[string]any) map[string]any {
	if len(src) == 0 {
		return map[string]any{}
	}
	dst := make(map[string]any, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
