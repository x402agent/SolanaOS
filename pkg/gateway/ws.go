// Package gateway :: ws.go
// WebSocket transport for the SolanaOS Gateway bridge.
// Allows browser clients (Chrome extension) to connect to the same
// TCP bridge port via WebSocket upgrade.
package gateway

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// wsUpgrader handles the HTTP → WebSocket upgrade.
var wsUpgrader = websocket.Upgrader{
	CheckOrigin:  func(r *http.Request) bool { return true },
	Subprotocols: []string{"solanaos-gateway"},
}

// handleWebSocketUpgrade is called when the first bytes of a TCP connection
// look like an HTTP GET request. The bufio.Reader still has all data buffered
// (peeked, not consumed), so we wrap it into a conn the http.Server can read.
func (b *Bridge) handleWebSocketUpgrade(ctx context.Context, conn net.Conn, br *bufio.Reader) {
	// Wrap the connection so reads come from the buffered reader first.
	bufferedConn := &bufReaderConn{Reader: br, Conn: conn}

	done := make(chan struct{})
	srv := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer close(done)
			ws, err := wsUpgrader.Upgrade(w, r, nil)
			if err != nil {
				b.logf("🌐 WebSocket upgrade failed from %s: %v", conn.RemoteAddr(), err)
				return
			}
			b.logf("🌐 WebSocket client connected from %s", conn.RemoteAddr())
			b.handleWebSocketConn(ctx, ws)
		}),
	}
	_ = srv.Serve(&singleConnListener{conn: bufferedConn, done: done})
}

// handleWebSocketConn runs the gateway protocol over a WebSocket connection.
func (b *Bridge) handleWebSocketConn(ctx context.Context, ws *websocket.Conn) {
	defer ws.Close()

	nodeID := ""
	authenticated := false
	role := ""
	var wsWriteMu sync.Mutex
	writeJSON := func(frame map[string]any) {
		wsWriteMu.Lock()
		defer wsWriteMu.Unlock()
		_ = ws.WriteJSON(frame)
	}

	// Keepalive: extend read deadline on pong, send pings every 30s.
	ws.SetReadDeadline(time.Now().Add(90 * time.Second))
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(90 * time.Second))
		return nil
	})

	pingDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				wsWriteMu.Lock()
				err := ws.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
				wsWriteMu.Unlock()
				if err != nil {
					return
				}
			case <-ctx.Done():
				return
			case <-pingDone:
				return
			}
		}
	}()
	defer close(pingDone)

	// Send connect challenge nonce.
	nonce := generateWSNonce()
	writeJSON(map[string]any{
		"type":  "event",
		"event": "connect.challenge",
		"payload": map[string]any{
			"nonce": nonce,
		},
	})

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_, msg, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				b.logf("🌐 WebSocket error from %s: %v", nodeID, err)
			}
			break
		}
		// Reset read deadline on every message to keep the connection alive.
		ws.SetReadDeadline(time.Now().Add(90 * time.Second))

		var frame map[string]any
		if err := json.Unmarshal(msg, &frame); err != nil {
			continue
		}

		frameType, _ := frame["type"].(string)

		switch frameType {
		case "req":
			id, _ := frame["id"].(string)
			method, _ := frame["method"].(string)
			params, _ := frame["params"].(map[string]any)
			b.handleWSRequest(writeJSON, id, method, params, &nodeID, &role, &authenticated)

		case "ping":
			pingID, _ := frame["id"].(string)
			writeJSON(map[string]any{"type": "pong", "id": pingID})

		case "event":
			if !authenticated {
				_ = ws.WriteJSON(map[string]any{
					"type":    "error",
					"code":    "AUTH_REQUIRED",
					"message": "authenticate first",
				})
				continue
			}
			evt, _ := frame["event"].(string)
			b.logf("📡 WS event from %s: %s", nodeID, evt)
		}
	}

	if nodeID != "" {
		if role == "node" {
			b.mu.Lock()
			delete(b.nodes, nodeID)
			b.mu.Unlock()
		}
		b.logf("🌐 WebSocket client disconnected: %s", nodeID)
	}
}

