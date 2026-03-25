// Package onchain :: jupiter.go
// Jupiter Ultra API integration for SolanaOS swap execution.
//
// Flow: GET /ultra/v1/order → sign locally → POST /ultra/v1/execute
// Jupiter handles submission, confirmation, and MEV protection.
package onchain

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	solanago "github.com/gagliardetto/solana-go"
)

// JupiterConfig holds Jupiter Ultra API settings.
type JupiterConfig struct {
	Endpoint         string // https://api.jup.ag
	UltraEndpoint    string // https://api.jup.ag/ultra/v1
	APIKey           string
	ReferralAccount  string
	ReferralFeeBps   int
}

// DefaultJupiterConfig loads from environment.
func DefaultJupiterConfig() JupiterConfig {
	return JupiterConfig{
		Endpoint:        envOrDefault("JUPITER_ENDPOINT", "https://api.jup.ag"),
		UltraEndpoint:   envOrDefault("JUPITER_ULTRA_ENDPOINT", "https://api.jup.ag/ultra/v1"),
		APIKey:          os.Getenv("JUPITER_API_KEY"),
		ReferralAccount: os.Getenv("JUPITER_REFERRAL"), // only used if initialized on-chain
		ReferralFeeBps:  50,
	}
}

func (c JupiterConfig) setHeaders(req *http.Request) {
	if c.APIKey != "" {
		req.Header.Set("x-api-key", c.APIKey)
	}
}

// ── Ultra Order ───────────────────────────────────────────────────────

// UltraOrderResponse is the response from GET /ultra/v1/order.
type UltraOrderResponse struct {
	RequestID   string  `json:"requestId"`
	InputMint   string  `json:"inputMint"`
	OutputMint  string  `json:"outputMint"`
	InAmount    string  `json:"inAmount"`
	OutAmount   string  `json:"outAmount"`
	PriceImpact float64 `json:"priceImpact"`
	Transaction string  `json:"transaction"` // base64 unsigned tx (null if no taker)
	ErrorCode   int     `json:"errorCode"`
	ErrorMsg    string  `json:"errorMessage"`
	Gasless     bool    `json:"gasless"`
	Router      string  `json:"router"`
	SwapUSDVal  float64 `json:"swapUsdValue"`
}

// GetUltraOrder calls GET /ultra/v1/order and returns the order with an
// unsigned transaction ready to sign.
func (e *Engine) GetUltraOrder(
	ctx context.Context,
	inputMint, outputMint string,
	amount uint64,
	taker string, // wallet pubkey; empty for quote-only
) (*UltraOrderResponse, error) {
	cfg := DefaultJupiterConfig()

	params := url.Values{}
	params.Set("inputMint", inputMint)
	params.Set("outputMint", outputMint)
	params.Set("amount", fmt.Sprintf("%d", amount))
	if taker != "" {
		params.Set("taker", taker)
	}
	if cfg.ReferralAccount != "" {
		params.Set("referralAccount", cfg.ReferralAccount)
		params.Set("referralFee", fmt.Sprintf("%d", cfg.ReferralFeeBps))
	}

	reqURL := cfg.UltraEndpoint + "/order?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	cfg.setHeaders(req)

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ultra order: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("ultra order %d: %s", resp.StatusCode, truncateBody(body))
	}

	var order UltraOrderResponse
	if err := json.Unmarshal(body, &order); err != nil {
		return nil, fmt.Errorf("decode ultra order: %w", err)
	}
	if order.ErrorCode != 0 {
		return nil, fmt.Errorf("ultra order error %d: %s", order.ErrorCode, order.ErrorMsg)
	}
	return &order, nil
}

// ── Ultra Execute ─────────────────────────────────────────────────────

// UltraExecuteResponse is the response from POST /ultra/v1/execute.
type UltraExecuteResponse struct {
	Status            string  `json:"status"` // "Success" | "Failed"
	Signature         string  `json:"signature"`
	Slot              string  `json:"slot"`
	Code              int     `json:"code"`
	Error             string  `json:"error"`
	TotalInputAmount  string  `json:"totalInputAmount"`
	TotalOutputAmount string  `json:"totalOutputAmount"`
}

