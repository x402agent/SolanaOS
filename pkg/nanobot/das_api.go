// Package nanobot — Helius DAS (Digital Asset Standard) API integration.
//
// Uses Helius's DAS API for rich blockchain data:
//   - getAssetsByOwner → full portfolio with prices
//   - searchAssets → token discovery
//   - Enhanced transaction parsing
//
// This gives the agent "blockchain vision" the moment Helius keys are provided.
package nanobot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// DAS API types

// DASAsset represents a Helius DAS asset response.
type DASAsset struct {
	ID      string `json:"id"`
	Content struct {
		Metadata struct {
			Name        string `json:"name"`
			Symbol      string `json:"symbol"`
			Description string `json:"description"`
		} `json:"metadata"`
	} `json:"content"`
	TokenInfo *struct {
		Symbol    string  `json:"symbol"`
		Balance   uint64  `json:"balance"`
		Supply    uint64  `json:"supply"`
		Decimals  int     `json:"decimals"`
		PriceInfo *struct {
			PricePerToken float64 `json:"price_per_token"`
			TotalPrice    float64 `json:"total_price"`
			Currency      string  `json:"currency"`
		} `json:"price_info"`
	} `json:"token_info,omitempty"`
	Ownership struct {
		Owner string `json:"owner"`
	} `json:"ownership"`
	Interface string `json:"interface"`
}

// DASPortfolioResult is the full portfolio response.
type DASPortfolioResult struct {
	Items         []DASAsset `json:"items"`
	NativeBalance *struct {
		Lamports     uint64  `json:"lamports"`
		PricePerSOL  float64 `json:"price_per_sol"`
		TotalPrice   float64 `json:"total_price"`
	} `json:"nativeBalance,omitempty"`
	Total int `json:"total"`
}

// HeliusDAS provides DAS API calls using the Helius RPC endpoint.
type HeliusDAS struct {
	rpcURL string
	apiKey string
	http   *http.Client
}

// NewHeliusDAS creates a DAS client from env vars.
func NewHeliusDAS() *HeliusDAS {
	rpcURL := os.Getenv("HELIUS_RPC_URL")
	apiKey := os.Getenv("HELIUS_API_KEY")
	if rpcURL == "" {
		return nil
	}
	return &HeliusDAS{
		rpcURL: rpcURL,
		apiKey: apiKey,
		http:   &http.Client{Timeout: 15 * time.Second},
	}
}

// GetPortfolio fetches full portfolio (tokens + NFTs + SOL balance) via DAS API.
func (d *HeliusDAS) GetPortfolio(ctx context.Context, ownerAddress string) (*DASPortfolioResult, error) {
	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      "nanobot-portfolio",
		"method":  "getAssetsByOwner",
		"params": map[string]any{
			"ownerAddress": ownerAddress,
			"page":         1,
			"limit":        50,
			"displayOptions": map[string]any{
				"showFungible":    true,
				"showNativeBalance": true,
			},
		},
	}

	result, err := d.rpcCall(ctx, body)
	if err != nil {
		return nil, err
	}

	var portfolio DASPortfolioResult
	if err := json.Unmarshal(result, &portfolio); err != nil {
		return nil, fmt.Errorf("parse portfolio: %w", err)
	}
	return &portfolio, nil
}

// SearchTokens searches for fungible tokens owned by an address with price info.
func (d *HeliusDAS) SearchTokens(ctx context.Context, ownerAddress string) (*DASPortfolioResult, error) {
	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      "nanobot-tokens",
		"method":  "searchAssets",
		"params": map[string]any{
			"ownerAddress": ownerAddress,
			"tokenType":    "fungible",
			"displayOptions": map[string]any{
				"showNativeBalance": true,
			},
		},
	}

	result, err := d.rpcCall(ctx, body)
	if err != nil {
		return nil, err
	}

	var portfolio DASPortfolioResult
	if err := json.Unmarshal(result, &portfolio); err != nil {
		return nil, fmt.Errorf("parse tokens: %w", err)
	}
	return &portfolio, nil
}

// GetAsset fetches a single asset by mint address.
func (d *HeliusDAS) GetAsset(ctx context.Context, assetID string) (*DASAsset, error) {
	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      "nanobot-asset",
		"method":  "getAsset",
		"params": map[string]any{
			"id": assetID,
		},
	}

	result, err := d.rpcCall(ctx, body)
	if err != nil {
		return nil, err
	}

	var asset DASAsset
	if err := json.Unmarshal(result, &asset); err != nil {
		return nil, fmt.Errorf("parse asset: %w", err)
	}
	return &asset, nil
}

// rpcCall makes a JSON-RPC call to Helius.
func (d *HeliusDAS) rpcCall(ctx context.Context, body map[string]any) (json.RawMessage, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", d.rpcURL, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("helius rpc: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var rpcResp struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return nil, fmt.Errorf("parse rpc: %w", err)
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("helius error: %s", rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}
