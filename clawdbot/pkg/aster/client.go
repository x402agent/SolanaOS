// Package aster :: client.go
// Base HTTP client with HMAC SHA256 signing for Aster DEX API.
//
// Auth flow:
//  1. Collect all params as query string (key=value&key=value)
//  2. HMAC SHA256 sign with secretKey
//  3. Append &signature=<hex> to params
//  4. Send with X-MBX-APIKEY header
package aster

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ── Base URLs ────────────────────────────────────────────────────────

const (
	SpotBaseURL       = "https://sapi.asterdex.com"
	FuturesBaseURL    = "https://fapi.asterdex.com"
	SpotWSBaseURL     = "wss://sstream.asterdex.com"
	FuturesWSBaseURL  = "wss://fstream.asterdex.com"
	DefaultRecvWindow = 5000
)

// ── Client ───────────────────────────────────────────────────────────

type Client struct {
	apiKey     string
	secretKey  string
	spotBase   string
	futBase    string
	recvWindow int64
	httpClient *http.Client
}

type ClientConfig struct {
	APIKey     string
	SecretKey  string
	SpotBase   string // override for testing
	FutBase    string // override for testing
	RecvWindow int64
	Timeout    time.Duration
}

func NewClient(cfg ClientConfig) *Client {
	spotBase := cfg.SpotBase
	if spotBase == "" {
		spotBase = SpotBaseURL
	}
	futBase := cfg.FutBase
	if futBase == "" {
		futBase = FuturesBaseURL
	}
	recvWindow := cfg.RecvWindow
	if recvWindow == 0 {
		recvWindow = DefaultRecvWindow
	}
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &Client{
		apiKey:     cfg.APIKey,
		secretKey:  cfg.SecretKey,
		spotBase:   spotBase,
		futBase:    futBase,
		recvWindow: recvWindow,
		httpClient: &http.Client{Timeout: timeout},
	}
}

// ── HMAC Signature ───────────────────────────────────────────────────

func (c *Client) sign(params url.Values) string {
	// Sort keys for deterministic ordering
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		parts = append(parts, k+"="+params.Get(k))
	}
	totalParams := strings.Join(parts, "&")

	mac := hmac.New(sha256.New, []byte(c.secretKey))
	mac.Write([]byte(totalParams))
	return hex.EncodeToString(mac.Sum(nil))
}

// addTimestamp adds timestamp + recvWindow + signature to params.
func (c *Client) addTimestamp(params url.Values) {
	params.Set("timestamp", strconv.FormatInt(time.Now().UnixMilli(), 10))
	params.Set("recvWindow", strconv.FormatInt(c.recvWindow, 10))
	params.Set("signature", c.sign(params))
}

// ── HTTP Methods ─────────────────────────────────────────────────────

// doPublic sends an unauthenticated request.
func (c *Client) doPublic(method, base, path string, params url.Values) ([]byte, error) {
	reqURL := base + path
	if len(params) > 0 {
		reqURL += "?" + params.Encode()
	}

	req, err := http.NewRequest(method, reqURL, nil)
	if err != nil {
		return nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("X-MBX-APIKEY", c.apiKey)
	}

	return c.doRequest(req)
}

// doSigned sends an authenticated (SIGNED) request.
func (c *Client) doSigned(method, base, path string, params url.Values) ([]byte, error) {
	c.addTimestamp(params)

	var req *http.Request
	var err error

	if method == http.MethodGet || method == http.MethodDelete {
		reqURL := base + path + "?" + params.Encode()
		req, err = http.NewRequest(method, reqURL, nil)
	} else {
		reqURL := base + path
		body := params.Encode()
		req, err = http.NewRequest(method, reqURL, strings.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
	}
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-MBX-APIKEY", c.apiKey)
	return c.doRequest(req)
}

func (c *Client) doRequest(req *http.Request) ([]byte, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("aster http: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Check for API error
	if resp.StatusCode >= 400 {
		var apiErr APIError
		if json.Unmarshal(body, &apiErr) == nil && apiErr.Code != 0 {
			return nil, fmt.Errorf("aster %d [%d]: %s", resp.StatusCode, apiErr.Code, apiErr.Msg)
		}
		maxLen := len(body)
		if maxLen > 300 {
			maxLen = 300
		}
		return nil, fmt.Errorf("aster HTTP %d: %s", resp.StatusCode, string(body[:maxLen]))
	}

	return body, nil
}

// ── Convenience: Public GET ──────────────────────────────────────────

func (c *Client) spotGet(path string, params url.Values) ([]byte, error) {
	return c.doPublic(http.MethodGet, c.spotBase, path, params)
}

func (c *Client) futGet(path string, params url.Values) ([]byte, error) {
	return c.doPublic(http.MethodGet, c.futBase, path, params)
}

// ── Convenience: Signed ──────────────────────────────────────────────

func (c *Client) spotSignedGet(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodGet, c.spotBase, path, params)
}

func (c *Client) spotSignedPost(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodPost, c.spotBase, path, params)
}

func (c *Client) spotSignedDelete(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodDelete, c.spotBase, path, params)
}

func (c *Client) futSignedGet(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodGet, c.futBase, path, params)
}

func (c *Client) futSignedPost(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodPost, c.futBase, path, params)
}

func (c *Client) futSignedDelete(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodDelete, c.futBase, path, params)
}
