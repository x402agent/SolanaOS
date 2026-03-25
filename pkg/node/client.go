// Package node provides a headless bridge client for connecting NanoSolana
// hardware nodes (Raspberry Pi, NVIDIA Orin Nano, etc.) to a NanoSolana
// gateway over TCP. Adapted from ClawGo for the MawdBot Go monorepo.
//
// The client handles:
//   - Gateway bridge connection with exponential backoff reconnect
//   - Node pairing and authentication handshake
//   - Voice transcript and agent.request event forwarding
//   - Chat subscription with TTS output
//   - mDNS/Bonjour service advertising
//   - Ping/pong keepalive
package node

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

// ── Bridge Client ────────────────────────────────────────────────────

// BridgeClient manages a persistent TCP connection to the gateway bridge.
type BridgeClient struct {
	conn         net.Conn
	mu           sync.Mutex
	logf         func(string, ...any)
	done         chan struct{}
	errs         chan error
	frames       chan map[string]any
	eventMu      sync.RWMutex
	eventHandler func(string, string)
}

// ConnectBridge dials the gateway bridge and returns a ready client.
func ConnectBridge(addr string) (*BridgeClient, error) {
	if addr == "" {
		return nil, errors.New("bridge address required")
	}
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return nil, err
	}
	client := &BridgeClient{
		conn:   conn,
		logf:   func(format string, args ...any) { fmt.Fprintf(os.Stderr, format+"\n", args...) },
		done:   make(chan struct{}),
		errs:   make(chan error, 1),
		frames: make(chan map[string]any, 16),
	}
	go client.readLoop()
	return client, nil
}

// Close shuts down the bridge connection.
func (c *BridgeClient) Close() {
	select {
	case <-c.done:
	default:
		close(c.done)
	}
	_ = c.conn.Close()
}

// SendFrame marshals and writes a JSON frame to the bridge.
func (c *BridgeClient) SendFrame(frame any) error {
	payload, err := json.Marshal(frame)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_, err = c.conn.Write(append(payload, 10))
	return err
}

// SetEventHandler registers a callback for bridge events.
func (c *BridgeClient) SetEventHandler(fn func(string, string)) {
	c.eventMu.Lock()
	c.eventHandler = fn
	c.eventMu.Unlock()
}

// Logf logs through the client's logger.
func (c *BridgeClient) Logf(format string, args ...any) {
	c.logf(format, args...)
}

// Errs returns the error channel.
func (c *BridgeClient) Errs() <-chan error { return c.errs }

// Frames returns the frame channel.
func (c *BridgeClient) Frames() <-chan map[string]any { return c.frames }

// Done returns the done channel.
func (c *BridgeClient) Done() <-chan struct{} { return c.done }

func (c *BridgeClient) dispatchEvent(evt, payload string) {
	c.eventMu.RLock()
	handler := c.eventHandler
	c.eventMu.RUnlock()
	if handler != nil {
		handler(evt, payload)
	}
}

func (c *BridgeClient) readLoop() {
	scanner := bufio.NewScanner(c.conn)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var frame map[string]any
		if err := json.Unmarshal([]byte(line), &frame); err != nil {
			c.logf("invalid frame: %v", err)
			continue
		}
		select {
		case c.frames <- frame:
		case <-c.done:
			return
		}
	}
	if err := scanner.Err(); err != nil && !errors.Is(err, io.EOF) {
		c.errs <- err
		return
	}
	c.errs <- io.EOF
}

// ── Frame Helpers ────────────────────────────────────────────────────

// HandleFrame processes a single bridge frame (ping/error/invoke/event).
func HandleFrame(c *BridgeClient, frame map[string]any) error {
	switch FrameType(frame) {
	case "ping":
		id := FrameString(frame, "id")
		if id != "" {
			_ = c.SendFrame(map[string]any{"type": "pong", "id": id})
		}
	case "error":
		code := FrameString(frame, "code")
		msg := FrameString(frame, "message")
		if code != "" || msg != "" {
			return fmt.Errorf("bridge error: %s %s", code, msg)
		}
	case "invoke":
		id := FrameString(frame, "id")
		if id != "" {
			_ = c.SendFrame(map[string]any{
				"type": "invoke-res",
				"id":   id,
				"ok":   false,
				"error": map[string]any{
					"code":    "UNAVAILABLE",
					"message": "headless node has no commands",
				},
			})
		}
	case "req":
		id := FrameString(frame, "id")
		if id != "" {
			_ = c.SendFrame(map[string]any{
				"type": "res",
				"id":   id,
				"ok":   false,
				"error": map[string]any{
					"code":    "UNAVAILABLE",
					"message": "headless node has no RPC",
				},
			})
		}
	case "event":
		evt := FrameString(frame, "event")
		if evt != "" {
			payload := FrameString(frame, "payloadJSON")
			c.logf("event: %s", evt)
			c.dispatchEvent(evt, payload)
		}
	}
	return nil
}

