package honcho

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

const (
	apiVersion           = "v3"
	defaultHonchoBaseURL = "https://api.honcho.dev"
)

type Client struct {
	baseURL    string
	apiKey     string
	workspace  string
	agentPeer  string
	reasoning  string
	tokens     int
	useSummary bool
	sync       bool
	http       *http.Client

	ensureMu           sync.Mutex
	workspaceEnsured   bool
	ensuredPeers       map[string]bool
	ensuredSessions    map[string]bool
	ensuredSessionSets map[string]bool

	rateMu   sync.Mutex
	lastCall time.Time
}

type ReasoningConfig struct {
	Enabled            bool   `json:"enabled"`
	CustomInstructions string `json:"custom_instructions,omitempty"`
}

type PeerCardConfig struct {
	Use    bool `json:"use"`
	Create bool `json:"create"`
}

type SummaryConfig struct {
	Enabled                 bool `json:"enabled"`
	MessagesPerShortSummary int  `json:"messages_per_short_summary,omitempty"`
	MessagesPerLongSummary  int  `json:"messages_per_long_summary,omitempty"`
}

type DreamConfig struct {
	Enabled bool `json:"enabled"`
}

type SessionConfiguration struct {
	Reasoning *ReasoningConfig `json:"reasoning,omitempty"`
	PeerCard  *PeerCardConfig  `json:"peer_card,omitempty"`
	Summary   *SummaryConfig   `json:"summary,omitempty"`
	Dream     *DreamConfig     `json:"dream,omitempty"`
}

type MessageConfiguration struct {
	Reasoning *ReasoningConfig `json:"reasoning,omitempty"`
}

type SessionPeerConfig struct {
	ObserveMe     *bool `json:"observe_me,omitempty"`
	ObserveOthers *bool `json:"observe_others,omitempty"`
}

type Session struct {
	ID            string         `json:"id"`
	IsActive      bool           `json:"is_active"`
	WorkspaceID   string         `json:"workspace_id"`
	CreatedAt     string         `json:"created_at"`
	Metadata      map[string]any `json:"metadata"`
	Configuration map[string]any `json:"configuration"`
}

type Peer struct {
	ID            string         `json:"id"`
	WorkspaceID   string         `json:"workspace_id"`
	CreatedAt     string         `json:"created_at"`
	Metadata      map[string]any `json:"metadata"`
	Configuration map[string]any `json:"configuration"`
}

type SummaryResponse struct {
	Content     string `json:"content"`
	MessageID   string `json:"message_id"`
	SummaryType string `json:"summary_type"`
	CreatedAt   string `json:"created_at"`
	TokenCount  int    `json:"token_count"`
}

type Message struct {
	ID          string         `json:"id"`
	Content     string         `json:"content"`
	PeerID      string         `json:"peer_id"`
	SessionID   string         `json:"session_id"`
	CreatedAt   string         `json:"created_at"`
	WorkspaceID string         `json:"workspace_id"`
	TokenCount  int            `json:"token_count"`
	Metadata    map[string]any `json:"metadata"`
}

type MessageCreate struct {
	PeerID        string                `json:"peer_id"`
	Content       string                `json:"content"`
	Metadata      map[string]any        `json:"metadata,omitempty"`
	Configuration *MessageConfiguration `json:"configuration,omitempty"`
	CreatedAt     string                `json:"created_at,omitempty"`
}

type Conclusion struct {
	ID         string `json:"id"`
	Content    string `json:"content"`
	ObserverID string `json:"observer_id"`
	ObservedID string `json:"observed_id"`
	CreatedAt  string `json:"created_at"`
	SessionID  string `json:"session_id,omitempty"`
}

type ConclusionCreate struct {
	Content    string `json:"content"`
	ObserverID string `json:"observer_id"`
	ObservedID string `json:"observed_id"`
	SessionID  string `json:"session_id,omitempty"`
}

type SessionsPage struct {
	Items []Session `json:"items"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Size  int       `json:"size"`
	Pages int       `json:"pages"`
}

type PeersPage struct {
	Items []Peer `json:"items"`
	Total int    `json:"total"`
	Page  int    `json:"page"`
	Size  int    `json:"size"`
	Pages int    `json:"pages"`
}

type MessagesPage struct {
	Items []Message `json:"items"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Size  int       `json:"size"`
	Pages int       `json:"pages"`
}

type ConclusionsPage struct {
	Items []Conclusion `json:"items"`
	Total int          `json:"total"`
	Page  int          `json:"page"`
	Size  int          `json:"size"`
	Pages int          `json:"pages"`
}