// ExecuteUltraOrder signs the transaction from GetUltraOrder and submits it
// via POST /ultra/v1/execute. Jupiter handles landing and confirmation.
func (e *Engine) ExecuteUltraOrder(
	ctx context.Context,
	order *UltraOrderResponse,
	privKey solanago.PrivateKey,
) (*UltraExecuteResponse, error) {
	cfg := DefaultJupiterConfig()

	if order.Transaction == "" {
		return nil, fmt.Errorf("order has no transaction (insufficient funds or too small)")
	}

	// Decode base64 → bytes
	txBytes, err := base64.StdEncoding.DecodeString(order.Transaction)
	if err != nil {
		return nil, fmt.Errorf("decode order tx: %w", err)
	}

	// Deserialize
	tx, err := solanago.TransactionFromBytes(txBytes)
	if err != nil {
		return nil, fmt.Errorf("deserialize order tx: %w", err)
	}

	// Sign
	_, err = tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(privKey.PublicKey()) {
			return &privKey
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("sign order tx: %w", err)
	}

	// Re-encode as base64
	txSigned, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("marshal signed tx: %w", err)
	}
	signedB64 := base64.StdEncoding.EncodeToString(txSigned)

	// Submit to Jupiter execute endpoint
	body, err := json.Marshal(map[string]string{
		"signedTransaction": signedB64,
		"requestId":         order.RequestID,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", cfg.UltraEndpoint+"/execute",
		strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	cfg.setHeaders(req)

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ultra execute: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("ultra execute %d: %s", resp.StatusCode, truncateBody(respBody))
	}

	var result UltraExecuteResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode execute response: %w", err)
	}
	if result.Status == "Failed" {
		return nil, fmt.Errorf("swap failed on-chain (code %d): %s", result.Code, result.Error)
	}

	e.logf("✅ Ultra swap confirmed: %s → %s | sig: %s | router: %s",
		order.InputMint[:8], order.OutputMint[:8], result.Signature, order.Router)

	return &result, nil
}

// ── ExecuteSwap (convenience wrapper) ────────────────────────────────

// SwapQuote is kept for backward compatibility with the --sim quote path.
type SwapQuote struct {
	InputMint   string  `json:"inputMint"`
	OutputMint  string  `json:"outputMint"`
	InAmount    string  `json:"inAmount"`
	OutAmount   string  `json:"outAmount"`
	PriceImpact float64 `json:"priceImpact"`
}

// SwapResult is the result returned by ExecuteSwap.
type SwapResult struct {
	TxSignature string `json:"txSignature"`
	InputMint   string `json:"inputMint"`
	OutputMint  string `json:"outputMint"`
	InAmount    string `json:"inAmount"`
	OutAmount   string `json:"outAmount"`
}

// GetSwapQuote fetches a quote via Ultra /order (no taker = quote-only).
func (e *Engine) GetSwapQuote(
	ctx context.Context,
	inputMint, outputMint string,
	amount uint64,
	_ int, // slippageBps unused — Ultra manages slippage via RTSE
) (*SwapQuote, error) {
	order, err := e.GetUltraOrder(ctx, inputMint, outputMint, amount, "")
	if err != nil {
		return nil, err
	}
	return &SwapQuote{
		InputMint:   order.InputMint,
		OutputMint:  order.OutputMint,
		InAmount:    order.InAmount,
		OutAmount:   order.OutAmount,
		PriceImpact: order.PriceImpact,
	}, nil
}

// ExecuteSwap performs a full Ultra swap: order → sign → execute.
func (e *Engine) ExecuteSwap(
	ctx context.Context,
	inputMint, outputMint string,
	amount uint64,
	privKey solanago.PrivateKey,
	slippageBps int, // kept for API compat; Ultra manages slippage dynamically
) (*SwapResult, error) {
	taker := privKey.PublicKey().String()

	order, err := e.GetUltraOrder(ctx, inputMint, outputMint, amount, taker)
	if err != nil {
		return nil, fmt.Errorf("get order: %w", err)
	}

	result, err := e.ExecuteUltraOrder(ctx, order, privKey)
	if err != nil {
		return nil, err
	}

	return &SwapResult{
		TxSignature: result.Signature,
		InputMint:   order.InputMint,
		OutputMint:  order.OutputMint,
		InAmount:    order.InAmount,
		OutAmount:   order.OutAmount,
	}, nil
}

// ── Helpers ───────────────────────────────────────────────────────────

func truncateBody(b []byte) string {
	if len(b) > 300 {
		return string(b[:300])
	}
	return string(b)
}

// ── Well-Known Mints ─────────────────────────────────────────────────

const (
	SOLMint  = "So11111111111111111111111111111111111111112"
	USDCMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
	USDTMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
	BONKMint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
	JUPMint  = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
	RAYMint  = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
	WSOLMint = "So11111111111111111111111111111111111111112"
)
