// Package onchain provides SolanaOS's on-chain financial engine.
//
// Powered by the gagliardetto/solana-go SDK with Solana Tracker or Helius
// RPC/WSS for real-time mainnet data. This is the agent's direct connection
// to the Solana blockchain.
//
// Capabilities:
//   - Real-time balance & token portfolio queries (shared RPC)
//   - Transaction history with enhanced parsing (Helius enhanced API)
//   - WebSocket account monitoring for live position tracking (shared WSS)
//   - SOL transfer & SPL token transfer execution
//   - Priority fee estimation for landing transactions
//   - Token metadata resolution via Metaplex
//
// Shared RPC calls prefer Solana Tracker when configured, then fall back to
// Helius. Helius-only enhanced endpoints remain optional.
package onchain

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
	confirm "github.com/gagliardetto/solana-go/rpc/sendAndConfirmTransaction"
	"github.com/gagliardetto/solana-go/rpc/ws"
)

// ── Engine Config ────────────────────────────────────────────────────

// Config holds all Solana RPC provider settings.
type Config struct {
	HeliusRPCURL            string // e.g. https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
	HeliusAPIKey            string // Helius API key for enhanced endpoints
	HeliusWSSURL            string // e.g. wss://mainnet.helius-rpc.com/?api-key=YOUR_KEY
	SolanaTrackerRPCURL     string // e.g. https://rpc-mainnet.solanatracker.io/?api_key=YOUR_KEY
	SolanaTrackerAPIKey     string // Solana Tracker RPC API key
	SolanaTrackerDataAPIKey string // Solana Tracker data API key
	SolanaTrackerWSSURL     string // e.g. wss://rpc-mainnet.solanatracker.io/?api_key=YOUR_KEY
	Network                 string // "mainnet" or "devnet"
}

// DefaultConfig returns config populated from environment.
func DefaultConfig() Config {
	return Config{
		HeliusRPCURL:            envOrDefault("HELIUS_RPC_URL", ""),
		HeliusAPIKey:            envOrDefault("HELIUS_API_KEY", ""),
		HeliusWSSURL:            envOrDefault("HELIUS_WSS_URL", ""),
		SolanaTrackerRPCURL:     envOrDefault("SOLANA_TRACKER_RPC_URL", ""),
		SolanaTrackerAPIKey:     envOrDefault("SOLANA_TRACKER_API_KEY", ""),
		SolanaTrackerDataAPIKey: envOrDefault("SOLANA_TRACKER_DATA_API_KEY", ""),
		SolanaTrackerWSSURL:     envOrDefault("SOLANA_TRACKER_WSS_URL", ""),
		Network:                 envOrDefault("HELIUS_NETWORK", "mainnet"),
	}
}

// Validate checks that required config is set.
func (c Config) Validate() error {
	if c.PreferredRPCURL() == "" {
		return fmt.Errorf("set SOLANA_TRACKER_RPC_URL or HELIUS_RPC_URL to enable on-chain RPC")
	}
	return nil
}

func (c Config) PreferredRPCURL() string {
	if v := strings.TrimSpace(c.SolanaTrackerRPCURL); v != "" {
		return v
	}
	return strings.TrimSpace(c.HeliusRPCURL)
}

func (c Config) PreferredWSSURL() string {
	if v := strings.TrimSpace(c.SolanaTrackerWSSURL); v != "" {
		return v
	}
	return strings.TrimSpace(c.HeliusWSSURL)
}

// ── On-Chain Engine ──────────────────────────────────────────────────

// Engine is SolanaOS's on-chain financial engine.
type Engine struct {
	cfg    Config
	rpc    *rpc.Client
	wsConn *ws.Client
	http   *http.Client
	logf   func(string, ...any)
}

// NewEngine creates a new on-chain engine connected to the preferred RPC provider.
func NewEngine(cfg Config) (*Engine, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	rpcClient := rpc.New(cfg.PreferredRPCURL())

	e := &Engine{
		cfg:  cfg,
		rpc:  rpcClient,
		http: &http.Client{Timeout: 30 * time.Second},
		logf: func(f string, a ...any) { log.Printf("[ONCHAIN] "+f, a...) },
	}

	return e, nil
}

