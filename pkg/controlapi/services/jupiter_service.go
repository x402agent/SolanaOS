package services

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type JupiterService struct {
	client *http.Client
}

type tokenInfo struct {
	Mint     string
	Decimals int
}

var tokenRegistry = map[string]tokenInfo{
	"SOL":  {Mint: "So11111111111111111111111111111111111111112", Decimals: 9},
	"USDC": {Mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", Decimals: 6},
	"JUP":  {Mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", Decimals: 6},
	"BONK": {Mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", Decimals: 5},
	"WIF":  {Mint: "EKpQGSJtjMFqKZCrqM7G7k3VwAq9zq4jYt9mptR8JxyD", Decimals: 6},
}

func NewJupiterService() *JupiterService {
	return &JupiterService{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *JupiterService) Quote(req types.TradeQuoteRequest) (types.TradeQuoteResponse, error) {
	input, err := resolveToken(req.FromToken)
	if err != nil {
		return types.TradeQuoteResponse{}, err
	}
	output, err := resolveToken(req.ToToken)
	if err != nil {
		return types.TradeQuoteResponse{}, err
	}
	if req.Amount <= 0 {
		return types.TradeQuoteResponse{}, fmt.Errorf("amount must be greater than zero")
	}
	if req.SlippageBps <= 0 {
		req.SlippageBps = 50
	}
	atomicAmount := int64(math.Round(req.Amount * math.Pow10(input.Decimals)))
	endpoint := url.URL{
		Scheme: "https",
		Host:   "lite-api.jup.ag",
		Path:   "/swap/v1/quote",
	}
	query := endpoint.Query()
	query.Set("inputMint", input.Mint)
	query.Set("outputMint", output.Mint)
	query.Set("amount", fmt.Sprintf("%d", atomicAmount))
	query.Set("slippageBps", fmt.Sprintf("%d", req.SlippageBps))
	query.Set("swapMode", "ExactIn")
	endpoint.RawQuery = query.Encode()

	httpReq, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return types.TradeQuoteResponse{}, err
	}
	httpReq.Header.Set("Accept", "application/json")
	res, err := s.client.Do(httpReq)
	if err != nil {
		return types.TradeQuoteResponse{}, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return types.TradeQuoteResponse{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return types.TradeQuoteResponse{}, fmt.Errorf("jupiter quote failed: %s", strings.TrimSpace(string(body)))
	}
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return types.TradeQuoteResponse{}, err
	}
	resp := types.TradeQuoteResponse{
		Provider:   "jupiter",
		InputMint:  input.Mint,
		OutputMint: output.Mint,
		Raw:        raw,
	}
	if v, ok := raw["inAmount"].(string); ok {
		resp.InAmount = v
	}
	if v, ok := raw["outAmount"].(string); ok {
		resp.OutAmount = v
	}
	if v, ok := raw["otherAmountThreshold"].(string); ok {
		resp.OtherAmount = v
	}
	if v, ok := raw["swapMode"].(string); ok {
		resp.SwapMode = v
	}
	if v, ok := raw["priceImpactPct"].(string); ok {
		resp.PriceImpact = v
	}
	if routePlan, ok := raw["routePlan"].([]any); ok {
		resp.RouteCount = len(routePlan)
	}
	return resp, nil
}

func resolveToken(value string) (tokenInfo, error) {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	if token, ok := tokenRegistry[normalized]; ok {
		return token, nil
	}
	if len(strings.TrimSpace(value)) >= 32 {
		return tokenInfo{Mint: strings.TrimSpace(value), Decimals: 6}, nil
	}
	return tokenInfo{}, fmt.Errorf("unsupported token `%s`; use a known symbol or mint address", value)
}
