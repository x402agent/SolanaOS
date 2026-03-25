// Package bus provides the message bus for MawdBot inter-component communication.
// Adapted from PicoClaw's bus package — channels publish inbound, agent consumes.
package bus

import (
	"context"
	"errors"
	"sync/atomic"

	"log"
)

var ErrBusClosed = errors.New("message bus closed")

const defaultBufSize = 64

// ── Message Types ────────────────────────────────────────────────────

type SenderInfo struct {
	CanonicalID string `json:"canonical_id"`
	PlatformID  string `json:"platform_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

type Peer struct {
	Kind string `json:"kind"` // "user", "group", "channel"
	ID   string `json:"id"`
	Name string `json:"name"`
}

type InboundMessage struct {
	Channel    string            `json:"channel"`
	SenderID   string            `json:"sender_id"`
	Sender     SenderInfo        `json:"sender"`
	ChatID     string            `json:"chat_id"`
	Content    string            `json:"content"`
	Media      []string          `json:"media"`
	Peer       Peer              `json:"peer"`
	MessageID  string            `json:"message_id"`
	MediaScope string            `json:"media_scope"`
	SessionKey string            `json:"session_key"`
	Metadata   map[string]string `json:"metadata"`
}

type OutboundMessage struct {
	Channel string `json:"channel"`
	ChatID  string `json:"chat_id"`
	Content string `json:"content"`
}

type OutboundMediaMessage struct {
	Channel     string `json:"channel"`
	ChatID      string `json:"chat_id"`
	FilePath    string `json:"file_path"`
	ContentType string `json:"content_type"`
	Caption     string `json:"caption"`
}

// ── MessageBus ───────────────────────────────────────────────────────

type MessageBus struct {
	inbound       chan InboundMessage
	outbound      chan OutboundMessage
	outboundMedia chan OutboundMediaMessage
	done          chan struct{}
	closed        atomic.Bool
}

func NewMessageBus() *MessageBus {
	return &MessageBus{
		inbound:       make(chan InboundMessage, defaultBufSize),
		outbound:      make(chan OutboundMessage, defaultBufSize),
		outboundMedia: make(chan OutboundMediaMessage, defaultBufSize),
		done:          make(chan struct{}),
	}
}

func (mb *MessageBus) PublishInbound(ctx context.Context, msg InboundMessage) error {
	if mb.closed.Load() {
		return ErrBusClosed
	}
	select {
	case mb.inbound <- msg:
		return nil
	case <-mb.done:
		return ErrBusClosed
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (mb *MessageBus) ConsumeInbound(ctx context.Context) (InboundMessage, bool) {
	select {
	case msg, ok := <-mb.inbound:
		return msg, ok
	case <-mb.done:
		return InboundMessage{}, false
	case <-ctx.Done():
		return InboundMessage{}, false
	}
}

func (mb *MessageBus) PublishOutbound(ctx context.Context, msg OutboundMessage) error {
	if mb.closed.Load() {
		return ErrBusClosed
	}
	select {
	case mb.outbound <- msg:
		return nil
	case <-mb.done:
		return ErrBusClosed
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (mb *MessageBus) SubscribeOutbound(ctx context.Context) (OutboundMessage, bool) {
	select {
	case msg, ok := <-mb.outbound:
		return msg, ok
	case <-mb.done:
		return OutboundMessage{}, false
	case <-ctx.Done():
		return OutboundMessage{}, false
	}
}

func (mb *MessageBus) PublishOutboundMedia(ctx context.Context, msg OutboundMediaMessage) error {
	if mb.closed.Load() {
		return ErrBusClosed
	}
	select {
	case mb.outboundMedia <- msg:
		return nil
	case <-mb.done:
		return ErrBusClosed
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (mb *MessageBus) SubscribeOutboundMedia(ctx context.Context) (OutboundMediaMessage, bool) {
	select {
	case msg, ok := <-mb.outboundMedia:
		return msg, ok
	case <-mb.done:
		return OutboundMediaMessage{}, false
	case <-ctx.Done():
		return OutboundMediaMessage{}, false
	}
}

func (mb *MessageBus) Close() {
	if mb.closed.CompareAndSwap(false, true) {
		close(mb.done)
		drained := 0
		for {
			select {
			case <-mb.inbound:
				drained++
			default:
				goto doneIn
			}
		}
	doneIn:
		for {
			select {
			case <-mb.outbound:
				drained++
			default:
				goto doneOut
			}
		}
	doneOut:
		for {
			select {
			case <-mb.outboundMedia:
				drained++
			default:
				goto doneMedia
			}
		}
	doneMedia:
		if drained > 0 {
			log.Printf("[bus] Drained %d messages during close", drained)
		}
	}
}
