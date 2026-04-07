// Package bluebubbles provides the BlueBubbles iMessage channel for SolanaOS.
// Connects to a BlueBubbles server via its REST API to send/receive iMessages.
package bluebubbles

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/channels"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

// BlueBubblesChannel bridges iMessage via a BlueBubbles server.
type BlueBubblesChannel struct {
	*channels.BaseChannel
	cfg        *config.Config
	serverURL  string
	password   string
	client     *http.Client
	ctx        context.Context
	cancel     context.CancelFunc
	lastPollTS int64
	mu         sync.Mutex
}

// New creates a new BlueBubbles channel.
func New(cfg *config.Config, msgBus *bus.MessageBus) (*BlueBubblesChannel, error) {
	serverURL := strings.TrimRight(cfg.Channels.BlueBubbles.ServerURL, "/")
	if serverURL == "" {
		return nil, fmt.Errorf("bluebubbles: server_url is required")
	}
	password := cfg.Channels.BlueBubbles.Password
	if password == "" {
		return nil, fmt.Errorf("bluebubbles: password is required")
	}

	ch := &BlueBubblesChannel{
		BaseChannel: channels.NewBaseChannel("bluebubbles", msgBus, cfg.Channels.BlueBubbles.AllowFrom),
		cfg:         cfg,
		serverURL:   serverURL,
		password:    password,
		client:      &http.Client{Timeout: 30 * time.Second},
		lastPollTS:  time.Now().Add(-5 * time.Minute).UnixMilli(),
	}
	return ch, nil
}

// Start begins polling for new iMessages.
func (ch *BlueBubblesChannel) Start(ctx context.Context) error {
	ch.ctx, ch.cancel = context.WithCancel(ctx)
	ch.SetRunning(true)
	go ch.pollLoop()
	log.Printf("[BLUEBUBBLES] 🫧 Channel started — polling %s", ch.serverURL)
	return nil
}

// Stop halts the polling loop.
func (ch *BlueBubblesChannel) Stop(_ context.Context) error {
	if ch.cancel != nil {
		ch.cancel()
	}
	ch.SetRunning(false)
	log.Printf("[BLUEBUBBLES] 🫧 Channel stopped")
	return nil
}

// Send dispatches an outbound message through the BlueBubbles API.
func (ch *BlueBubblesChannel) Send(ctx context.Context, msg bus.OutboundMessage) error {
	if msg.ChatID == "" {
		return fmt.Errorf("bluebubbles: target (chat_guid or phone) is required")
	}
	return ch.sendMessage(ctx, msg.ChatID, msg.Content)
}

// ── API helpers ─────────────────────────────────────────────────────

func (ch *BlueBubblesChannel) apiURL(path string) string {
	return fmt.Sprintf("%s/api/v1%s?password=%s", ch.serverURL, path, ch.password)
}

// sendMessage sends a text message to the given chat GUID or address.
func (ch *BlueBubblesChannel) sendMessage(_ context.Context, target, text string) error {
	body := map[string]any{
		"chatGuid":        target,
		"message":         text,
		"method":          "private-api",
		"tempGuid":        fmt.Sprintf("solanaos-%d", time.Now().UnixNano()),
	}

	// If target looks like a phone number, use the create-chat flow
	if !strings.HasPrefix(target, "iMessage;") && !strings.HasPrefix(target, "SMS;") {
		body = map[string]any{
			"participants": []string{target},
			"message":      text,
			"method":       "private-api",
			"tempGuid":     fmt.Sprintf("solanaos-%d", time.Now().UnixNano()),
		}
		return ch.post("/message/text", body)
	}

	return ch.post("/message/text", body)
}

// SendReaction sends a tapback reaction.
func (ch *BlueBubblesChannel) SendReaction(_ context.Context, target, messageGUID, emoji string) error {
	body := map[string]any{
		"chatGuid":   target,
		"selectedMessageGuid": messageGUID,
		"reaction":   emoji,
	}
	return ch.post("/message/react", body)
}

func (ch *BlueBubblesChannel) post(path string, body map[string]any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("bluebubbles: marshal error: %w", err)
	}
	req, err := http.NewRequestWithContext(ch.ctx, http.MethodPost, ch.apiURL(path), bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("bluebubbles: request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := ch.client.Do(req)
	if err != nil {
		return fmt.Errorf("bluebubbles: send error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bluebubbles: API %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// ── Poll loop ───────────────────────────────────────────────────────

type bbMessage struct {
	GUID          string `json:"guid"`
	Text          string `json:"text"`
	IsFromMe      bool   `json:"isFromMe"`
	DateCreated   int64  `json:"dateCreated"`
	Handle        *struct {
		Address string `json:"address"`
	} `json:"handle"`
	Chats []struct {
		GUID string `json:"guid"`
	} `json:"chats"`
}

type bbMessagesResponse struct {
	Status   int         `json:"status"`
	Message  string      `json:"message"`
	Data     []bbMessage `json:"data"`
}

func (ch *BlueBubblesChannel) pollLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ch.ctx.Done():
			return
		case <-ticker.C:
			ch.poll()
		}
	}
}

func (ch *BlueBubblesChannel) poll() {
	ch.mu.Lock()
	since := ch.lastPollTS
	ch.mu.Unlock()

	url := fmt.Sprintf("%s&after=%d&limit=50&sort=desc&with=handle,chats",
		ch.apiURL("/message"), since)

	req, err := http.NewRequestWithContext(ch.ctx, http.MethodGet, url, nil)
	if err != nil {
		return
	}

	resp, err := ch.client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return
	}

	var result bbMessagesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return
	}

	var maxTS int64
	for i := len(result.Data) - 1; i >= 0; i-- {
		msg := result.Data[i]
		if msg.IsFromMe || msg.Text == "" {
			continue
		}

		senderID := ""
		if msg.Handle != nil {
			senderID = msg.Handle.Address
		}

		chatID := ""
		if len(msg.Chats) > 0 {
			chatID = msg.Chats[0].GUID
		}
		if chatID == "" {
			chatID = senderID
		}

		ch.HandleMessage(ch.ctx, senderID, chatID, msg.Text, nil)

		if msg.DateCreated > maxTS {
			maxTS = msg.DateCreated
		}
	}

	if maxTS > 0 {
		ch.mu.Lock()
		ch.lastPollTS = maxTS + 1
		ch.mu.Unlock()
	}
}
