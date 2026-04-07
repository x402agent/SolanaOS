package solana

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const defaultBirdeyeWSSURL = "wss://public-api.birdeye.so/socket"

// BirdeyeWSSubscription is the payload sent after opening the websocket.
// Example:
//
//	{"type":"SUBSCRIBE_NEW_PAIR"}
//	{"type":"SUBSCRIBE_PRICE","data":{"queryType":"simple","address":"...","currency":"pair"}}
type BirdeyeWSSubscription struct {
	Type string         `json:"type"`
	Data map[string]any `json:"data,omitempty"`
}

// BirdeyeWSEvent is a normalized incoming websocket frame.
type BirdeyeWSEvent struct {
	Type       string          `json:"type"`
	Data       json.RawMessage `json:"data,omitempty"`
	Raw        json.RawMessage `json:"raw,omitempty"`
	ReceivedAt time.Time       `json:"received_at"`
}

// BirdeyeWSClient manages short-lived websocket subscriptions.
// Use SubscribeAndCollect for one-shot collection workflows.
type BirdeyeWSClient struct {
	apiKey  string
	baseURL string
	dialer  *websocket.Dialer
}

func NewBirdeyeWSClient(apiKey, wssURL string) *BirdeyeWSClient {
	if strings.TrimSpace(wssURL) == "" {
		wssURL = defaultBirdeyeWSSURL
	}
	return &BirdeyeWSClient{
		apiKey:  strings.TrimSpace(apiKey),
		baseURL: strings.TrimSpace(wssURL),
		dialer:  websocket.DefaultDialer,
	}
}

// ResolveBirdeyeWSSURL normalizes a Birdeye websocket endpoint with chain + API key.
// Supports raw formats such as:
//   - wss://public-api.birdeye.so/socket
//   - wss://public-api.birdeye.so/socket/solana
//   - wss://public-api.birdeye.so/socket/{chain}
//   - wss://public-api.birdeye.so/socket/%s
func ResolveBirdeyeWSSURL(rawURL, chain, apiKey string) (string, error) {
	resolvedChain := strings.TrimSpace(chain)
	if resolvedChain == "" {
		resolvedChain = "solana"
	}

	raw := strings.TrimSpace(rawURL)
	if raw == "" {
		raw = defaultBirdeyeWSSURL
	}

	raw = strings.ReplaceAll(raw, "{chain}", resolvedChain)
	sCount := strings.Count(raw, "%s")
	if sCount == 1 {
		raw = fmt.Sprintf(raw, resolvedChain)
	} else if sCount >= 2 {
		raw = fmt.Sprintf(raw, resolvedChain, apiKey)
		apiKey = ""
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("parse BIRDEYE_WSS_URL: %w", err)
	}

	if parsed.Scheme == "" {
		parsed, err = url.Parse("wss://" + strings.TrimPrefix(raw, "//"))
		if err != nil {
			return "", fmt.Errorf("parse BIRDEYE_WSS_URL with wss scheme: %w", err)
		}
	}

	if parsed.Scheme != "wss" && parsed.Scheme != "ws" {
		return "", fmt.Errorf("invalid websocket scheme %q", parsed.Scheme)
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return "", fmt.Errorf("missing websocket host in BIRDEYE_WSS_URL")
	}

	pathLower := strings.ToLower(parsed.Path)
	chainLower := "/" + strings.ToLower(resolvedChain)
	if !strings.Contains(pathLower, chainLower) {
		trimmed := strings.TrimRight(parsed.Path, "/")
		switch {
		case trimmed == "":
			parsed.Path = "/socket/" + resolvedChain
		case strings.HasSuffix(strings.ToLower(trimmed), "/socket"):
			parsed.Path = trimmed + "/" + resolvedChain
		default:
			parsed.Path = trimmed
		}
	}

	q := parsed.Query()
	if strings.TrimSpace(apiKey) != "" && q.Get("x-api-key") == "" && q.Get("api_key") == "" {
		q.Set("x-api-key", strings.TrimSpace(apiKey))
	}
	parsed.RawQuery = q.Encode()

	return parsed.String(), nil
}

