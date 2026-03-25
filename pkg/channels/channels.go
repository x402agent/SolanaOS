// Package channels provides the multi-channel gateway for MawdBot.
// Adapted from PicoClaw — supports Discord, Telegram, WebSocket, CLI.
package channels

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/autoreply"
	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/logger"
	"github.com/x402agent/Solana-Os-Go/pkg/routing"
)

var (
	uniqueIDCounter uint64
	uniqueIDPrefix  string
)

func init() {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		binary.BigEndian.PutUint64(b[:], uint64(time.Now().UnixNano()))
	}
	uniqueIDPrefix = hex.EncodeToString(b[:])
}

func uniqueID() string {
	n := atomic.AddUint64(&uniqueIDCounter, 1)
	return uniqueIDPrefix + strconv.FormatUint(n, 16)
}

// ── Channel Interface ────────────────────────────────────────────────

type Channel interface {
	Name() string
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	Send(ctx context.Context, msg bus.OutboundMessage) error
	IsRunning() bool
	IsAllowed(senderID string) bool
}

// ── BaseChannel ──────────────────────────────────────────────────────

type BaseChannel struct {
	name      string
	bus       *bus.MessageBus
	running   atomic.Bool
	allowList []string
}

func NewBaseChannel(name string, msgBus *bus.MessageBus, allowList []string) *BaseChannel {
	return &BaseChannel{
		name:      name,
		bus:       msgBus,
		allowList: allowList,
	}
}

func (c *BaseChannel) Name() string      { return c.name }
func (c *BaseChannel) IsRunning() bool   { return c.running.Load() }
func (c *BaseChannel) SetRunning(r bool) { c.running.Store(r) }

func (c *BaseChannel) IsAllowed(senderID string) bool {
	if len(c.allowList) == 0 {
		return true
	}
	for _, allowed := range c.allowList {
		if senderID == allowed || senderID == strings.TrimPrefix(allowed, "@") {
			return true
		}
	}
	return false
}

func (c *BaseChannel) HandleMessage(ctx context.Context, senderID, chatID, content string, media []string) {
	if !c.IsAllowed(senderID) {
		return
	}
	msg := bus.InboundMessage{
		Channel:  c.name,
		SenderID: senderID,
		ChatID:   chatID,
		Content:  content,
		Media:    media,
	}
	c.PublishInbound(ctx, msg)
}

func (c *BaseChannel) PublishInbound(ctx context.Context, msg bus.InboundMessage) {
	if strings.TrimSpace(msg.Channel) == "" {
		msg.Channel = c.name
	}
	if strings.TrimSpace(msg.Content) == "" {
		return
	}
	if strings.TrimSpace(msg.ChatID) == "" {
		msg.ChatID = strings.TrimSpace(msg.SenderID)
	}
	if strings.TrimSpace(msg.MediaScope) == "" {
		msg.MediaScope = msg.Channel + ":" + msg.ChatID + ":" + uniqueID()
	}
	if strings.TrimSpace(msg.SessionKey) == "" {
		msg.SessionKey = routing.BuildSessionKey("", msg.Channel, msg.ChatID)
	}
	msg.Content = autoreply.SanitizeInboundUserText(msg.Content)
	if strings.TrimSpace(msg.Content) == "" {
		return
	}
	if err := c.bus.PublishInbound(ctx, msg); err != nil {
		logger.ErrorCF("channels", "Failed to publish inbound", map[string]any{
			"channel": c.name,
			"error":   err.Error(),
		})
	}
}

// ── Manager ──────────────────────────────────────────────────────────

type Manager struct {
	mu       sync.RWMutex
	channels map[string]Channel
	bus      *bus.MessageBus
}

func NewManager(msgBus *bus.MessageBus) *Manager {
	return &Manager{
		channels: make(map[string]Channel),
		bus:      msgBus,
	}
}

func (m *Manager) Register(ch Channel) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.channels[ch.Name()] = ch
}

func (m *Manager) Get(name string) (Channel, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ch, ok := m.channels[name]
	return ch, ok
}

func (m *Manager) StartAll(ctx context.Context) error {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for name, ch := range m.channels {
		if err := ch.Start(ctx); err != nil {
			logger.ErrorCF("channels", "Failed to start channel", map[string]any{
				"channel": name,
				"error":   err.Error(),
			})
		} else {
			logger.InfoCF("channels", "Channel started", map[string]any{"channel": name})
		}
	}
	return nil
}

func (m *Manager) StopAll(ctx context.Context) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for name, ch := range m.channels {
		if err := ch.Stop(ctx); err != nil {
			logger.ErrorCF("channels", "Failed to stop channel", map[string]any{
				"channel": name,
				"error":   err.Error(),
			})
		}
	}
}

// DispatchOutbound sends an outbound message to the correct channel.
func (m *Manager) DispatchOutbound(ctx context.Context, msg bus.OutboundMessage) error {
	m.mu.RLock()
	ch, ok := m.channels[msg.Channel]
	m.mu.RUnlock()
	if !ok {
		return nil
	}
	return ch.Send(ctx, msg)
}

func (m *Manager) List() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	names := make([]string, 0, len(m.channels))
	for name := range m.channels {
		names = append(names, name)
	}
	return names
}