func (b *Bridge) handleWSRequest(writeJSON func(map[string]any), id, method string, params map[string]any, nodeID *string, role *string, authenticated *bool) {
	switch method {
	case "connect", "hello":
		client, _ := params["client"].(map[string]any)
		clientID, _ := client["id"].(string)
		displayName, _ := client["displayName"].(string)
		clientRole, _ := params["role"].(string)
		if clientID == "" {
			clientID = "ws-client-" + generateShortID()
		}
		if displayName == "" {
			displayName = "WebSocket Client"
		}
		if clientRole == "" {
			clientRole = "operator"
		}
		*nodeID = clientID
		*role = clientRole
		*authenticated = true

		if clientRole == "node" {
			b.mu.Lock()
			b.nodes[clientID] = &connectedNode{
				nodeID:      clientID,
				displayName: displayName,
				role:        clientRole,
				transport:   "ws",
				token:       "ws-session",
				sendJSON: func(frame map[string]any) error {
					writeJSON(frame)
					return nil
				},
				connectedAt: time.Now(),
			}
			b.mu.Unlock()
			b.logf("🔗 WebSocket node connected: %s (%s)", clientID, displayName)
		} else {
			b.logf("🔗 WebSocket client connected: %s (%s) role=%s", clientID, displayName, clientRole)
		}

		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"server": map[string]any{
					"host":    b.BridgeAddr(),
					"name":    "SolanaOS Gateway",
					"version": "3.1.0",
				},
				"auth": map[string]any{
					"deviceToken": "ws-" + generateShortID(),
					"role":        clientRole,
					"scopes":      []string{"operator.read", "operator.write"},
				},
				"snapshot": map[string]any{
					"sessionDefaults": map[string]any{
						"mainSessionKey": "main",
					},
				},
			},
		})

	case "health":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"daemon":    "alive",
				"status":    "alive",
				"oodaMode":  "live",
				"uptime":    time.Since(b.startedAt).Seconds(),
				"uptimeStr": time.Since(b.startedAt).Round(time.Second).String(),
				"nodes":     len(b.ConnectedNodes()),
				"bridge":    b.BridgeAddr(),
				"llm":       b.llm != nil && b.llm.IsConfigured(),
			},
		})
	case "node.invoke.request", "node.invoke":
		response := b.handleNodeInvokeRequest(params)
		frame := map[string]any{
			"type": "res",
			"id":   id,
			"ok":   response.ok,
		}
		if response.payload != nil {
			frame["payload"] = response.payload
		} else if response.payloadJSON != "" {
			frame["payloadJSON"] = response.payloadJSON
		}
		if response.error != nil {
			frame["error"] = map[string]any{
				"code":    response.error.Code,
				"message": response.error.Message,
			}
		}
		writeJSON(frame)
	case "node.invoke.result":
		invokeID, _ := params["id"].(string)
		if strings.TrimSpace(invokeID) == "" {
			writeJSON(map[string]any{
				"type": "res",
				"id":   id,
				"ok":   false,
				"error": map[string]any{
					"code":    "INVALID_REQUEST",
					"message": "id required",
				},
			})
			return
		}
		resp := invokeResponse{
			ok:      params["ok"] == true,
			payload: params["payload"],
		}
		if payloadJSON, ok := params["payloadJSON"].(string); ok {
			resp.payloadJSON = payloadJSON
		}
		if rawError, ok := params["error"].(map[string]any); ok {
			resp.error = &invokeError{
				Code:    strings.TrimSpace(asString(rawError["code"])),
				Message: strings.TrimSpace(asString(rawError["message"])),
			}
		}
		if !b.resolveInvokeWaiter(invokeID, resp) {
			writeJSON(map[string]any{
				"type": "res",
				"id":   id,
				"ok":   false,
				"error": map[string]any{
					"code":    "UNAVAILABLE",
					"message": "invoke waiter missing",
				},
			})
			return
		}
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "chat.send":
		runID := "run-" + generateShortID()
		message, _ := params["message"].(string)
		sessionKey, _ := params["sessionKey"].(string)
		msgPreview := message
		if len(msgPreview) > 60 {
			msgPreview = msgPreview[:60] + "..."
		}
		b.logf("💬 chat.send: run=%s session=%s msg=%q", runID, sessionKey, msgPreview)
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"runId": runID,
			},
		})
		// Run LLM inference and send the reply as a chat event.
		go func() {
			if b.llm == nil || !b.llm.IsConfigured() {
				b.logf("💬 chat.send: no LLM configured, sending fallback")
				writeJSON(map[string]any{
					"type":  "event",
					"event": "chat",
					"payload": map[string]any{
						"runId":      runID,
						"sessionKey": sessionKey,
						"state":      "final",
						"message": map[string]any{
							"role": "assistant",
							"text": "No LLM configured. Set OPENROUTER_API_KEY, XAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_MODEL in your .env, then go to Config > Apply to reload.",
						},
					},
				})
				return
			}
			b.logf("💬 chat.send: calling LLM...")
			// Store user message
			b.appendChatMessage(sessionKey, map[string]any{
				"role":    "user",
				"content": message,
				"ts":      time.Now().UnixMilli(),
			})
			ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
			defer cancel()

			// Ingest user message into Honcho memory (async, non-blocking)
			if b.honcho != nil && b.honcho.IsConfigured() {
				go func() {
					hCtx, hCancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer hCancel()
					_ = b.honcho.IngestMessage(hCtx, sessionKey, "user", message)
				}()
			}

			// Build context: Honcho memory + skills + auto-detected Solana token data
			var contextParts []string

			// Fetch Honcho memory context
			if b.honcho != nil && b.honcho.IsConfigured() {
				hCtx, hCancel := context.WithTimeout(context.Background(), 8*time.Second)
				if honchoCtx, err := b.honcho.GetContext(hCtx, sessionKey, message); err == nil && honchoCtx != "" {
					contextParts = append(contextParts, "Memory (Honcho):\n"+honchoCtx)
					b.logf("💬 Honcho context: %d chars", len(honchoCtx))
				}
				hCancel()
			}

			if b.skills != nil {
				if sc := b.skills.BuildContext(); sc != "" {
					contextParts = append(contextParts, sc)
				}
			}

			// Auto-detect Solana contract address and fetch Birdeye data
			if addr := detectSolanaAddress(message); addr != "" {
				apiKey := strings.TrimSpace(os.Getenv("BIRDEYE_API_KEY"))
				if apiKey != "" {
					b.logf("💬 Detected Solana address: %s — fetching Birdeye data", addr)
					if tokenData, err := fetchBirdeyeTokenData(ctx, addr, apiKey); err == nil {
						contextParts = append(contextParts, "Live token data for "+addr+":\n"+tokenData)
						b.logf("💬 Birdeye data fetched (%d chars)", len(tokenData))
					} else {
						b.logf("💬 Birdeye fetch failed: %v", err)
					}
				}
			}

			combinedContext := strings.Join(contextParts, "\n\n")
			reply, err := b.llm.Chat(ctx, sessionKey, message, combinedContext)
			if err != nil {
				b.logf("💬 chat.send: LLM error: %v", err)
				reply = "LLM error: " + err.Error()
			} else {
				b.logf("💬 chat.send: LLM replied (%d chars)", len(reply))
			}
			// Strip <think>...</think> reasoning blocks and special tokens from response
			reply = stripThinkingTags(reply)
			// Store assistant reply
			b.appendChatMessage(sessionKey, map[string]any{
				"role":    "assistant",
				"content": reply,
				"ts":      time.Now().UnixMilli(),
			})
			// Ingest assistant reply into Honcho
			if b.honcho != nil && b.honcho.IsConfigured() {
				go func() {
					hCtx, hCancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer hCancel()
					_ = b.honcho.IngestMessage(hCtx, sessionKey, "assistant", reply)
				}()
			}
			writeJSON(map[string]any{
				"type":  "event",
				"event": "chat",
				"payload": map[string]any{
					"runId":      runID,
					"sessionKey": sessionKey,
					"state":      "final",
					"message": map[string]any{
						"role": "assistant",
						"text": reply,
					},
				},
			})
		}()

	case "chat.abort":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "chat.history":
		historySessionKey, _ := params["sessionKey"].(string)
		if historySessionKey == "" {
			historySessionKey = "main"
		}
		stored := b.getChatHistory(historySessionKey)
		msgs := make([]any, 0, len(stored))
		for _, m := range stored {
			msgs = append(msgs, m)
		}
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"messages": msgs,
			},
		})

	case "config.get":
		cfgPath, cfgRaw, cfgParsed, cfgHash := b.loadConfigFile()
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"path":   cfgPath,
				"exists": true,
				"raw":    cfgRaw,
				"hash":   cfgHash,
				"valid":  true,
				"config": cfgParsed,
				"issues": []any{},
			},
		})

	case "config.schema":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"version": "3.1.0",
				"uiHints": map[string]any{},
				"schema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"llm": map[string]any{
							"type":  "object",
							"title": "LLM Provider",
							"properties": map[string]any{
								"provider":        map[string]any{"type": "string", "title": "Provider", "enum": []string{"openrouter", "anthropic", "xai", "ollama"}, "default": "ollama"},
								"openrouter_key":  map[string]any{"type": "string", "title": "OpenRouter API Key"},
								"anthropic_key":   map[string]any{"type": "string", "title": "Anthropic API Key"},
								"xai_key":         map[string]any{"type": "string", "title": "xAI API Key"},
								"ollama_model":    map[string]any{"type": "string", "title": "Ollama Model", "default": "minimax-m2.7:cloud"},
								"ollama_base_url": map[string]any{"type": "string", "title": "Ollama Base URL", "default": "http://127.0.0.1:11434"},
							},
						},
						"solana": map[string]any{
							"type":  "object",
							"title": "Solana",
							"properties": map[string]any{
								"rpc_url":                map[string]any{"type": "string", "title": "RPC URL"},
								"solana_tracker_api_key":  map[string]any{"type": "string", "title": "SolanaTracker API Key"},
								"helius_api_key":          map[string]any{"type": "string", "title": "Helius API Key"},
								"birdeye_api_key":         map[string]any{"type": "string", "title": "Birdeye API Key"},
							},
						},
						"telegram": map[string]any{
							"type":  "object",
							"title": "Telegram",
							"properties": map[string]any{
								"bot_token":   map[string]any{"type": "string", "title": "Bot Token"},
								"chat_id":     map[string]any{"type": "string", "title": "Chat ID"},
							},
						},
						"gateway": map[string]any{
							"type":  "object",
							"title": "Gateway",
							"properties": map[string]any{
								"port":      map[string]any{"type": "integer", "title": "Port", "default": 18790},
								"bind_addr": map[string]any{"type": "string", "title": "Bind Address", "default": "0.0.0.0"},
							},
						},
					},
				},
			},
		})

	case "config.set":
		raw, _ := params["raw"].(string)
		if raw != "" {
			b.saveConfigFile(raw)
		}
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "config.patch", "update.run":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "config.apply":
		result := b.ReloadLLM()
		b.logf("🔄 Config applied — LLM: %s", result)
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"ok":     true,
				"llm":    result,
				"reload": true,
			},
		})

	case "status":
		llmProvider := "none"
		if b.llm != nil && b.llm.IsConfigured() {
			llmProvider = "configured"
		}
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"daemon":    "alive",
				"status":    "alive",
				"oodaMode":  "sim",
				"nodes":     len(b.ConnectedNodes()),
				"bridge":    b.BridgeAddr(),
				"uptime":    time.Since(b.startedAt).Round(time.Second).String(),
				"startedAt": b.startedAt.UTC().Format(time.RFC3339),
				"llm":       llmProvider,
				"version":   "3.1.0",
			},
		})

	case "system-presence":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"nodes":   []any{},
				"status":  map[string]any{"daemon": "alive"},
				"version": "3.1.0",
			},
		})

	case "sessions.list":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"sessions": []any{},
			},
		})

	case "sessions.patch", "sessions.delete":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "agents.list":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"agents": []any{},
			},
		})

	case "agent.identity.get":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"name":   "SolanaOS",
				"avatar": nil,
			},
		})

	case "skills.status":
		skillsList := []any{}
		if b.skills != nil {
			for _, s := range b.skills.All() {
				emoji := s.Emoji
				if emoji == "" {
					emoji = "🔧"
				}
				skillsList = append(skillsList, map[string]any{
					"name":              s.Name,
					"description":       s.Description,
					"source":            "bundled",
					"filePath":          "skills/" + s.Name + "/SKILL.md",
					"baseDir":           "skills/" + s.Name,
					"skillKey":          s.Name,
					"emoji":             emoji,
					"always":            false,
					"disabled":          false,
					"blockedByAllowlist": false,
					"eligible":          true,
					"requirements":      map[string]any{"bins": []any{}, "env": []any{}, "config": []any{}, "os": []any{}},
					"missing":           map[string]any{"bins": []any{}, "env": []any{}, "config": []any{}, "os": []any{}},
					"configChecks":      []any{},
					"install":           []any{},
				})
			}
		}
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"skills":          skillsList,
				"workspaceDir":    "skills/",
				"managedSkillsDir": "~/.nanosolana/skills",
			},
		})

	case "skills.update", "skills.install":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "channels.status":
		_, _, cfgParsed, _ := b.loadConfigFile()
		channels := map[string]any{}
		telegramCfg, _ := cfgParsed["telegram"].(map[string]any)
		if telegramCfg != nil {
			configured := telegramCfg["bot_token"] != nil && telegramCfg["bot_token"] != ""
			channels["telegram"] = map[string]any{
				"configured": configured,
				"running":    configured,
				"mode":       "polling",
			}
		} else {
			channels["telegram"] = map[string]any{"configured": false, "running": false}
		}
		channels["whatsapp"] = map[string]any{"configured": false, "running": false, "linked": false}
		channels["discord"] = map[string]any{"configured": false, "running": false}
		channels["slack"] = map[string]any{"configured": false, "running": false}
		channels["signal"] = map[string]any{"configured": false, "running": false}
		channels["nostr"] = map[string]any{"configured": false, "running": false}
		channels["imessage"] = map[string]any{"configured": false, "running": false}
		channels["google-chat"] = map[string]any{"configured": false, "running": false}
		// WebChat is always available via the gateway
		channels["webchat"] = map[string]any{
			"configured": true,
			"running":    true,
			"mode":       "websocket",
			"url":        "ws://" + b.BridgeAddr(),
		}
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"channels": channels,
			},
		})

	case "cron.status":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"enabled": false,
				"jobs":    []any{},
			},
		})

	case "cron.list", "cron.runs":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"items": []any{},
			},
		})

	case "cron.add", "cron.update", "cron.run", "cron.remove":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "logs.tail":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"entries":  []any{},
				"hasMore":  false,
				"newStart": "",
			},
		})

	case "device.pair.list":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"requests": []any{},
			},
		})

	case "device.pair.approve", "device.pair.reject", "device.token.rotate", "device.token.revoke":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "web.login.start", "web.login.wait", "channels.logout",
		"channels.config.get", "channels.config.set", "channels.probe":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "exec.approval.resolve":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	case "models.list":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"models": []any{
					map[string]any{
						"id":       "ollama/minimax-m2.7:cloud",
						"provider": "ollama",
						"name":     "MiniMax M2.7",
						"active":   b.llm != nil && b.llm.IsConfigured(),
					},
				},
			},
		})

	case "last-heartbeat":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"daemon":    "alive",
				"updatedAt": time.Now().UTC().Format(time.RFC3339),
				"uptime":    time.Since(b.startedAt).Round(time.Second).String(),
			},
		})

	case "exec.approvals.get", "exec.approvals.node.get":
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   true,
			"payload": map[string]any{
				"approvals": map[string]any{},
			},
		})

	case "exec.approvals.set", "exec.approvals.node.set":
		writeJSON(map[string]any{
			"type":    "res",
			"id":      id,
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})

	default:
		writeJSON(map[string]any{
			"type": "res",
			"id":   id,
			"ok":   false,
			"error": map[string]any{
				"code":    "UNKNOWN_METHOD",
				"message": "unsupported method: " + method,
			},
		})
	}
}