// ConnectWSS establishes the WebSocket connection for real-time subscriptions.
func (e *Engine) ConnectWSS(ctx context.Context) error {
	wssURL := e.cfg.PreferredWSSURL()
	if wssURL == "" {
		e.logf("⚠️  No Solana RPC WSS URL — real-time subscriptions disabled")
		return nil
	}

	wsClient, err := ws.Connect(ctx, wssURL)
	if err != nil {
		return fmt.Errorf("WSS connect: %w", err)
	}
	e.wsConn = wsClient
	e.logf("🔌 WSS connected")
	return nil
}

// Close cleans up connections.
func (e *Engine) Close() {
	if e.rpc != nil {
		_ = e.rpc.Close()
	}
	// ws.Client doesn't have a close method in this version
}

// RPC returns the raw solana-go RPC client for advanced usage.
func (e *Engine) RPC() *rpc.Client {
	return e.rpc
}

// ── Balance & Portfolio ──────────────────────────────────────────────

// SOLBalance returns the SOL balance in lamports and SOL for a pubkey.
type BalanceResult struct {
	Lamports uint64  `json:"lamports"`
	SOL      float64 `json:"sol"`
}

func (e *Engine) GetSOLBalance(ctx context.Context, pubkey solanago.PublicKey) (*BalanceResult, error) {
	out, err := e.rpc.GetBalance(ctx, pubkey, rpc.CommitmentConfirmed)
	if err != nil {
		return nil, fmt.Errorf("get balance: %w", err)
	}
	lamports := out.Value
	return &BalanceResult{
		Lamports: lamports,
		SOL:      float64(lamports) / 1e9,
	}, nil
}

// TokenBalance represents a single SPL token balance.
type TokenBalance struct {
	Mint     string  `json:"mint"`
	Amount   uint64  `json:"amount"`
	Decimals int     `json:"decimals"`
	UIAmount float64 `json:"ui_amount"`
	Symbol   string  `json:"symbol,omitempty"`
}