// SubscribeAndCollect opens the websocket, sends one subscription message, and
// collects frames until context cancellation/timeout or maxEvents is reached.
func (c *BirdeyeWSClient) SubscribeAndCollect(ctx context.Context, chain string, sub BirdeyeWSSubscription, maxEvents int, filterTypes ...string) ([]BirdeyeWSEvent, error) {
	if strings.TrimSpace(sub.Type) == "" {
		return nil, fmt.Errorf("subscription type is required")
	}

	resolvedURL, err := ResolveBirdeyeWSSURL(c.baseURL, chain, c.apiKey)
	if err != nil {
		return nil, err
	}

	headers := birdeyeWSHeaders(resolvedURL)
	conn, _, err := c.dialer.DialContext(ctx, resolvedURL, headers)
	if err != nil {
		return nil, fmt.Errorf("birdeye websocket dial: %w", err)
	}
	defer conn.Close()

	conn.SetPingHandler(func(appData string) error {
		deadline := time.Now().Add(5 * time.Second)
		return conn.WriteControl(websocket.PongMessage, []byte(appData), deadline)
	})

	if err := conn.WriteJSON(sub); err != nil {
		return nil, fmt.Errorf("birdeye websocket subscribe: %w", err)
	}

	filters := make(map[string]struct{}, len(filterTypes))
	for _, filter := range filterTypes {
		if trimmed := strings.ToUpper(strings.TrimSpace(filter)); trimmed != "" {
			filters[trimmed] = struct{}{}
		}
	}

	capacity := 4
	if maxEvents > capacity {
		capacity = maxEvents
	}
	events := make([]BirdeyeWSEvent, 0, capacity)
	for {
		if maxEvents > 0 && len(events) >= maxEvents {
			return events, nil
		}
		if ctx.Err() != nil {
			return events, nil
		}

		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, payload, readErr := conn.ReadMessage()
		if readErr != nil {
			if ctx.Err() != nil {
				return events, nil
			}
			var netErr net.Error
			if errors.As(readErr, &netErr) && netErr.Timeout() {
				continue
			}
			if websocket.IsCloseError(readErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				return events, nil
			}
			return events, fmt.Errorf("birdeye websocket read: %w", readErr)
		}

		event := decodeBirdeyeWSEvent(payload)
		if len(filters) > 0 {
			if _, ok := filters[strings.ToUpper(strings.TrimSpace(event.Type))]; !ok {
				continue
			}
		}

		events = append(events, event)
	}
}

func birdeyeWSHeaders(resolvedURL string) http.Header {
	originHost := "public-api.birdeye.so"
	if parsed, err := url.Parse(resolvedURL); err == nil && strings.TrimSpace(parsed.Host) != "" {
		originHost = strings.TrimSpace(parsed.Host)
	}
	origin := "ws://" + originHost
	return http.Header{
		"Origin":                 []string{origin},
		"Sec-WebSocket-Origin":   []string{origin},
		"Sec-WebSocket-Protocol": []string{"echo-protocol"},
	}
}

func decodeBirdeyeWSEvent(payload []byte) BirdeyeWSEvent {
	message := struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}{}
	_ = json.Unmarshal(payload, &message)

	eventType := strings.TrimSpace(message.Type)
	if eventType == "" {
		fallbackType := "MESSAGE"
		var raw map[string]any
		if err := json.Unmarshal(payload, &raw); err == nil {
			switch {
			case raw["blockUnixTime"] != nil || raw["txHash"] != nil:
				fallbackType = "TXS_DATA"
			case raw["pairAddress"] != nil || raw["address"] != nil:
				fallbackType = "NEW_PAIR_DATA"
			}
		}
		eventType = fallbackType
	}

	data := message.Data
	if len(data) == 0 {
		data = json.RawMessage(payload)
	}

	rawCopy := make([]byte, len(payload))
	copy(rawCopy, payload)

	dataCopy := make([]byte, len(data))
	copy(dataCopy, data)

	return BirdeyeWSEvent{
		Type:       eventType,
		Data:       json.RawMessage(dataCopy),
		Raw:        json.RawMessage(rawCopy),
		ReceivedAt: time.Now().UTC(),
	}
}