type SessionSummaries struct {
	ID           string           `json:"id"`
	ShortSummary *SummaryResponse `json:"short_summary"`
	LongSummary  *SummaryResponse `json:"long_summary"`
}

type SessionContext struct {
	ID                 string           `json:"id"`
	Messages           []Message        `json:"messages"`
	Summary            *SummaryResponse `json:"summary"`
	PeerRepresentation string           `json:"peer_representation"`
	PeerCard           []string         `json:"peer_card"`
}

type PeerContext struct {
	PeerID         string   `json:"peer_id"`
	TargetID       string   `json:"target_id"`
	Representation string   `json:"representation"`
	PeerCard       []string `json:"peer_card"`
}

type ChatResponse struct {
	Content string `json:"content"`
}

func NewClient(cfg config.HonchoConfig) *Client {
	baseURL := strings.TrimSpace(cfg.BaseURL)
	if baseURL == "" {
		baseURL = defaultHonchoBaseURL
	}
	workspace := strings.TrimSpace(cfg.WorkspaceID)
	if workspace == "" {
		workspace = "solanaos"
	}
	agentPeer := strings.TrimSpace(cfg.AgentPeerID)
	if agentPeer == "" {
		agentPeer = "solanaos-agent"
	}
	reasoning := strings.TrimSpace(cfg.ReasoningLevel)
	if reasoning == "" {
		reasoning = "low"
	}
	tokens := cfg.ContextTokens
	if tokens <= 0 {
		tokens = 4000
	}
	return &Client{
		baseURL:            strings.TrimRight(baseURL, "/"),
		apiKey:             strings.TrimSpace(cfg.APIKey),
		workspace:          workspace,
		agentPeer:          agentPeer,
		reasoning:          reasoning,
		tokens:             tokens,
		useSummary:         cfg.UseSummary,
		sync:               cfg.SyncMessages,
		http:               &http.Client{Timeout: 15 * time.Second},
		ensuredPeers:       make(map[string]bool),
		ensuredSessions:    make(map[string]bool),
		ensuredSessionSets: make(map[string]bool),
	}
}

func (c *Client) Enabled() bool {
	return c != nil && strings.TrimSpace(c.baseURL) != "" && strings.TrimSpace(c.workspace) != ""
}

func (c *Client) AgentPeerID() string {
	if c == nil {
		return ""
	}
	return c.agentPeer
}

func (c *Client) WorkspaceID() string {
	if c == nil {
		return ""
	}
	return c.workspace
}

func (c *Client) SyncEnabled() bool {
	return c != nil && c.sync
}

func (c *Client) EnsureWorkspace(ctx context.Context) error {
	if c == nil {
		return nil
	}
	c.ensureMu.Lock()
	if c.workspaceEnsured {
		c.ensureMu.Unlock()
		return nil
	}
	c.ensureMu.Unlock()
	_, err := c.post(ctx, c.endpoint("workspaces"), map[string]any{"id": c.workspace}, nil)
	if err == nil {
		c.ensureMu.Lock()
		c.workspaceEnsured = true
		c.ensureMu.Unlock()
	}
	return err
}

func (c *Client) EnsurePeer(ctx context.Context, peerID string, metadata map[string]any) error {
	return c.EnsurePeerWithConfig(ctx, peerID, metadata, nil)
}

func (c *Client) EnsurePeerWithConfig(ctx context.Context, peerID string, metadata map[string]any, configuration map[string]any) error {
	peerID = strings.TrimSpace(peerID)
	if peerID == "" {
		return nil
	}
	c.ensureMu.Lock()
	if c.ensuredPeers[peerID] {
		c.ensureMu.Unlock()
		return nil
	}
	c.ensureMu.Unlock()
	body := map[string]any{"id": peerID}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	if len(configuration) > 0 {
		body["configuration"] = configuration
	}
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "peers"), body, nil)
	if err == nil {
		c.ensureMu.Lock()
		c.ensuredPeers[peerID] = true
		c.ensureMu.Unlock()
	}
	return err
}

func (c *Client) EnsureSession(ctx context.Context, sessionID string, metadata map[string]any) error {
	return c.EnsureSessionWithConfig(ctx, sessionID, metadata, nil, nil)
}

func (c *Client) EnsureSessionWithConfig(ctx context.Context, sessionID string, metadata map[string]any, peers map[string]SessionPeerConfig, cfg *SessionConfiguration) error {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	c.ensureMu.Lock()
	if c.ensuredSessions[sessionID] {
		c.ensureMu.Unlock()
		return nil
	}
	c.ensureMu.Unlock()
	body := map[string]any{"id": sessionID}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	if len(peers) > 0 {
		body["peers"] = peers
	}
	if cfg != nil {
		body["configuration"] = cfg
	}
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions"), body, nil)
	if err == nil {
		c.ensureMu.Lock()
		c.ensuredSessions[sessionID] = true
		c.ensureMu.Unlock()
	}
	return err
}