// FrameType extracts the "type" field from a frame.
func FrameType(frame map[string]any) string {
	if frame == nil {
		return ""
	}
	if v, ok := frame["type"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprint(v)
	}
	return ""
}

// FrameString extracts a string value from a frame by key.
func FrameString(frame map[string]any, key string) string {
	if frame == nil {
		return ""
	}
	if v, ok := frame[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		if v != nil {
			return fmt.Sprint(v)
		}
	}
	return ""
}

// ── Protocol Helpers ─────────────────────────────────────────────────

// SendPairRequest initiates a pairing handshake with the gateway.
func SendPairRequest(c *BridgeClient, cfg NodeConfig, state *NodeState) error {
	frame := map[string]any{
		"type":            "pair-request",
		"nodeId":          state.NodeID,
		"displayName":     state.DisplayName,
		"platform":        cfg.Platform,
		"version":         cfg.Version,
		"deviceFamily":    cfg.DeviceFamily,
		"modelIdentifier": cfg.ModelID,
		"caps":            cfg.Caps,
		"commands":        cfg.Commands,
		"permissions":     permissionsOrEmpty(cfg.Permissions),
	}
	if cfg.PairSilent {
		frame["silent"] = true
	}
	return c.SendFrame(frame)
}

// SendHello performs the authenticated hello handshake.
func SendHello(c *BridgeClient, cfg NodeConfig, state *NodeState) error {
	frame := map[string]any{
		"type":            "hello",
		"nodeId":          state.NodeID,
		"displayName":     state.DisplayName,
		"token":           state.Token,
		"platform":        cfg.Platform,
		"version":         cfg.Version,
		"deviceFamily":    cfg.DeviceFamily,
		"modelIdentifier": cfg.ModelID,
		"caps":            cfg.Caps,
		"commands":        cfg.Commands,
		"permissions":     permissionsOrEmpty(cfg.Permissions),
	}
	return c.SendFrame(frame)
}

// SubscribeChat sends a chat.subscribe event to the bridge.
func SubscribeChat(c *BridgeClient, sessionKey string) error {
	if strings.TrimSpace(sessionKey) == "" {
		return nil
	}
	payload, err := json.Marshal(map[string]string{"sessionKey": sessionKey})
	if err != nil {
		return err
	}
	return c.SendFrame(map[string]any{
		"type":        "event",
		"event":       "chat.subscribe",
		"payloadJSON": string(payload),
	})
}

// WaitForPair blocks until the bridge sends a pair-ok with a token.
func WaitForPair(c *BridgeClient) (string, error) {
	deadline := time.After(6 * time.Minute)
	for {
		select {
		case <-deadline:
			return "", errors.New("pairing timeout")
		case err := <-c.errs:
			return "", err
		case frame := <-c.frames:
			if frame == nil {
				continue
			}
			if err := HandleFrame(c, frame); err != nil {
				return "", err
			}
			if FrameType(frame) == "pair-ok" {
				token := FrameString(frame, "token")
				if token == "" {
					return "", errors.New("pair-ok missing token")
				}
				return token, nil
			}
		}
	}
}

// WaitForHello blocks until the bridge sends a hello-ok.
func WaitForHello(c *BridgeClient) error {
	deadline := time.After(30 * time.Second)
	for {
		select {
		case <-deadline:
			return errors.New("hello timeout")
		case err := <-c.errs:
			return err
		case frame := <-c.frames:
			if frame == nil {
				continue
			}
			if err := HandleFrame(c, frame); err != nil {
				return err
			}
			if FrameType(frame) == "hello-ok" {
				serverName := FrameString(frame, "serverName")
				if serverName != "" {
					c.logf("hello ok (server=%s)", serverName)
				}
				return nil
			}
		}
	}
}

