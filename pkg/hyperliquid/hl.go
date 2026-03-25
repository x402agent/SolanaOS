package hyperliquid

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

const (
	MainnetAPIURL   = "https://api.hyperliquid.xyz"
	TestnetAPIURL   = "https://api.hyperliquid-testnet.xyz"
	DefaultSlippage = 0.05
)

// Client is a small Hyperliquid client tailored for perp trading commands.
type Client struct {
	baseURL         string
	httpClient      *http.Client
	privateKey      *ecdsa.PrivateKey
	wallet          string
	lastNonce       atomic.Int64
	coinToAsset     map[string]int
	assetToDecimals map[int]int
}

// New creates a mainnet client from a private key.
func New(privateKeyHex string) (*Client, error) {
	return NewWithConfig(privateKeyHex, "", false)
}

// NewWithConfig creates a client with optional wallet override and testnet routing.
func NewWithConfig(privateKeyHex, wallet string, testnet bool) (*Client, error) {
	privateKeyHex = strings.TrimPrefix(strings.TrimSpace(privateKeyHex), "0x")
	pk, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("hyperliquid: invalid private key: %w", err)
	}
	derived := crypto.PubkeyToAddress(pk.PublicKey).Hex()
	if strings.TrimSpace(wallet) == "" {
		wallet = derived
	}
	baseURL := MainnetAPIURL
	if testnet {
		baseURL = TestnetAPIURL
	}
	return &Client{
		baseURL:         baseURL,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
		privateKey:      pk,
		wallet:          wallet,
		coinToAsset:     make(map[string]int),
		assetToDecimals: make(map[int]int),
	}, nil
}

func (c *Client) Wallet() string  { return c.wallet }
func (c *Client) BaseURL() string { return c.baseURL }
func (c *Client) IsMainnet() bool { return c.baseURL == MainnetAPIURL }

func (c *Client) post(ctx context.Context, path string, payload any) ([]byte, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hl http: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("hl %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	return body, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func (c *Client) nextNonce() int64 {
	for {
		last := c.lastNonce.Load()
		candidate := time.Now().UnixMilli()
		if candidate <= last {
			candidate = last + 1
		}
		if c.lastNonce.CompareAndSwap(last, candidate) {
			return candidate
		}
	}
}

func (c *Client) executeAction(ctx context.Context, action any) ([]byte, error) {
	nonce := c.nextNonce()
	sig, err := c.signL1Action(action, nonce)
	if err != nil {
		return nil, err
	}
	payload := map[string]any{
		"action":    action,
		"nonce":     nonce,
		"signature": sig,
	}
	return c.post(ctx, "/exchange", payload)
}

func (c *Client) coinToAssetID(ctx context.Context, coin string) (int, error) {
	coin = strings.ToUpper(strings.TrimSpace(coin))
	if id, ok := c.coinToAsset[coin]; ok {
		return id, nil
	}
	if err := c.loadMeta(ctx); err != nil {
		return 0, err
	}
	id, ok := c.coinToAsset[coin]
	if !ok {
		return 0, fmt.Errorf("unknown coin: %s", coin)
	}
	return id, nil
}

func (c *Client) loadMeta(ctx context.Context) error {
	body, err := c.post(ctx, "/info", map[string]any{"type": "meta"})
	if err != nil {
		return err
	}
	var meta metaResponse
	if err := json.Unmarshal(body, &meta); err != nil {
		return err
	}
	for i, a := range meta.Universe {
		c.coinToAsset[strings.ToUpper(a.Name)] = i
		c.assetToDecimals[i] = a.SzDecimals
	}
	return nil
}

func floatToWire(x float64) (string, error) {
	rounded := fmt.Sprintf("%.8f", x)
	parsed, err := strconv.ParseFloat(rounded, 64)
	if err != nil {
		return "", err
	}
	if math.Abs(parsed-x) >= 1e-12 {
		return "", fmt.Errorf("floatToWire rounding error: %f", x)
	}
	if rounded == "-0.00000000" {
		rounded = "0.00000000"
	}
	result := strings.TrimRight(rounded, "0")
	result = strings.TrimRight(result, ".")
	return result, nil
}

func roundSig(price float64, sigFigs int) float64 {
	if price == 0 {
		return 0
	}
	d := math.Ceil(math.Log10(math.Abs(price)))
	pow := math.Pow(10, float64(sigFigs)-d)
	return math.Round(price*pow) / pow
}

func roundDec(value float64, decimals int) float64 {
	pow := math.Pow(10, float64(decimals))
	return math.Round(value*pow) / pow
}

func (c *Client) slippagePrice(ctx context.Context, coin string, isBuy bool, slippage float64, px *float64) (float64, error) {
	if px != nil {
		return *px, nil
	}
	mids, err := c.AllMids(ctx)
	if err != nil {
		return 0, err
	}
	coin = strings.ToUpper(strings.TrimSpace(coin))
	midStr, ok := mids[coin]
	if !ok {
		return 0, fmt.Errorf("no mid price for %s", coin)
	}
	mid, err := strconv.ParseFloat(midStr, 64)
	if err != nil {
		return 0, err
	}
	if isBuy {
		mid *= (1 + slippage)
	} else {
		mid *= (1 - slippage)
	}
	mid = roundSig(mid, 5)
	asset, err := c.coinToAssetID(ctx, coin)
	if err != nil {
		return 0, err
	}
	return roundDec(mid, 6-c.assetToDecimals[asset]), nil
}