func (c *Client) ListSessions(ctx context.Context, page, size int, filters map[string]any) (*SessionsPage, error) {
	query := map[string]string{
		"page": fmt.Sprintf("%d", maxInt(page, 1)),
		"size": fmt.Sprintf("%d", boundedInt(size, 1, 100, 50)),
	}
	var out SessionsPage
	if _, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions", "list"), map[string]any{
		"filters": nilOrMap(filters),
	}, &out, query); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UpdateSession(ctx context.Context, sessionID string, metadata map[string]any, cfg *SessionConfiguration) (*Session, error) {
	body := map[string]any{}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	if cfg != nil {
		body["configuration"] = cfg
	}
	var out Session
	if err := c.put(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID), body, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) DeleteSession(ctx context.Context, sessionID string) error {
	return c.delete(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID), nil, nil)
}

func (c *Client) CloneSession(ctx context.Context, sessionID, messageID string) (*Session, error) {
	query := map[string]string{}
	if strings.TrimSpace(messageID) != "" {
		query["message_id"] = messageID
	}
	var out Session
	if _, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "clone"), nil, &out, query); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SessionPeers(ctx context.Context, sessionID string, page, size int) (*PeersPage, error) {
	query := map[string]string{
		"page": fmt.Sprintf("%d", maxInt(page, 1)),
		"size": fmt.Sprintf("%d", boundedInt(size, 1, 100, 50)),
	}
	var out PeersPage
	if err := c.get(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "peers"), query, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SetSessionPeers(ctx context.Context, sessionID string, peers map[string]SessionPeerConfig) (*Session, error) {
	var out Session
	if err := c.put(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "peers"), peers, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) AddPeersToSession(ctx context.Context, sessionID string, peerIDs []string) error {
	if len(peerIDs) == 0 {
		return nil
	}
	peers := make(map[string]SessionPeerConfig, len(peerIDs))
	for _, peerID := range peerIDs {
		peerID = strings.TrimSpace(peerID)
		if peerID == "" {
			continue
		}
		observeMe := true
		observeOthers := true
		peers[peerID] = SessionPeerConfig{
			ObserveMe:     &observeMe,
			ObserveOthers: &observeOthers,
		}
	}
	return c.AddPeersToSessionWithConfig(ctx, sessionID, peers)
}

func (c *Client) AddPeersToSessionWithConfig(ctx context.Context, sessionID string, peers map[string]SessionPeerConfig) error {
	if len(peers) == 0 {
		return nil
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	c.ensureMu.Lock()
	if c.ensuredSessionSets[sessionID] {
		c.ensureMu.Unlock()
		return nil
	}
	c.ensureMu.Unlock()
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "peers"), peers, nil)
	if err == nil {
		c.ensureMu.Lock()
		c.ensuredSessionSets[sessionID] = true
		c.ensureMu.Unlock()
	}
	return err
}

func (c *Client) RemovePeersFromSession(ctx context.Context, sessionID string, peerIDs []string) (*Session, error) {
	var out Session
	if err := c.delete(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "peers"), peerIDs, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) GetSessionPeerConfig(ctx context.Context, sessionID, peerID string) (*SessionPeerConfig, error) {
	var out SessionPeerConfig
	if err := c.get(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "peers", peerID, "config"), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SetSessionPeerConfig(ctx context.Context, sessionID, peerID string, cfg SessionPeerConfig) error {
	return c.put(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "peers", peerID, "config"), cfg, nil, nil)
}

func (c *Client) SessionContext(ctx context.Context, sessionID, peerPerspective, peerTarget, searchQuery string) (*SessionContext, error) {
	query := map[string]string{}
	if c.tokens > 0 {
		query["tokens"] = fmt.Sprintf("%d", c.tokens)
	}
	query["summary"] = fmt.Sprintf("%t", c.useSummary)
	if strings.TrimSpace(peerPerspective) != "" {
		query["peer_perspective"] = peerPerspective
	}
	if strings.TrimSpace(peerTarget) != "" {
		query["peer_target"] = peerTarget
	}
	if strings.TrimSpace(searchQuery) != "" {
		query["search_query"] = searchQuery
	}
	var out SessionContext
	if err := c.get(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "context"), query, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SessionSummaries(ctx context.Context, sessionID string) (*SessionSummaries, error) {
	var out SessionSummaries
	if err := c.get(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "summaries"), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SearchSession(ctx context.Context, sessionID, query string, filters map[string]any, limit int) ([]Message, error) {
	var out []Message
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "search"), map[string]any{
		"query":   query,
		"filters": nilOrMap(filters),
		"limit":   boundedInt(limit, 1, 100, 10),
	}, &out)
	return out, err
}

