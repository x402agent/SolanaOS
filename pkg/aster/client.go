// Package aster :: client.go
// Base HTTP client with support for both legacy HMAC auth (V1)
// and EIP-712 signer auth (V3) for Aster DEX.
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
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common/hexutil"
	gethmath "github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

// ── Base URLs ────────────────────────────────────────────────────────

const (
	SpotBaseURL       = "https://sapi.asterdex.com"
	FuturesBaseURL    = "https://fapi.asterdex.com"
	SpotWSBaseURL     = "wss://sstream.asterdex.com"
	FuturesWSBaseURL  = "wss://fstream.asterdex.com"
	DefaultRecvWindow = 5000
	asterAPIChainID   = 1666
	zeroAddress       = "0x0000000000000000000000000000000000000000"
)

// ── Client ───────────────────────────────────────────────────────────

type Client struct {
	apiKey     string
	secretKey  string
	walletAddr string
	userAddr   string
	signerAddr string
	privateKey string
	useV3      bool
	spotBase   string
	futBase    string
	recvWindow int64
	httpClient *http.Client
	nonceMu    sync.Mutex
	lastNonce  int64
}

type ClientConfig struct {
	APIKey        string
	SecretKey     string
	WalletAddress string
	UserAddress   string
	SignerAddress string
	PrivateKey    string
	UseV3         bool
	SpotBase      string // override for testing
	FutBase       string // override for testing
	RecvWindow    int64
	Timeout       time.Duration
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

	userAddr := strings.TrimSpace(cfg.UserAddress)
	walletAddr := strings.TrimSpace(cfg.WalletAddress)
	signerAddr := strings.TrimSpace(cfg.SignerAddress)
	privateKey := strings.TrimSpace(cfg.PrivateKey)
	if userAddr == "" {
		userAddr = walletAddr
	}
	if signerAddr == "" && privateKey != "" {
		if key, err := crypto.HexToECDSA(strings.TrimPrefix(privateKey, "0x")); err == nil {
			signerAddr = crypto.PubkeyToAddress(key.PublicKey).Hex()
		}
	}

	return &Client{
		apiKey:     cfg.APIKey,
		secretKey:  cfg.SecretKey,
		walletAddr: walletAddr,
		userAddr:   userAddr,
		signerAddr: signerAddr,
		privateKey: privateKey,
		useV3:      cfg.UseV3 && userAddr != "" && signerAddr != "" && privateKey != "",
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

func (c *Client) usesV3Auth() bool {
	return c.useV3
}

func (c *Client) spotPath(v1, v3 string) string {
	if c.usesV3Auth() {
		return v3
	}
	return v1
}

func (c *Client) futPath(v1, v3 string) string {
	if c.usesV3Auth() {
		return v3
	}
	return v1
}

func (c *Client) nextNonceMicro() int64 {
	c.nonceMu.Lock()
	defer c.nonceMu.Unlock()

	now := time.Now().UnixMicro()
	if now <= c.lastNonce {
		now = c.lastNonce + 1
	}
	c.lastNonce = now
	return now
}

func (c *Client) signV3(query string) (string, error) {
	key, err := crypto.HexToECDSA(strings.TrimPrefix(c.privateKey, "0x"))
	if err != nil {
		return "", fmt.Errorf("parse aster signer private key: %w", err)
	}

	derivedSigner := crypto.PubkeyToAddress(key.PublicKey).Hex()
	if c.signerAddr != "" && !strings.EqualFold(derivedSigner, c.signerAddr) {
		return "", fmt.Errorf("aster signer/private key mismatch: signer=%s derived=%s", c.signerAddr, derivedSigner)
	}

	typedData := apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"Message": []apitypes.Type{
				{Name: "msg", Type: "string"},
			},
		},
		PrimaryType: "Message",
		Domain: apitypes.TypedDataDomain{
			Name:              "AsterSignTransaction",
			Version:           "1",
			ChainId:           gethmath.NewHexOrDecimal256(asterAPIChainID),
			VerifyingContract: zeroAddress,
		},
		Message: apitypes.TypedDataMessage{
			"msg": query,
		},
	}

	hash, _, err := apitypes.TypedDataAndHash(typedData)
	if err != nil {
		return "", fmt.Errorf("hash aster typed data: %w", err)
	}
	sig, err := crypto.Sign(hash, key)
	if err != nil {
		return "", fmt.Errorf("sign aster typed data: %w", err)
	}
	sig[64] += 27
	return hexutil.Encode(sig), nil
}

func (c *Client) addV3Auth(params url.Values) error {
	params.Set("nonce", strconv.FormatInt(c.nextNonceMicro(), 10))
	params.Set("user", c.userAddr)
	params.Set("signer", c.signerAddr)

	signature, err := c.signV3(params.Encode())
	if err != nil {
		return err
	}
	params.Set("signature", signature)
	return nil
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
	if c.usesV3Auth() {
		return c.doSignedV3(method, base, path, params)
	}
	return c.doSignedV1(method, base, path, params)
}

func (c *Client) doSignedV1(method, base, path string, params url.Values) ([]byte, error) {
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

func (c *Client) doSignedV3(method, base, path string, params url.Values) ([]byte, error) {
	if err := c.addV3Auth(params); err != nil {
		return nil, err
	}

	var req *http.Request
	var err error

	if method == http.MethodGet {
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

func (c *Client) spotSignedPut(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodPut, c.spotBase, path, params)
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

func (c *Client) futSignedPut(path string, params url.Values) ([]byte, error) {
	return c.doSigned(http.MethodPut, c.futBase, path, params)
}
