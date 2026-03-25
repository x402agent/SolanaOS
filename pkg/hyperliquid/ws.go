package hyperliquid

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const (
	hlPingInterval   = 45 * time.Second
	hlReconnectDelay = 3 * time.Second
)

type StreamConfig struct {
	Symbols        []string
	MarkTriggerBps float64
}

type StreamHandlers struct {
	OnReady        func()
	OnError        func(error)
	OnOrderUpdates func([]WSOrderUpdate)
	OnFills        func([]WSFill)
	OnMarks        func([]WSMark)
	OnMarkTrigger  func(WSMark)
}

type StreamStats struct {
	Connected    bool
	LastEventAt  time.Time
	LastError    string
	LastMarks    map[string]float64
	FillEvents   uint64
	OrderEvents  uint64
	MarkEvents   uint64
	TriggerCount uint64
}

type WSOrderUpdate struct {
	Coin            string
	Side            string
	Status          string
	LimitPx         string
	Sz              string
	Oid             int64
	Timestamp       int64
	StatusTimestamp int64
	Cloid           string
}

type WSFill struct {
	Coin      string
	Side      string
	Price     string
	Size      string
	Time      int64
	Oid       int64
	Fee       string
	ClosedPnl string
	Hash      string
}

type WSMark struct {
	Coin         string
	MarkPx       float64
	MidPx        float64
	OraclePx     float64
	Funding      float64
	OpenInterest float64
	MoveBps      float64
	Time         time.Time
}

type Stream struct {
	client    *Client
	config    StreamConfig
	handlers  StreamHandlers
	dialer    *websocket.Dialer
	done      chan struct{}
	closeOnce sync.Once

	mu         sync.RWMutex
	conn       *websocket.Conn
	connected  bool
	lastEvent  time.Time
	lastError  string
	lastMarks  map[string]float64
	symbols    map[string]struct{}
	fillCount  atomic.Uint64
	orderCount atomic.Uint64
	markCount  atomic.Uint64
	triggers   atomic.Uint64
}

func NewStream(client *Client, cfg StreamConfig, handlers StreamHandlers) *Stream {
	symbols := make(map[string]struct{})
	for _, symbol := range cfg.Symbols {
		symbol = strings.ToUpper(strings.TrimSpace(symbol))
		if symbol != "" {
			symbols[symbol] = struct{}{}
		}
	}
	return &Stream{
		client:    client,
		config:    cfg,
		handlers:  handlers,
		dialer:    websocket.DefaultDialer,
		done:      make(chan struct{}),
		lastMarks: make(map[string]float64),
		symbols:   symbols,
	}
}

func (s *Stream) Start(ctx context.Context) error {
	if s.client == nil {
		return fmt.Errorf("hyperliquid stream: nil client")
	}
	if len(s.symbols) == 0 {
		return fmt.Errorf("hyperliquid stream: no symbols configured")
	}
	if err := s.connect(ctx); err != nil {
		return err
	}
	go s.readLoop(ctx)
	go s.pingLoop(ctx)
	return nil
}

func (s *Stream) Close() error {
	var err error
	s.closeOnce.Do(func() {
		close(s.done)
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.conn != nil {
			err = s.conn.Close()
			s.conn = nil
		}
		s.connected = false
	})
	return err
}

func (s *Stream) Stats() StreamStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	marks := make(map[string]float64, len(s.lastMarks))
	for k, v := range s.lastMarks {
		marks[k] = v
	}
	return StreamStats{
		Connected:    s.connected,
		LastEventAt:  s.lastEvent,
		LastError:    s.lastError,
		LastMarks:    marks,
		FillEvents:   s.fillCount.Load(),
		OrderEvents:  s.orderCount.Load(),
		MarkEvents:   s.markCount.Load(),
		TriggerCount: s.triggers.Load(),
	}
}

func (s *Stream) connect(ctx context.Context) error {
	wsURL, err := streamURLFromBase(s.client.BaseURL())
	if err != nil {
		return err
	}
	conn, _, err := s.dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("hyperliquid websocket dial: %w", err)
	}

	s.mu.Lock()
	s.conn = conn
	s.connected = true
	s.lastError = ""
	s.mu.Unlock()

	if err := s.subscribeAll(); err != nil {
		_ = conn.Close()
		s.mu.Lock()
		s.conn = nil
		s.connected = false
		s.lastError = err.Error()
		s.mu.Unlock()
		return err
	}

	if s.handlers.OnReady != nil {
		s.handlers.OnReady()
	}
	return nil
}