// GetTokenBalances returns all SPL token balances for a wallet.
func (e *Engine) GetTokenBalances(ctx context.Context, wallet solanago.PublicKey) ([]TokenBalance, error) {
	out, err := e.rpc.GetTokenAccountsByOwner(
		ctx,
		wallet,
		&rpc.GetTokenAccountsConfig{
			ProgramId: &solanago.TokenProgramID,
		},
		&rpc.GetTokenAccountsOpts{
			Encoding: solanago.EncodingJSONParsed,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("get token accounts: %w", err)
	}

	var balances []TokenBalance
	for _, account := range out.Value {
		var parsed struct {
			Parsed struct {
				Info struct {
					Mint        string `json:"mint"`
					TokenAmount struct {
						Amount         string  `json:"amount"`
						Decimals       int     `json:"decimals"`
						UIAmountString string  `json:"uiAmountString"`
						UIAmount       float64 `json:"uiAmount"`
					} `json:"tokenAmount"`
				} `json:"info"`
			} `json:"parsed"`
		}

		data := account.Account.Data.GetRawJSON()
		if err := json.Unmarshal(data, &parsed); err != nil {
			continue
		}

		if parsed.Parsed.Info.TokenAmount.UIAmount > 0 {
			rawAmount, _ := strconv.ParseUint(parsed.Parsed.Info.TokenAmount.Amount, 10, 64)
			balances = append(balances, TokenBalance{
				Mint:     parsed.Parsed.Info.Mint,
				Amount:   rawAmount,
				Decimals: parsed.Parsed.Info.TokenAmount.Decimals,
				UIAmount: parsed.Parsed.Info.TokenAmount.UIAmount,
			})
		}
	}

	return balances, nil
}

// GetTokenBalanceByMint returns the balance for a specific SPL mint.
func (e *Engine) GetTokenBalanceByMint(ctx context.Context, wallet, mint solanago.PublicKey) (*TokenBalance, error) {
	out, err := e.rpc.GetTokenAccountsByOwner(
		ctx,
		wallet,
		&rpc.GetTokenAccountsConfig{
			Mint: &mint,
		},
		&rpc.GetTokenAccountsOpts{
			Encoding: solanago.EncodingJSONParsed,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("get token account by mint: %w", err)
	}
	if len(out.Value) == 0 {
		return &TokenBalance{Mint: mint.String()}, nil
	}

	var parsed struct {
		Parsed struct {
			Info struct {
				Mint        string `json:"mint"`
				TokenAmount struct {
					Amount   string  `json:"amount"`
					Decimals int     `json:"decimals"`
					UIAmount float64 `json:"uiAmount"`
				} `json:"tokenAmount"`
			} `json:"info"`
		} `json:"parsed"`
	}

	data := out.Value[0].Account.Data.GetRawJSON()
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("parse token account: %w", err)
	}

	rawAmount, err := strconv.ParseUint(parsed.Parsed.Info.TokenAmount.Amount, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("parse token amount: %w", err)
	}

	return &TokenBalance{
		Mint:     parsed.Parsed.Info.Mint,
		Amount:   rawAmount,
		Decimals: parsed.Parsed.Info.TokenAmount.Decimals,
		UIAmount: parsed.Parsed.Info.TokenAmount.UIAmount,
	}, nil
}

// ── Transaction History (Helius Enhanced) ────────────────────────────

// EnhancedTransaction is a parsed transaction from Helius.
type EnhancedTransaction struct {
	Signature       string `json:"signature"`
	Type            string `json:"type"`
	Description     string `json:"description"`
	Source          string `json:"source"`
	Fee             int    `json:"fee"`
	Timestamp       int64  `json:"timestamp"`
	NativeTransfers []struct {
		FromUserAccount string `json:"fromUserAccount"`
		ToUserAccount   string `json:"toUserAccount"`
		Amount          int64  `json:"amount"`
	} `json:"nativeTransfers"`
	TokenTransfers []struct {
		FromUserAccount string  `json:"fromUserAccount"`
		ToUserAccount   string  `json:"toUserAccount"`
		Mint            string  `json:"mint"`
		TokenAmount     float64 `json:"tokenAmount"`
	} `json:"tokenTransfers"`
}

// GetEnhancedTransactions fetches parsed transactions via Helius API.
func (e *Engine) GetEnhancedTransactions(ctx context.Context, address string, limit int) ([]EnhancedTransaction, error) {
	if limit <= 0 {
		limit = 20
	}
	if strings.TrimSpace(e.cfg.HeliusAPIKey) == "" {
		return nil, fmt.Errorf("enhanced transaction history requires HELIUS_API_KEY")
	}

	url := fmt.Sprintf("https://api.helius.xyz/v0/addresses/%s/transactions?api-key=%s&limit=%d",
		address, e.cfg.HeliusAPIKey, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("helius API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("helius API %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}

	var txns []EnhancedTransaction
	if err := json.NewDecoder(resp.Body).Decode(&txns); err != nil {
		return nil, fmt.Errorf("decode transactions: %w", err)
	}

	return txns, nil
}

// ── Send SOL ─────────────────────────────────────────────────────────

// SendSOL transfers SOL from the agent wallet to a destination.
func (e *Engine) SendSOL(
	ctx context.Context,
	from solanago.PrivateKey,
	to solanago.PublicKey,
	lamports uint64,
) (solanago.Signature, error) {
	recent, err := e.rpc.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("get blockhash: %w", err)
	}

	tx, err := solanago.NewTransaction(
		[]solanago.Instruction{
			system.NewTransferInstruction(
				lamports,
				from.PublicKey(),
				to,
			).Build(),
		},
		recent.Value.Blockhash,
		solanago.TransactionPayer(from.PublicKey()),
	)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("build tx: %w", err)
	}

	_, err = tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(from.PublicKey()) {
			return &from
		}
		return nil
	})
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("sign tx: %w", err)
	}

	// Connect WSS for confirmation if available
	if wssURL := e.cfg.PreferredWSSURL(); wssURL != "" {
		wsClient, wErr := ws.Connect(ctx, wssURL)
		if wErr == nil {
			sig, err := confirm.SendAndConfirmTransaction(ctx, e.rpc, wsClient, tx)
			if err != nil {
				return solanago.Signature{}, fmt.Errorf("send+confirm: %w", err)
			}
			return sig, nil
		}
	}

	// Fallback: send without WSS confirmation
	sig, err := e.rpc.SendTransaction(ctx, tx)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("send tx: %w", err)
	}
	return sig, nil
}

// ── Send SPL Token ───────────────────────────────────────────────────

