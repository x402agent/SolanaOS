// Package gateway provides the SolanaOS Gateway — a native Go TCP bridge
// server that connects headless hardware nodes to the daemon. No external
// dependencies (pure Go, no Node.js).
//
// Protocol: JSON-line over TCP (one JSON object per line, newline-delimited).
// Auth: Token-based pairing flow (pair-request → approve → pair-ok → hello).
// Security: Binds to Tailscale IP when available; tokens are cryptographic random.
package gateway

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// BridgeConfig configures the gateway bridge server.
type BridgeConfig struct {
	Port         int
	BindAddr     string // Override bind address (default: auto-detect Tailscale or 0.0.0.0)
	UseTailscale bool
	AuthToken    string // Master auth token (auto-generated if empty)
}

// DefaultBridgeConfig returns production-safe defaults.
func DefaultBridgeConfig() BridgeConfig {
	return BridgeConfig{
		Port:         18790,
		UseTailscale: true,
	}
}

// Bridge is the native SolanaOS gateway bridge server.
type Bridge struct {
	cfg       BridgeConfig
	listener  net.Listener
	mu        sync.RWMutex
	nodes     map[string]*connectedNode
	pending   map[string]*pairRequest
	invokes   map[string]chan invokeResponse
	authToken string
	logf      func(string, ...any)
	cancel    context.CancelFunc
	llm       LLMProvider    // optional chat inference
	skills    SkillsProvider // optional skills catalog
	startedAt time.Time
}

// LLMProvider allows the gateway to call an LLM for chat.send.
type LLMProvider interface {
	IsConfigured() bool
	Chat(ctx context.Context, sessionID, userMsg, contextStr string) (string, error)
}

// SetLLM attaches an LLM provider for chat inference.
func (b *Bridge) SetLLM(provider LLMProvider) {
	b.llm = provider
}

// SkillsProvider gives the gateway access to loaded skills.
type SkillsProvider interface {
	Count() int
	All() []SkillEntry
	Get(name string) *SkillEntry
	BuildContext() string
}

// SkillEntry is a skill visible to the gateway.
type SkillEntry struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags,omitempty"`
	Emoji       string   `json:"emoji,omitempty"`
}

// SetSkills attaches a skills provider.
func (b *Bridge) SetSkills(provider SkillsProvider) {
	b.skills = provider
}

// configFilePath returns the path to solanaos.json.
func configFilePath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".nanosolana", "solanaos.json")
}

// loadConfigFile reads the config file and returns path, raw JSON, parsed map, and hash.
func (b *Bridge) loadConfigFile() (string, string, map[string]any, string) {
	path := configFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		// Create default config if missing
		_ = os.MkdirAll(filepath.Dir(path), 0o755)
		data = []byte("{}")
		_ = os.WriteFile(path, data, 0o644)
	}
	raw := string(data)
	h := sha256.Sum256(data)
	hash := hex.EncodeToString(h[:8])
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		parsed = map[string]any{}
	}
	return path, raw, parsed, hash
}

// saveConfigFile writes raw JSON to the config file.
func (b *Bridge) saveConfigFile(raw string) {
	path := configFilePath()
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	_ = os.WriteFile(path, []byte(raw), 0o644)
	b.logf("📝 Config saved: %s", path)
}

type connectedNode struct {
	nodeID      string
	displayName string
	role        string
	transport   string
	token       string
	conn        net.Conn
	encoder     *json.Encoder
	sendJSON    func(map[string]any) error
	mu          sync.Mutex
	connectedAt time.Time
}

type pairRequest struct {
	requestID   string
	nodeID      string
	displayName string
	conn        net.Conn
	createdAt   time.Time
}

func (n *connectedNode) sendFrame(frame map[string]any) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	switch {
	case n.sendJSON != nil:
		return n.sendJSON(frame)
	case n.encoder != nil:
		return n.encoder.Encode(frame)
	default:
		return fmt.Errorf("UNAVAILABLE: node transport missing encoder")
	}
}