func (s *Stream) readLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.done:
			return
		default:
		}

		conn := s.currentConn()
		if conn == nil {
			if err := s.reconnect(ctx); err != nil {
				return
			}
			continue
		}

		if err := conn.SetReadDeadline(time.Now().Add(90 * time.Second)); err != nil {
			s.reportErr(err)
		}
		_, raw, err := conn.ReadMessage()
		if err != nil {
			s.reportErr(err)
			if err := s.reconnect(ctx); err != nil {
				return
			}
			continue
		}
		s.touchEvent()
		s.handleMessage(raw)
	}
}

func (s *Stream) pingLoop(ctx context.Context) {
	ticker := time.NewTicker(hlPingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.done:
			return
		case <-ticker.C:
			if err := s.writeJSON(map[string]any{"method": "ping"}); err != nil {
				s.reportErr(err)
				if err := s.reconnect(ctx); err != nil {
					return
				}
			}
		}
	}
}

func (s *Stream) reconnect(ctx context.Context) error {
	s.mu.Lock()
	if s.conn != nil {
		_ = s.conn.Close()
		s.conn = nil
	}
	s.connected = false
	s.mu.Unlock()

	timer := time.NewTimer(hlReconnectDelay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-s.done:
		return nil
	case <-timer.C:
	}
	return s.connect(ctx)
}

