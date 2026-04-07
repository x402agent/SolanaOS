// Package voice provides Twilio voice call integration for SolanaOS.
// Supports outbound calls with Mistral TTS for spoken content.
package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const twilioAPIBase = "https://api.twilio.com/2010-04-01"

// TwilioClient manages voice calls via Twilio.
type TwilioClient struct {
	accountSID  string
	authToken   string
	apiSID      string
	apiSecret   string
	fromNumber  string
	twimlBinURL string
	http        *http.Client
}

// CallStatus represents the state of a Twilio call.
type CallStatus struct {
	SID        string `json:"sid"`
	Status     string `json:"status"`
	From       string `json:"from"`
	To         string `json:"to"`
	Duration   string `json:"duration"`
	StartTime  string `json:"start_time"`
	Direction  string `json:"direction"`
}

// NewTwilioClient creates a client from environment variables.
func NewTwilioClient() *TwilioClient {
	sid := strings.TrimSpace(os.Getenv("TWILIO_ACCOUNT_SID"))
	token := strings.TrimSpace(os.Getenv("TWILIO_AUTH_TOKEN"))
	from := strings.TrimSpace(os.Getenv("TWILIO_PHONE_NUMBER"))
	if sid == "" || token == "" || from == "" {
		return nil
	}

	log.Printf("[VOICE] 📞 Twilio voice client initialized (from: %s)", from)
	return &TwilioClient{
		accountSID:  sid,
		authToken:   token,
		apiSID:      strings.TrimSpace(os.Getenv("TWILIO_API_SID")),
		apiSecret:   strings.TrimSpace(os.Getenv("TWILIO_API_SECRET")),
		fromNumber:  from,
		twimlBinURL: strings.TrimSpace(os.Getenv("TWIML_BIN_URL")),
		http:        &http.Client{Timeout: 30 * time.Second},
	}
}

// IsConfigured returns true if Twilio credentials are set.
func (c *TwilioClient) IsConfigured() bool {
	return c != nil && c.accountSID != "" && c.authToken != "" && c.fromNumber != ""
}

// Call initiates an outbound voice call.
// message is spoken via TwiML <Say> or a TwiML Bin.
func (c *TwilioClient) Call(ctx context.Context, to, message string) (*CallStatus, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("twilio not configured")
	}

	to = normalizePhone(to)
	if to == "" {
		return nil, fmt.Errorf("invalid phone number")
	}

	// Build TwiML inline or use TwiML Bin
	twiml := fmt.Sprintf(`<Response><Say voice="Polly.Matthew">%s</Say></Response>`, escapeXML(message))

	form := url.Values{}
	form.Set("To", to)
	form.Set("From", c.fromNumber)
	form.Set("Twiml", twiml)
	form.Set("Timeout", "30")

	endpoint := fmt.Sprintf("%s/Accounts/%s/Calls.json", twilioAPIBase, c.accountSID)

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.accountSID, c.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("twilio call: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("twilio %d: %s", resp.StatusCode, truncVoice(string(body), 200))
	}

	var result CallStatus
	json.Unmarshal(body, &result)
	return &result, nil
}

// CallWithAudio initiates a call that plays an audio file URL.
func (c *TwilioClient) CallWithAudio(ctx context.Context, to, audioURL string) (*CallStatus, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("twilio not configured")
	}

	to = normalizePhone(to)
	twiml := fmt.Sprintf(`<Response><Play>%s</Play></Response>`, escapeXML(audioURL))

	form := url.Values{}
	form.Set("To", to)
	form.Set("From", c.fromNumber)
	form.Set("Twiml", twiml)

	endpoint := fmt.Sprintf("%s/Accounts/%s/Calls.json", twilioAPIBase, c.accountSID)
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.accountSID, c.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("twilio call: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("twilio %d: %s", resp.StatusCode, truncVoice(string(body), 200))
	}

	var result CallStatus
	json.Unmarshal(body, &result)
	return &result, nil
}

// GetCallStatus retrieves the current status of a call.
func (c *TwilioClient) GetCallStatus(ctx context.Context, callSID string) (*CallStatus, error) {
	endpoint := fmt.Sprintf("%s/Accounts/%s/Calls/%s.json", twilioAPIBase, c.accountSID, callSID)
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.accountSID, c.authToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result CallStatus
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func normalizePhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return ""
	}
	// Strip everything except digits and leading +
	if !strings.HasPrefix(phone, "+") {
		phone = "+" + phone
	}
	if !strings.HasPrefix(phone, "+1") && len(phone) == 11 {
		phone = "+1" + phone[1:]
	}
	return phone
}

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func truncVoice(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