func (n *connectedNode) sendInvokeRequest(payload map[string]any) error {
	if n.transport == "ws" {
		return n.sendFrame(
			map[string]any{
				"type":    "event",
				"event":   "node.invoke.request",
				"payload": payload,
			},
		)
	}
	frame := map[string]any{"type": "invoke"}
	for key, value := range payload {
		frame[key] = value
	}
	return n.sendFrame(frame)
}

type invokeResponse struct {
	ok          bool
	payload     any
	payloadJSON string
	error       *invokeError
}

type invokeError struct {
	Code    string
	Message string
}

// NewBridge creates a new gateway bridge server.
func NewBridge(cfg BridgeConfig, logf func(string, ...any)) *Bridge {
	if logf == nil {
		logf = func(format string, args ...any) { log.Printf("[GATEWAY] "+format, args...) }
	}
	if cfg.AuthToken == "" {
		cfg.AuthToken = generateToken()
	}
	return &Bridge{
		cfg:       cfg,
		nodes:     make(map[string]*connectedNode),
		pending:   make(map[string]*pairRequest),
		invokes:   make(map[string]chan invokeResponse),
		authToken: cfg.AuthToken,
		logf:      logf,
	}
}

// Start begins listening for node connections.
func (b *Bridge) Start(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	b.cancel = cancel
	b.startedAt = time.Now()

	bindAddr := b.resolveBindAddr()
	addr := fmt.Sprintf("%s:%d", bindAddr, b.cfg.Port)

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		cancel()
		return fmt.Errorf("bridge listen on %s: %w", addr, err)
	}
	b.listener = listener

	b.logf("🌐 SolanaOS Gateway started on %s", addr)
	if b.cfg.UseTailscale {
		if tsIP, err := DetectTailscaleIP(); err == nil {
			b.logf("🔒 Tailscale IP: %s:%d", tsIP, b.cfg.Port)
		}
	}

	go b.acceptLoop(ctx)
	return nil
}

// Stop gracefully shuts down the bridge.
func (b *Bridge) Stop() {
	if b.cancel != nil {
		b.cancel()
	}
	if b.listener != nil {
		_ = b.listener.Close()
	}
	b.mu.RLock()
	for _, node := range b.nodes {
		_ = node.conn.Close()
	}
	b.mu.RUnlock()
	b.logf("🌐 Gateway stopped")
}

// BridgeAddr returns the external-facing bridge address.
func (b *Bridge) BridgeAddr() string {
	if b.cfg.UseTailscale {
		if tsIP, err := DetectTailscaleIP(); err == nil {
			return fmt.Sprintf("%s:%d", tsIP, b.cfg.Port)
		}
	}
	return fmt.Sprintf("127.0.0.1:%d", b.cfg.Port)
}

// ConnectedNodes returns a list of connected node IDs.
func (b *Bridge) ConnectedNodes() []string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	ids := make([]string, 0, len(b.nodes))
	for id := range b.nodes {
		ids = append(ids, id)
	}
	return ids
}

func (b *Bridge) resolveInvokeTarget(nodeID string) (*connectedNode, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if trimmed := strings.TrimSpace(nodeID); trimmed != "" {
		node, ok := b.nodes[trimmed]
		if !ok || node.role != "node" {
			return nil, fmt.Errorf("NODE_NOT_FOUND: node %s is not connected", trimmed)
		}
		return node, nil
	}
	var matches []*connectedNode
	for _, node := range b.nodes {
		if node.role == "node" {
			matches = append(matches, node)
		}
	}
	switch len(matches) {
	case 0:
		return nil, fmt.Errorf("NODE_NOT_FOUND: no connected nodes")
	case 1:
		return matches[0], nil
	default:
		return nil, fmt.Errorf("AMBIGUOUS_NODE: multiple nodes connected, provide nodeId")
	}
}

func (b *Bridge) registerInvokeWaiter(id string) chan invokeResponse {
	ch := make(chan invokeResponse, 1)
	b.mu.Lock()
	b.invokes[id] = ch
	b.mu.Unlock()
	return ch
}

func (b *Bridge) resolveInvokeWaiter(id string, response invokeResponse) bool {
	b.mu.Lock()
	waiter, ok := b.invokes[id]
	if ok {
		delete(b.invokes, id)
	}
	b.mu.Unlock()
	if !ok {
		return false
	}
	waiter <- response
	close(waiter)
	return true
}