func (c *Client) AddMessages(ctx context.Context, sessionID string, messages []MessageCreate) error {
	if len(messages) == 0 {
		return nil
	}
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "messages"), map[string]any{
		"messages": messages,
	}, nil)
	return err
}

func (c *Client) ListMessages(ctx context.Context, sessionID string, page, size int, reverse bool, filters map[string]any) (*MessagesPage, error) {
	query := map[string]string{
		"page":    fmt.Sprintf("%d", maxInt(page, 1)),
		"size":    fmt.Sprintf("%d", boundedInt(size, 1, 100, 50)),
		"reverse": fmt.Sprintf("%t", reverse),
	}
	var out MessagesPage
	if _, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "messages", "list"), map[string]any{
		"filters": nilOrMap(filters),
	}, &out, query); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) GetMessage(ctx context.Context, sessionID, messageID string) (*Message, error) {
	var out Message
	if err := c.get(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "messages", messageID), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UpdateMessageMetadata(ctx context.Context, sessionID, messageID string, metadata map[string]any) (*Message, error) {
	var out Message
	if err := c.put(ctx, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "messages", messageID), map[string]any{
		"metadata": nilOrMap(metadata),
	}, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UploadMessagesFile(ctx context.Context, sessionID, peerID, fileName string, fileContent []byte, metadata map[string]any, cfg *MessageConfiguration, createdAt string) ([]Message, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fileWriter, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return nil, err
	}
	if _, err := fileWriter.Write(fileContent); err != nil {
		return nil, err
	}
	if err := writer.WriteField("peer_id", peerID); err != nil {
		return nil, err
	}
	if len(metadata) > 0 {
		raw, err := json.Marshal(metadata)
		if err != nil {
			return nil, err
		}
		if err := writer.WriteField("metadata", string(raw)); err != nil {
			return nil, err
		}
	}
	if cfg != nil {
		raw, err := json.Marshal(cfg)
		if err != nil {
			return nil, err
		}
		if err := writer.WriteField("configuration", string(raw)); err != nil {
			return nil, err
		}
	}
	if strings.TrimSpace(createdAt) != "" {
		if err := writer.WriteField("created_at", createdAt); err != nil {
			return nil, err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint("workspaces", c.workspace, "sessions", sessionID, "messages", "upload"), &body)
	if err != nil {
		return nil, err
	}
	c.applyHeaders(req)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	var out []Message
	if err := c.do(req, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) PeerContext(ctx context.Context, peerID, target, searchQuery string) (*PeerContext, error) {
	query := map[string]string{}
	if strings.TrimSpace(target) != "" {
		query["target"] = target
	}
	if strings.TrimSpace(searchQuery) != "" {
		query["search_query"] = searchQuery
	}
	var out PeerContext
	if err := c.get(ctx, c.endpoint("workspaces", c.workspace, "peers", peerID, "context"), query, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) PeerChat(ctx context.Context, peerID, query, target, sessionID string) (string, error) {
	body := map[string]any{
		"query":           query,
		"reasoning_level": c.reasoning,
	}
	if strings.TrimSpace(target) != "" {
		body["target"] = target
	}
	if strings.TrimSpace(sessionID) != "" {
		body["session_id"] = sessionID
	}
	var out ChatResponse
	if _, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "peers", peerID, "chat"), body, &out); err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Content), nil
}

func (c *Client) CreateConclusions(ctx context.Context, conclusions []ConclusionCreate) ([]Conclusion, error) {
	if len(conclusions) == 0 {
		return nil, nil
	}
	var out []Conclusion
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "conclusions"), map[string]any{
		"conclusions": conclusions,
	}, &out)
	return out, err
}