func (b *Bridge) handleNodeInvokeRequest(params map[string]any) invokeResponse {
	command, _ := params["command"].(string)
	if strings.TrimSpace(command) == "" {
		return invokeResponse{
			ok: false,
			error: &invokeError{
				Code:    "INVALID_REQUEST",
				Message: "command required",
			},
		}
	}
	nodeID, _ := params["nodeId"].(string)
	target, err := b.resolveInvokeTarget(nodeID)
	if err != nil {
		return invokeResponse{
			ok: false,
			error: &invokeError{
				Code:    "NODE_NOT_AVAILABLE",
				Message: err.Error(),
			},
		}
	}
	invokeID, _ := params["id"].(string)
	if strings.TrimSpace(invokeID) == "" {
		invokeID = "invoke-" + generateShortID()
	}
	timeoutMs := asInt64(params["timeoutMs"])
	if timeoutMs <= 0 {
		timeoutMs = 15000
	}
	payload := map[string]any{
		"id":        invokeID,
		"nodeId":    target.nodeID,
		"command":   command,
		"timeoutMs": timeoutMs,
	}
	if params["params"] != nil {
		payload["params"] = params["params"]
	}
	if paramsJSON, ok := params["paramsJSON"].(string); ok && strings.TrimSpace(paramsJSON) != "" {
		payload["paramsJSON"] = paramsJSON
	}
	waiter := b.registerInvokeWaiter(invokeID)
	if err := target.sendInvokeRequest(payload); err != nil {
		b.cancelInvokeWaiter(invokeID)
		return invokeResponse{
			ok: false,
			error: &invokeError{
				Code:    "UNAVAILABLE",
				Message: err.Error(),
			},
		}
	}
	select {
	case response, ok := <-waiter:
		if !ok {
			return invokeResponse{
				ok: false,
				error: &invokeError{
					Code:    "UNAVAILABLE",
					Message: "invoke waiter closed",
				},
			}
		}
		return response
	case <-time.After(time.Duration(timeoutMs+1000) * time.Millisecond):
		b.cancelInvokeWaiter(invokeID)
		return invokeResponse{
			ok: false,
			error: &invokeError{
				Code:    "TIMEOUT",
				Message: "invoke timed out",
			},
		}
	}
}