func (b *Bridge) cancelInvokeWaiter(id string) {
	b.mu.Lock()
	waiter, ok := b.invokes[id]
	if ok {
		delete(b.invokes, id)
	}
	b.mu.Unlock()
	if ok {
		close(waiter)
	}
}

// ApproveNode approves a pending pair request.
func (b *Bridge) ApproveNode(requestID string) error {
	b.mu.Lock()
	req, ok := b.pending[requestID]
	if !ok {
		b.mu.Unlock()
		return fmt.Errorf("no pending pair request: %s", requestID)
	}
	delete(b.pending, requestID)
	b.mu.Unlock()

	token := generateToken()
	response := map[string]any{
		"type":  "pair-ok",
		"token": token,
	}
	data, _ := json.Marshal(response)
	_, err := req.conn.Write(append(data, '\n'))
	if err != nil {
		return fmt.Errorf("send pair-ok: %w", err)
	}

	b.logf("✅ Approved node %s (%s)", req.nodeID, req.displayName)
	return nil
}

func (b *Bridge) acceptLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		conn, err := b.listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			b.logf("accept error: %v", err)
			continue
		}

		go b.handleConnection(ctx, conn)
	}
}

func (b *Bridge) handleConnection(ctx context.Context, conn net.Conn) {
	defer conn.Close()

	// Peek the first 4 bytes to detect HTTP (WebSocket upgrade) vs JSON-line.
	br := bufio.NewReaderSize(conn, 8192)
	peeked, _ := br.Peek(4)
	if isHTTPRequest(peeked) {
		b.handleWebSocketUpgrade(ctx, conn, br)
		return
	}

	scanner := bufio.NewScanner(br)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)

	var nodeID string
	authenticated := false

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var frame map[string]any
		if err := json.Unmarshal([]byte(line), &frame); err != nil {
			b.handleInvalidFrame(conn, line, err)
			return
		}

		frameType, _ := frame["type"].(string)
		if abort := b.processFrame(conn, frame, frameType, &nodeID, &authenticated); abort {
			return
		}
	}

	// Cleanup on disconnect
	if nodeID != "" {
		b.mu.Lock()
		delete(b.nodes, nodeID)
		b.mu.Unlock()
		b.logf("🔌 Node disconnected: %s", nodeID)
	}
}

// processFrame handles a single JSON-line frame from a TCP node connection.
// Returns true if the connection should be terminated (abort).
func (b *Bridge) processFrame(conn net.Conn, frame map[string]any, frameType string, nodeID *string, authenticated *bool) bool {
	switch frameType {
	case "pair-request":
		*nodeID, _ = frame["nodeId"].(string)
		displayName, _ := frame["displayName"].(string)
		requestID := generateShortID()

		b.mu.Lock()
		b.pending[requestID] = &pairRequest{
			requestID:   requestID,
			nodeID:      *nodeID,
			displayName: displayName,
			conn:        conn,
			createdAt:   time.Now(),
		}
		b.mu.Unlock()

		b.logf("📋 Pair request: %s (%s) → approve with ID: %s", *nodeID, displayName, requestID)
		_ = b.ApproveNode(requestID)

	case "hello":
		*nodeID, _ = frame["nodeId"].(string)
		token, _ := frame["token"].(string)
		displayName, _ := frame["displayName"].(string)

		if token == "" {
			sendError(conn, "AUTH_REQUIRED", "token required")
			return true
		}

		*authenticated = true
		node := &connectedNode{
			nodeID:      *nodeID,
			displayName: displayName,
			role:        "node",
			transport:   "tcp",
			token:       token,
			conn:        conn,
			encoder:     json.NewEncoder(conn),
			connectedAt: time.Now(),
		}

		b.mu.Lock()
		b.nodes[*nodeID] = node
		b.mu.Unlock()

		response := map[string]any{
			"type":       "hello-ok",
			"serverName": "SolanaOS Gateway",
		}
		data, _ := json.Marshal(response)
		_, _ = conn.Write(append(data, '\n'))
		b.logf("🔗 Node connected: %s (%s)", *nodeID, displayName)

	case "ping":
		id, _ := frame["id"].(string)
		pong := map[string]any{"type": "pong", "id": id}
		data, _ := json.Marshal(pong)
		_, _ = conn.Write(append(data, '\n'))

	case "event":
		if !*authenticated {
			sendError(conn, "AUTH_REQUIRED", "authenticate first")
			return false
		}
		evt, _ := frame["event"].(string)
		b.logf("📡 Event from %s: %s", *nodeID, evt)
	case "invoke-res":
		if !*authenticated {
			sendError(conn, "AUTH_REQUIRED", "authenticate first")
			return false
		}
		id, _ := frame["id"].(string)
		if strings.TrimSpace(id) == "" {
			return false
		}
		resp := invokeResponse{
			ok:      frame["ok"] == true,
			payload: frame["payload"],
		}
		if payloadJSON, ok := frame["payloadJSON"].(string); ok {
			resp.payloadJSON = payloadJSON
		}
		if rawError, ok := frame["error"].(map[string]any); ok {
			resp.error = &invokeError{
				Code:    strings.TrimSpace(fmt.Sprint(rawError["code"])),
				Message: strings.TrimSpace(fmt.Sprint(rawError["message"])),
			}
		}
		b.resolveInvokeWaiter(id, resp)
	}
	return false
}

