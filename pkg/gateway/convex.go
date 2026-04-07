// Package gateway :: convex.go
// Pushes gateway events to Convex for the SolanaOS Hub to display.
package gateway

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

var convexSiteURL string

func init() {
	convexSiteURL = os.Getenv("CONVEX_SITE_URL")
	if convexSiteURL == "" {
		convexSiteURL = "https://artful-frog-940.convex.site"
	}
}

// ConvexEvent represents an event to push to the hub.
type ConvexEvent struct {
	Kind      string      `json:"kind"`
	Source    string      `json:"source"`
	AgentID   string      `json:"agentId,omitempty"`
	SessionID string      `json:"sessionId,omitempty"`
	NodeID    string      `json:"nodeId,omitempty"`
	Method    string      `json:"method,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

// PushConvexEvent sends an event to Convex in a fire-and-forget goroutine.
func PushConvexEvent(evt ConvexEvent) {
	if evt.Timestamp == 0 {
		evt.Timestamp = time.Now().UnixMilli()
	}
	if evt.Source == "" {
		evt.Source = "gateway"
	}

	go func() {
		body, err := json.Marshal(evt)
		if err != nil {
			return
		}

		url := convexSiteURL + "/solanaos/gateway/events"
		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[CONVEX] event push failed: %v", err)
			return
		}
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			log.Printf("[CONVEX] event push HTTP %d for kind=%s", resp.StatusCode, evt.Kind)
		}
	}()
}