// stripThinkingTags removes <think>...</think> blocks and special tokens from LLM output.
func stripThinkingTags(s string) string {
	// Remove <think>...</think> blocks (reasoning models like Qwen/DeepSeek)
	for {
		start := strings.Index(s, "<think>")
		if start == -1 {
			break
		}
		end := strings.Index(s, "</think>")
		if end == -1 {
			// Unclosed <think> — remove from <think> to end
			s = s[:start]
			break
		}
		s = s[:start] + s[end+len("</think>"):]
	}
	// Remove special tokens
	for _, tok := range []string{"<|endoftext|>", "<|im_end|>", "<|im_start|>"} {
		s = strings.ReplaceAll(s, tok, "")
	}
	// Remove repeated user/assistant prompt leakage
	if idx := strings.Index(s, "<|im_start|>"); idx != -1 {
		s = s[:idx]
	}
	return strings.TrimSpace(s)
}

func generateWSNonce() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

// ── Connection helpers ──────────────────────────────────────────────

// bufReaderConn wraps a net.Conn so reads drain the bufio.Reader first
// (which may contain peeked/buffered bytes), then fall through to the conn.
type bufReaderConn struct {
	Reader *bufio.Reader
	net.Conn
}

func (c *bufReaderConn) Read(b []byte) (int, error) {
	return c.Reader.Read(b)
}