func (b *Bridge) handleInvalidFrame(conn net.Conn, line string, err error) {
	remote := conn.RemoteAddr().String()
	preview := line
	if len(preview) > 96 {
		preview = preview[:96] + "..."
	}

	switch detectPlaintextProtocol(line) {
	case "http":
		b.logf("rejected HTTP probe from %s on JSON bridge: %q", remote, preview)
		_, _ = conn.Write([]byte("HTTP/1.1 426 Upgrade Required\r\nContent-Type: text/plain; charset=utf-8\r\nConnection: close\r\n\r\nSolanaOS Gateway speaks JSON-line over raw TCP, not HTTP.\r\nUse `nanosolana node pair --bridge ...` or `nanosolana node run --bridge ...`.\r\n"))
	case "tls":
		b.logf("rejected TLS probe from %s on JSON bridge", remote)
	default:
		b.logf("rejected invalid frame from %s: %v (line=%q)", remote, err, preview)
	}
}

func detectPlaintextProtocol(line string) string {
	upper := strings.ToUpper(strings.TrimSpace(line))
	switch {
	case strings.HasPrefix(upper, "GET "),
		strings.HasPrefix(upper, "POST "),
		strings.HasPrefix(upper, "PUT "),
		strings.HasPrefix(upper, "PATCH "),
		strings.HasPrefix(upper, "DELETE "),
		strings.HasPrefix(upper, "HEAD "),
		strings.HasPrefix(upper, "OPTIONS "),
		strings.HasPrefix(upper, "CONNECT "),
		strings.HasPrefix(upper, "TRACE "),
		strings.HasPrefix(upper, "HOST:"),
		strings.HasPrefix(upper, "USER-AGENT:"),
		strings.HasPrefix(upper, "ACCEPT:"),
		strings.HasPrefix(upper, "UPGRADE:"),
		strings.HasPrefix(upper, "CONNECTION:"),
		strings.HasPrefix(upper, "SEC-WEBSOCKET-"),
		strings.HasPrefix(upper, "HTTP/"):
		return "http"
	case strings.HasPrefix(line, "\x16\x03"):
		return "tls"
	default:
		return ""
	}
}

func (b *Bridge) resolveBindAddr() string {
	if b.cfg.BindAddr != "" {
		return b.cfg.BindAddr
	}
	if b.cfg.UseTailscale {
		if ip, err := DetectTailscaleIP(); err == nil {
			return ip
		}
	}
	return "0.0.0.0"
}

// ── Helpers ──────────────────────────────────────────────────────────

func generateToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("tk-%d", time.Now().UnixNano())
	}
	return "ntk-" + hex.EncodeToString(buf)
}

func generateShortID() string {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

func sendError(conn net.Conn, code, message string) {
	frame := map[string]any{
		"type":    "error",
		"code":    code,
		"message": message,
	}
	data, _ := json.Marshal(frame)
	_, _ = conn.Write(append(data, '\n'))
}