// SendToken transfers SPL tokens from the agent wallet.
func (e *Engine) SendToken(
	ctx context.Context,
	from solanago.PrivateKey,
	to solanago.PublicKey,
	mint solanago.PublicKey,
	amount uint64,
	decimals uint8,
) (solanago.Signature, error) {
	// Derive ATAs
	fromATA, _, err := solanago.FindAssociatedTokenAddress(from.PublicKey(), mint)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("from ATA: %w", err)
	}
	toATA, _, err := solanago.FindAssociatedTokenAddress(to, mint)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("to ATA: %w", err)
	}

	recent, err := e.rpc.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("get blockhash: %w", err)
	}

	tx, err := solanago.NewTransaction(
		[]solanago.Instruction{
			token.NewTransferCheckedInstruction(
				amount,
				decimals,
				fromATA,
				mint,
				toATA,
				from.PublicKey(),
				[]solanago.PublicKey{},
			).Build(),
		},
		recent.Value.Blockhash,
		solanago.TransactionPayer(from.PublicKey()),
	)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("build tx: %w", err)
	}

	_, err = tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(from.PublicKey()) {
			return &from
		}
		return nil
	})
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("sign tx: %w", err)
	}

	sig, err := e.rpc.SendTransaction(ctx, tx)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("send token tx: %w", err)
	}
	return sig, nil
}

// ── Priority Fees ────────────────────────────────────────────────────

// PriorityFeeEstimate returns the recommended priority fee in micro-lamports.
type PriorityFeeEstimate struct {
	Min    uint64 `json:"min"`
	Low    uint64 `json:"low"`
	Medium uint64 `json:"medium"`
	High   uint64 `json:"high"`
	Max    uint64 `json:"max"`
}

// GetPriorityFees fetches recent priority fees via Helius API.
func (e *Engine) GetPriorityFees(ctx context.Context) (*PriorityFeeEstimate, error) {
	payload := `{"jsonrpc":"2.0","id":1,"method":"getPriorityFeeEstimate","params":[{"options":{"includeAllPriorityFeeLevels":true}}]}`

	req, err := http.NewRequestWithContext(ctx, "POST", e.cfg.PreferredRPCURL(), strings.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("priority fees: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			PriorityFeeLevels PriorityFeeEstimate `json:"priorityFeeLevels"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result.Result.PriorityFeeLevels, nil
}

// ── WebSocket Subscriptions ──────────────────────────────────────────

// WatchAccount subscribes to account changes via WSS.
// Returns a channel that receives updates.
func (e *Engine) WatchAccount(ctx context.Context, pubkey solanago.PublicKey) (<-chan uint64, error) {
	if e.wsConn == nil {
		return nil, fmt.Errorf("WSS not connected — set SOLANA_TRACKER_WSS_URL or HELIUS_WSS_URL")
	}

	sub, err := e.wsConn.AccountSubscribe(pubkey, rpc.CommitmentConfirmed)
	if err != nil {
		return nil, fmt.Errorf("account subscribe: %w", err)
	}

	ch := make(chan uint64, 16)
	go func() {
		defer sub.Unsubscribe()
		defer close(ch)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				got, err := sub.Recv(ctx)
				if err != nil {
					e.logf("WSS recv error: %v", err)
					return
				}
				ch <- got.Value.Lamports
			}
		}
	}()

	return ch, nil
}

// ── Health Check ─────────────────────────────────────────────────────

// HealthStatus represents the Solana RPC health.
type HealthStatus struct {
	Healthy     bool          `json:"healthy"`
	BlockHeight uint64        `json:"block_height"`
	Slot        uint64        `json:"slot"`
	Version     string        `json:"version"`
	Latency     time.Duration `json:"latency"`
}

// CheckHealth performs a health check against the Helius RPC.
func (e *Engine) CheckHealth(ctx context.Context) (*HealthStatus, error) {
	start := time.Now()

	version, err := e.rpc.GetVersion(ctx)
	if err != nil {
		return &HealthStatus{Healthy: false, Latency: time.Since(start)}, err
	}

	slot, _ := e.rpc.GetSlot(ctx, rpc.CommitmentConfirmed)
	height, _ := e.rpc.GetBlockHeight(ctx, rpc.CommitmentConfirmed)

	return &HealthStatus{
		Healthy:     true,
		BlockHeight: height,
		Slot:        slot,
		Version:     version.SolanaCore,
		Latency:     time.Since(start),
	}, nil
}

// ── Helpers ──────────────────────────────────────────────────────────

func envOrDefault(key, fallback string) string {
	if v := getEnvValue(key); v != "" {
		return v
	}
	return fallback
}

func getEnvValue(key string) string {
	return os.Getenv(key)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