func (s *Stream) subscribeAll() error {
	if err := s.writeJSON(map[string]any{
		"method":       "subscribe",
		"subscription": map[string]any{"type": "orderUpdates", "user": s.client.Wallet()},
	}); err != nil {
		return err
	}
	if err := s.writeJSON(map[string]any{
		"method":       "subscribe",
		"subscription": map[string]any{"type": "userFills", "user": s.client.Wallet()},
	}); err != nil {
		return err
	}
	for symbol := range s.symbols {
		if err := s.writeJSON(map[string]any{
			"method": "subscribe",
			"subscription": map[string]any{
				"type": "activeAssetCtx",
				"coin": symbol,
			},
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Stream) currentConn() *websocket.Conn {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.conn
}

func (s *Stream) writeJSON(v any) error {
	s.mu.RLock()
	conn := s.conn
	s.mu.RUnlock()
	if conn == nil {
		return fmt.Errorf("hyperliquid websocket not connected")
	}
	return conn.WriteJSON(v)
}

func (s *Stream) handleMessage(raw []byte) {
	var envelope struct {
		Channel string          `json:"channel"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		s.reportErr(fmt.Errorf("hyperliquid websocket decode: %w", err))
		return
	}

	switch envelope.Channel {
	case "subscriptionResponse", "pong":
		return
	case "orderUpdates":
		s.handleOrderUpdates(envelope.Data)
	case "userFills":
		s.handleFills(envelope.Data)
	case "activeAssetCtx":
		s.handleActiveAsset(envelope.Data)
	}
}

func (s *Stream) handleOrderUpdates(raw json.RawMessage) {
	var payload []struct {
		Order struct {
			Coin      string  `json:"coin"`
			Side      string  `json:"side"`
			LimitPx   string  `json:"limitPx"`
			Sz        string  `json:"sz"`
			Oid       int64   `json:"oid"`
			Timestamp int64   `json:"timestamp"`
			Cloid     *string `json:"cloid"`
		} `json:"order"`
		Status          string `json:"status"`
		StatusTimestamp int64  `json:"statusTimestamp"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		s.reportErr(fmt.Errorf("hyperliquid order updates decode: %w", err))
		return
	}
	updates := make([]WSOrderUpdate, 0, len(payload))
	for _, item := range payload {
		update := WSOrderUpdate{
			Coin:            item.Order.Coin,
			Side:            item.Order.Side,
			Status:          item.Status,
			LimitPx:         item.Order.LimitPx,
			Sz:              item.Order.Sz,
			Oid:             item.Order.Oid,
			Timestamp:       item.Order.Timestamp,
			StatusTimestamp: item.StatusTimestamp,
		}
		if item.Order.Cloid != nil {
			update.Cloid = *item.Order.Cloid
		}
		updates = append(updates, update)
	}
	s.orderCount.Add(uint64(len(updates)))
	if s.handlers.OnOrderUpdates != nil && len(updates) > 0 {
		s.handlers.OnOrderUpdates(updates)
	}
}

func (s *Stream) handleFills(raw json.RawMessage) {
	var payload struct {
		IsSnapshot bool   `json:"isSnapshot"`
		User       string `json:"user"`
		Fills      []struct {
			Coin      string `json:"coin"`
			Px        string `json:"px"`
			Sz        string `json:"sz"`
			Side      string `json:"side"`
			Time      int64  `json:"time"`
			Oid       int64  `json:"oid"`
			Fee       string `json:"fee"`
			ClosedPnl string `json:"closedPnl"`
			Hash      string `json:"hash"`
		} `json:"fills"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		s.reportErr(fmt.Errorf("hyperliquid fills decode: %w", err))
		return
	}
	fills := make([]WSFill, 0, len(payload.Fills))
	for _, item := range payload.Fills {
		fills = append(fills, WSFill{
			Coin:      item.Coin,
			Side:      item.Side,
			Price:     item.Px,
			Size:      item.Sz,
			Time:      item.Time,
			Oid:       item.Oid,
			Fee:       item.Fee,
			ClosedPnl: item.ClosedPnl,
			Hash:      item.Hash,
		})
	}
	s.fillCount.Add(uint64(len(fills)))
	if s.handlers.OnFills != nil && len(fills) > 0 {
		s.handlers.OnFills(fills)
	}
}

func (s *Stream) handleActiveAsset(raw json.RawMessage) {
	var payload struct {
		Coin string `json:"coin"`
		Ctx  struct {
			MarkPx       float64 `json:"markPx,string"`
			MidPx        float64 `json:"midPx,string"`
			OraclePx     float64 `json:"oraclePx,string"`
			Funding      float64 `json:"funding,string"`
			OpenInterest float64 `json:"openInterest,string"`
		} `json:"ctx"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		s.reportErr(fmt.Errorf("hyperliquid active asset decode: %w", err))
		return
	}
	payload.Coin = strings.ToUpper(strings.TrimSpace(payload.Coin))
	moveBps := 0.0
	now := time.Now()

	s.mu.Lock()
	prev := s.lastMarks[payload.Coin]
	if prev > 0 && payload.Ctx.MarkPx > 0 {
		moveBps = math.Abs((payload.Ctx.MarkPx - prev) / prev * 10000)
	}
	s.lastMarks[payload.Coin] = payload.Ctx.MarkPx
	s.mu.Unlock()

	mark := WSMark{
		Coin:         payload.Coin,
		MarkPx:       payload.Ctx.MarkPx,
		MidPx:        payload.Ctx.MidPx,
		OraclePx:     payload.Ctx.OraclePx,
		Funding:      payload.Ctx.Funding,
		OpenInterest: payload.Ctx.OpenInterest,
		MoveBps:      moveBps,
		Time:         now,
	}
	s.markCount.Add(1)
	if s.handlers.OnMarks != nil {
		s.handlers.OnMarks([]WSMark{mark})
	}
	if moveBps >= s.config.MarkTriggerBps && s.handlers.OnMarkTrigger != nil {
		s.triggers.Add(1)
		s.handlers.OnMarkTrigger(mark)
	}
}

func (s *Stream) touchEvent() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastEvent = time.Now()
}

func (s *Stream) reportErr(err error) {
	if err == nil {
		return
	}
	s.mu.Lock()
	s.lastError = err.Error()
	s.mu.Unlock()
	if s.handlers.OnError != nil {
		s.handlers.OnError(err)
	}
}

func streamURLFromBase(base string) (string, error) {
	if strings.TrimSpace(base) == "" {
		base = MainnetAPIURL
	}
	u, err := url.Parse(base)
	if err != nil {
		return "", fmt.Errorf("hyperliquid websocket url: %w", err)
	}
	switch u.Scheme {
	case "https":
		u.Scheme = "wss"
	case "http":
		u.Scheme = "ws"
	case "wss", "ws":
	default:
		return "", fmt.Errorf("hyperliquid websocket url: unsupported scheme %q", u.Scheme)
	}
	u.Path = "/ws"
	u.RawQuery = ""
	return u.String(), nil
}

func parseWireFloat(in string) float64 {
	v, _ := strconv.ParseFloat(strings.TrimSpace(in), 64)
	return v
}