// singleConnListener serves exactly one connection to http.Server.Serve.
type singleConnListener struct {
	conn net.Conn
	done chan struct{}
	once sync.Once
}

func (l *singleConnListener) Accept() (net.Conn, error) {
	var conn net.Conn
	l.once.Do(func() { conn = l.conn })
	if conn != nil {
		return conn, nil
	}
	<-l.done
	return nil, net.ErrClosed
}

func (l *singleConnListener) Close() error   { return nil }
func (l *singleConnListener) Addr() net.Addr { return l.conn.LocalAddr() }

// isHTTPRequest checks if peeked bytes look like an HTTP request (e.g. "GET / HTTP/1.1").
func isHTTPRequest(peeked []byte) bool {
	s := strings.ToUpper(string(peeked))
	return strings.HasPrefix(s, "GET ") ||
		strings.HasPrefix(s, "POST ") ||
		strings.HasPrefix(s, "PUT ") ||
		strings.HasPrefix(s, "HEAD ")
}

func asString(value any) string {
	if str, ok := value.(string); ok {
		return str
	}
	return ""
}

func asInt64(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case float32:
		return int64(typed)
	case int:
		return int64(typed)
	case int64:
		return typed
	case int32:
		return int64(typed)
	case json.Number:
		v, _ := typed.Int64()
		return v
	default:
		return 0
	}
}