func (c *Client) ListConclusions(ctx context.Context, page, size int, reverse bool, filters map[string]any) (*ConclusionsPage, error) {
	query := map[string]string{
		"page":    fmt.Sprintf("%d", maxInt(page, 1)),
		"size":    fmt.Sprintf("%d", boundedInt(size, 1, 100, 50)),
		"reverse": fmt.Sprintf("%t", reverse),
	}
	var out ConclusionsPage
	if _, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "conclusions", "list"), map[string]any{
		"filters": nilOrMap(filters),
	}, &out, query); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) QueryConclusions(ctx context.Context, query string, topK int, distance *float64, filters map[string]any) ([]Conclusion, error) {
	body := map[string]any{
		"query":   query,
		"top_k":   boundedInt(topK, 1, 100, 10),
		"filters": nilOrMap(filters),
	}
	if distance != nil {
		body["distance"] = *distance
	}
	var out []Conclusion
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "conclusions", "query"), body, &out)
	return out, err
}

func (c *Client) DeleteConclusion(ctx context.Context, conclusionID string) error {
	return c.delete(ctx, c.endpoint("workspaces", c.workspace, "conclusions", conclusionID), nil, nil)
}

// ScheduleDream triggers Honcho's memory consolidation (dream/reasoning) for a peer.
func (c *Client) ScheduleDream(ctx context.Context, peerID, targetPeerID string) error {
	body := map[string]any{
		"peer_id":        peerID,
		"target_peer_id": targetPeerID,
	}
	_, err := c.post(ctx, c.endpoint("workspaces", c.workspace, "peers", peerID, "dream"), body, nil)
	return err
}

func (c *Client) endpoint(parts ...string) string {
	joined := make([]string, 0, len(parts)+1)
	joined = append(joined, apiVersion)
	for _, part := range parts {
		part = strings.Trim(part, "/")
		if part != "" {
			joined = append(joined, part)
		}
	}
	u, _ := url.Parse(c.baseURL)
	u.Path = path.Join(append([]string{u.Path}, joined...)...)
	return u.String()
}

// throttle enforces a minimum interval between Honcho API calls to stay
// under the 5 req/sec rate limit.  250ms spacing → max 4 req/sec.
func (c *Client) throttle() {
	const minInterval = 250 * time.Millisecond
	c.rateMu.Lock()
	defer c.rateMu.Unlock()
	if elapsed := time.Since(c.lastCall); elapsed < minInterval {
		time.Sleep(minInterval - elapsed)
	}
	c.lastCall = time.Now()
}

func (c *Client) get(ctx context.Context, endpoint string, query map[string]string, out any) error {
	c.throttle()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	c.applyHeaders(req)
	if len(query) > 0 {
		values := req.URL.Query()
		for key, value := range query {
			if strings.TrimSpace(value) != "" {
				values.Set(key, value)
			}
		}
		req.URL.RawQuery = values.Encode()
	}
	return c.do(req, out)
}

func (c *Client) post(ctx context.Context, endpoint string, body any, out any, queries ...map[string]string) ([]byte, error) {
	c.throttle()
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, reader)
	if err != nil {
		return nil, err
	}
	c.applyHeaders(req)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	applyQuery(req, queries...)
	raw, err := c.doRaw(req)
	if err != nil {
		return nil, err
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			return raw, err
		}
	}
	return raw, nil
}

func (c *Client) put(ctx context.Context, endpoint string, body any, out any, queries ...map[string]string) error {
	c.throttle()
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, reader)
	if err != nil {
		return err
	}
	c.applyHeaders(req)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	applyQuery(req, queries...)
	return c.do(req, out)
}

func (c *Client) delete(ctx context.Context, endpoint string, body any, out any, queries ...map[string]string) error {
	c.throttle()
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, reader)
	if err != nil {
		return err
	}
	c.applyHeaders(req)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	applyQuery(req, queries...)
	return c.do(req, out)
}

func (c *Client) do(req *http.Request, out any) error {
	raw, err := c.doRaw(req)
	if err != nil {
		return err
	}
	if out != nil && len(raw) > 0 {
		return json.Unmarshal(raw, out)
	}
	return nil
}

func (c *Client) doRaw(req *http.Request) ([]byte, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("honcho %s %s: status %d: %s", req.Method, req.URL.Path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func (c *Client) applyHeaders(req *http.Request) {
	if strings.TrimSpace(c.apiKey) != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	req.Header.Set("Accept", "application/json")
}

func applyQuery(req *http.Request, queries ...map[string]string) {
	if len(queries) == 0 {
		return
	}
	values := req.URL.Query()
	for _, query := range queries {
		for key, value := range query {
			if strings.TrimSpace(value) != "" {
				values.Set(key, value)
			}
		}
	}
	req.URL.RawQuery = values.Encode()
}

func nilOrMap(in map[string]any) map[string]any {
	if len(in) == 0 {
		return map[string]any{}
	}
	return in
}

func boundedInt(v, min, max, fallback int) int {
	if v <= 0 {
		v = fallback
	}
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
