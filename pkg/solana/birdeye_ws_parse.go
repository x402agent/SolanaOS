package solana

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

// ParseBirdeyeEventMap extracts an event payload into a generic map.
// It first tries event.Data, then falls back to event.Raw.
func ParseBirdeyeEventMap(event BirdeyeWSEvent) map[string]any {
	out := map[string]any{}
	if len(event.Data) > 0 {
		if err := json.Unmarshal(event.Data, &out); err == nil && len(out) > 0 {
			return out
		}
	}
	if len(event.Raw) > 0 {
		_ = json.Unmarshal(event.Raw, &out)
	}
	return out
}

// BirdeyeMapString returns the first non-empty string from keys.
func BirdeyeMapString(data map[string]any, keys ...string) string {
	for _, key := range keys {
		v, ok := birdeyeLookup(data, key)
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case string:
			if trimmed := strings.TrimSpace(t); trimmed != "" {
				return trimmed
			}
		case json.Number:
			if trimmed := strings.TrimSpace(t.String()); trimmed != "" {
				return trimmed
			}
		case float64:
			return strconv.FormatFloat(t, 'f', -1, 64)
		case float32:
			return strconv.FormatFloat(float64(t), 'f', -1, 64)
		case int:
			return strconv.Itoa(t)
		case int64:
			return strconv.FormatInt(t, 10)
		case uint64:
			return strconv.FormatUint(t, 10)
		case bool:
			if t {
				return "true"
			}
			return "false"
		}
	}
	return ""
}

// BirdeyeMapFloat returns the first parseable float from keys.
func BirdeyeMapFloat(data map[string]any, keys ...string) float64 {
	for _, key := range keys {
		v, ok := birdeyeLookup(data, key)
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case float64:
			return t
		case float32:
			return float64(t)
		case int:
			return float64(t)
		case int64:
			return float64(t)
		case uint64:
			return float64(t)
		case json.Number:
			if f, err := t.Float64(); err == nil {
				return f
			}
		case string:
			if f, err := strconv.ParseFloat(strings.TrimSpace(t), 64); err == nil {
				return f
			}
		}
	}
	return 0
}

// BirdeyeMapInt64 returns the first parseable int64 from keys.
func BirdeyeMapInt64(data map[string]any, keys ...string) int64 {
	for _, key := range keys {
		v, ok := birdeyeLookup(data, key)
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case int64:
			return t
		case int:
			return int64(t)
		case uint64:
			return int64(t)
		case float64:
			return int64(t)
		case float32:
			return int64(t)
		case json.Number:
			if i, err := t.Int64(); err == nil {
				return i
			}
			if f, err := t.Float64(); err == nil {
				return int64(f)
			}
		case string:
			raw := strings.TrimSpace(t)
			if i, err := strconv.ParseInt(raw, 10, 64); err == nil {
				return i
			}
			if f, err := strconv.ParseFloat(raw, 64); err == nil {
				return int64(f)
			}
		}
	}
	return 0
}

// BirdeyeEventTimeUTC attempts to infer an event timestamp from common fields.
func BirdeyeEventTimeUTC(data map[string]any) time.Time {
	ts := BirdeyeMapInt64(data,
		"unixTime",
		"blockUnixTime",
		"timestamp",
		"createdAt",
		"time",
	)
	if ts <= 0 {
		return time.Time{}
	}
	if ts > 1_000_000_000_000 {
		return time.UnixMilli(ts).UTC()
	}
	return time.Unix(ts, 0).UTC()
}

func birdeyeLookup(data map[string]any, key string) (any, bool) {
	if data == nil {
		return nil, false
	}
	if !strings.Contains(key, ".") {
		v, ok := data[key]
		return v, ok
	}

	parts := strings.Split(key, ".")
	var current any = data
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		next, ok := m[part]
		if !ok {
			return nil, false
		}
		current = next
	}
	return current, true
}