// SendVoiceTranscript forwards a speech-to-text result to the gateway.
func SendVoiceTranscript(c *BridgeClient, sessionKey, text string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	payload := map[string]any{"text": text}
	if sessionKey != "" {
		payload["sessionKey"] = sessionKey
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.SendFrame(map[string]any{
		"type":        "event",
		"event":       "voice.transcript",
		"payloadJSON": string(payloadJSON),
	})
}

// SendAgentRequest sends a message directly to the agent via the gateway.
func SendAgentRequest(c *BridgeClient, sessionKey, text string, deliver bool, channel, to string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	payload := map[string]any{"message": text}
	if sessionKey != "" {
		payload["sessionKey"] = sessionKey
	}
	if deliver && channel != "" {
		payload["deliver"] = true
		payload["channel"] = channel
		if to != "" {
			payload["to"] = to
		}
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.SendFrame(map[string]any{
		"type":        "event",
		"event":       "agent.request",
		"payloadJSON": string(payloadJSON),
	})
}

// PingLoop sends periodic pings to keep the connection alive.
func PingLoop(ctx context.Context, c *BridgeClient, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			id := RandomID(8)
			_ = c.SendFrame(map[string]any{"type": "ping", "id": id})
		}
	}
}

// ── RunNode — full headless node lifecycle ────────────────────────────

// RunNode connects to the bridge, authenticates, and runs the headless
// node loop with reconnection, chat subscription, and optional TTS.
func RunNode(ctx context.Context, cfg NodeConfig) error {
	ctx, cancel := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer cancel()

	logf := func(format string, args ...any) { fmt.Fprintf(os.Stderr, "[node] "+format+"\n", args...) }

	state, err := LoadOrInitState(cfg.StatePath)
	if err != nil {
		return err
	}
	if cfg.NodeID != "" {
		state.NodeID = cfg.NodeID
	}
	if cfg.DisplayName != "" {
		state.DisplayName = cfg.DisplayName
	}

	var mdnsCleanup func()
	mdnsStarted := false
	backoff := time.Second

	for {
		select {
		case <-ctx.Done():
			if mdnsCleanup != nil {
				mdnsCleanup()
			}
			return nil
		default:
		}

		client, err := ConnectBridge(cfg.BridgeAddr)
		if err != nil {
			logf("bridge connect failed: %v", err)
			time.Sleep(backoff)
			if backoff < 15*time.Second {
				backoff *= 2
				if backoff > 15*time.Second {
					backoff = 15 * time.Second
				}
			}
			continue
		}
		backoff = time.Second
		client.logf("connected to bridge %s", cfg.BridgeAddr)

		// ── Pairing ──────────────────────────────────────────────
		if strings.TrimSpace(state.Token) == "" {
			client.logf("no token found; requesting pairing")
			if err := SendPairRequest(client, cfg, state); err != nil {
				client.Close()
				return err
			}
			token, err := WaitForPair(client)
			if err != nil {
				client.Close()
				return err
			}
			state.Token = token
			if err := SaveState(cfg.StatePath, state); err != nil {
				client.Close()
				return err
			}
			client.logf("paired ok; token saved to %s", cfg.StatePath)
		}

		// ── Hello ────────────────────────────────────────────────
		if err := SendHello(client, cfg, state); err != nil {
			client.Close()
			return err
		}
		if err := WaitForHello(client); err != nil {
			client.Close()
			return err
		}

		// ── mDNS ─────────────────────────────────────────────────
		if cfg.MDNSEnabled && !mdnsStarted {
			mdnsCleanup = StartMDNS(cfg, state, client.logf)
			mdnsStarted = true
		}

		// ── Ping loop ────────────────────────────────────────────
		connCtx, connCancel := context.WithCancel(ctx)
		if cfg.PingInterval > 0 {
			go PingLoop(connCtx, client, cfg.PingInterval)
		}

		// ── Event loop ───────────────────────────────────────────
		for {
			select {
			case <-ctx.Done():
				connCancel()
				client.Close()
				if mdnsCleanup != nil {
					mdnsCleanup()
				}
				return nil
			case err := <-client.errs:
				if err != nil {
					client.logf("bridge error: %v", err)
				}
				connCancel()
				client.Close()
				goto reconnect
			case frame := <-client.frames:
				if frame == nil {
					continue
				}
				if err := HandleFrame(client, frame); err != nil {
					client.logf("frame error: %v", err)
					connCancel()
					client.Close()
					goto reconnect
				}
			}
		}

	reconnect:
		if ctx.Err() != nil {
			if mdnsCleanup != nil {
				mdnsCleanup()
			}
			return nil
		}
		time.Sleep(backoff)
		if backoff < 15*time.Second {
			backoff *= 2
			if backoff > 15*time.Second {
				backoff = 15 * time.Second
			}
		}
	}
}

func permissionsOrEmpty(perms map[string]bool) map[string]bool {
	if perms == nil {
		return map[string]bool{}
	}
	return perms
}
