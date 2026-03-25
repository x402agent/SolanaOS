package agentwallet

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"
)

// EVMClient is a lightweight JSON-RPC client for EVM chains.
// Avoids the heavy go-ethereum dependency by doing raw RPC calls.
type EVMClient struct {
	ChainID int
	rpcURL  string
	http    *http.Client
}

// NewEVMClient creates an EVM RPC client for a chain.
func NewEVMClient(chainID int, rpcURL string) (*EVMClient, error) {
	if rpcURL == "" {
		return nil, fmt.Errorf("empty RPC URL for chain %d", chainID)
	}
	return &EVMClient{
		ChainID: chainID,
		rpcURL:  rpcURL,
		http:    &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// rpcCall makes a JSON-RPC 2.0 call.
func (c *EVMClient) rpcCall(ctx context.Context, method string, params []any) (json.RawMessage, error) {
	reqBody := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}
	data, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", c.rpcURL, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("rpc call %s: %w", method, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode rpc response: %w", err)
	}
	if result.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", result.Error.Code, result.Error.Message)
	}
	return result.Result, nil
}

// GetBalance returns the native token balance in wei.
func (c *EVMClient) GetBalance(ctx context.Context, address string) (*big.Int, error) {
	result, err := c.rpcCall(ctx, "eth_getBalance", []any{address, "latest"})
	if err != nil {
		return nil, err
	}
	var hexBalance string
	if err := json.Unmarshal(result, &hexBalance); err != nil {
		return nil, fmt.Errorf("decode balance: %w", err)
	}
	balance := new(big.Int)
	hexBalance = strings.TrimPrefix(hexBalance, "0x")
	balance.SetString(hexBalance, 16)
	return balance, nil
}

// GetNonce returns the current transaction nonce for an address.
func (c *EVMClient) GetNonce(ctx context.Context, address string) (uint64, error) {
	result, err := c.rpcCall(ctx, "eth_getTransactionCount", []any{address, "latest"})
	if err != nil {
		return 0, err
	}
	var hexNonce string
	if err := json.Unmarshal(result, &hexNonce); err != nil {
		return 0, fmt.Errorf("decode nonce: %w", err)
	}
	nonce := new(big.Int)
	hexNonce = strings.TrimPrefix(hexNonce, "0x")
	nonce.SetString(hexNonce, 16)
	return nonce.Uint64(), nil
}

// GetGasPrice returns the current gas price in wei.
func (c *EVMClient) GetGasPrice(ctx context.Context) (*big.Int, error) {
	result, err := c.rpcCall(ctx, "eth_gasPrice", []any{})
	if err != nil {
		return nil, err
	}
	var hexPrice string
	if err := json.Unmarshal(result, &hexPrice); err != nil {
		return nil, fmt.Errorf("decode gas price: %w", err)
	}
	price := new(big.Int)
	hexPrice = strings.TrimPrefix(hexPrice, "0x")
	price.SetString(hexPrice, 16)
	return price, nil
}

// Call executes a read-only eth_call.
func (c *EVMClient) Call(ctx context.Context, to, data string) (string, error) {
	callObj := map[string]string{
		"to":   to,
		"data": data,
	}
	result, err := c.rpcCall(ctx, "eth_call", []any{callObj, "latest"})
	if err != nil {
		return "", err
	}
	var hexResult string
	if err := json.Unmarshal(result, &hexResult); err != nil {
		return "", fmt.Errorf("decode call result: %w", err)
	}
	return hexResult, nil
}

// SendRawTransaction broadcasts a signed transaction.
func (c *EVMClient) SendRawTransaction(ctx context.Context, signedTxHex string) (string, error) {
	result, err := c.rpcCall(ctx, "eth_sendRawTransaction", []any{signedTxHex})
	if err != nil {
		return "", err
	}
	var txHash string
	if err := json.Unmarshal(result, &txHash); err != nil {
		return "", fmt.Errorf("decode tx hash: %w", err)
	}
	return txHash, nil
}

// Transfer sends native tokens (ETH/POL/etc) to an address.
// Amount is in human-readable format (e.g. "0.1" for 0.1 ETH).
func (c *EVMClient) Transfer(ctx context.Context, privKeyBytes []byte, to, amount string) (string, error) {
	// Parse amount to wei
	weiAmount, err := ParseEthAmount(amount)
	if err != nil {
		return "", err
	}

	// Derive address from private key
	fromAddr, err := AddressFromPrivKey(privKeyBytes)
	if err != nil {
		return "", err
	}

	nonce, err := c.GetNonce(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("get nonce: %w", err)
	}

	gasPrice, err := c.GetGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("get gas price: %w", err)
	}

	// Build legacy transaction
	tx := &EVMTransaction{
		Nonce:    nonce,
		GasPrice: gasPrice,
		GasLimit: 21000, // standard transfer
		To:       to,
		Value:    weiAmount,
		Data:     nil,
		ChainID:  big.NewInt(int64(c.ChainID)),
	}

	signedHex, err := tx.Sign(privKeyBytes)
	if err != nil {
		return "", fmt.Errorf("sign tx: %w", err)
	}

	return c.SendRawTransaction(ctx, signedHex)
}

// TransferERC20 sends ERC-20 tokens.
func (c *EVMClient) TransferERC20(ctx context.Context, privKeyBytes []byte, tokenAddr, to, amount string, decimals int) (string, error) {
	rawAmount := ParseUnits(amount, decimals)

	// Build transfer(address,uint256) calldata
	calldata := BuildERC20TransferData(to, rawAmount.String())

	fromAddr, err := AddressFromPrivKey(privKeyBytes)
	if err != nil {
		return "", err
	}

	nonce, err := c.GetNonce(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("get nonce: %w", err)
	}

	gasPrice, err := c.GetGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("get gas price: %w", err)
	}

	tx := &EVMTransaction{
		Nonce:    nonce,
		GasPrice: gasPrice,
		GasLimit: 100000, // ERC-20 transfer gas
		To:       tokenAddr,
		Value:    big.NewInt(0),
		Data:     calldata,
		ChainID:  big.NewInt(int64(c.ChainID)),
	}

	signedHex, err := tx.Sign(privKeyBytes)
	if err != nil {
		return "", fmt.Errorf("sign tx: %w", err)
	}

	return c.SendRawTransaction(ctx, signedHex)
}

// ── EVM Transaction ──────────────────────────────────────────────

// EVMTransaction represents an unsigned EVM transaction.
type EVMTransaction struct {
	Nonce    uint64
	GasPrice *big.Int
	GasLimit uint64
	To       string
	Value    *big.Int
	Data     []byte
	ChainID  *big.Int
}

// Sign produces a signed raw transaction hex (simplified — uses SHA-256 signature).
// In production, use go-ethereum's crypto.Sign with secp256k1.
func (tx *EVMTransaction) Sign(privKeyBytes []byte) (string, error) {
	// RLP encode the transaction for signing
	txData := tx.rlpEncode()

	// Hash for signing
	hash := sha256.Sum256(txData)

	// ECDSA sign
	privKey := new(ecdsa.PrivateKey)
	privKey.Curve = elliptic.P256()
	privKey.D = new(big.Int).SetBytes(privKeyBytes)
	privKey.PublicKey.X, privKey.PublicKey.Y = privKey.Curve.ScalarBaseMult(privKeyBytes)

	r, s, err := ecdsa.Sign(strings.NewReader(hex.EncodeToString(hash[:])), privKey, hash[:])
	if err != nil {
		return "", fmt.Errorf("ecdsa sign: %w", err)
	}

	// Encode signed tx (simplified RLP with signature)
	sigBytes := append(r.Bytes(), s.Bytes()...)
	signedData := append(txData, sigBytes...)

	return "0x" + hex.EncodeToString(signedData), nil
}

// rlpEncode provides a simplified RLP encoding for the transaction.
func (tx *EVMTransaction) rlpEncode() []byte {
	var buf bytes.Buffer
	// Simplified encoding — nonce + gas price + gas limit + to + value + data + chainID
	fmt.Fprintf(&buf, "%x", tx.Nonce)
	buf.Write(tx.GasPrice.Bytes())
	fmt.Fprintf(&buf, "%x", tx.GasLimit)
	buf.WriteString(tx.To)
	buf.Write(tx.Value.Bytes())
	buf.Write(tx.Data)
	buf.Write(tx.ChainID.Bytes())
	return buf.Bytes()
}

// ── EVM Helpers ──────────────────────────────────────────────────

// ParseEthAmount converts human-readable ETH to wei.
func ParseEthAmount(amount string) (*big.Int, error) {
	f := new(big.Float)
	f, ok := f.SetString(amount)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", amount)
	}
	wei := new(big.Float).Mul(f, big.NewFloat(1e18))
	result, _ := wei.Int(nil)
	return result, nil
}

// ParseUnits converts human-readable to raw units with given decimals.
func ParseUnits(amount string, decimals int) *big.Int {
	f := new(big.Float)
	f.SetString(amount)
	multiplier := new(big.Float).SetFloat64(1)
	for i := 0; i < decimals; i++ {
		multiplier.Mul(multiplier, big.NewFloat(10))
	}
	result := new(big.Float).Mul(f, multiplier)
	intResult, _ := result.Int(nil)
	return intResult
}

// FormatUnits converts raw units to human-readable.
func FormatUnits(raw *big.Int, decimals int) string {
	f := new(big.Float).SetInt(raw)
	divisor := new(big.Float).SetFloat64(1)
	for i := 0; i < decimals; i++ {
		divisor.Mul(divisor, big.NewFloat(10))
	}
	result := new(big.Float).Quo(f, divisor)
	return result.Text('f', decimals)
}

// BuildERC20TransferData builds transfer(address,uint256) calldata.
func BuildERC20TransferData(to, amount string) []byte {
	// transfer selector: 0xa9059cbb
	selector, _ := hex.DecodeString("a9059cbb")
	addressPadded := padAddress(to)
	amountPadded := padUint256(amount)
	data := make([]byte, 0, 68)
	data = append(data, selector...)
	data = append(data, addressPadded...)
	data = append(data, amountPadded...)
	return data
}

// AddressFromPrivKey derives an address from a private key.
func AddressFromPrivKey(privKeyBytes []byte) (string, error) {
	privKey := new(ecdsa.PrivateKey)
	privKey.Curve = elliptic.P256()
	privKey.D = new(big.Int).SetBytes(privKeyBytes)
	privKey.PublicKey.X, privKey.PublicKey.Y = privKey.Curve.ScalarBaseMult(privKeyBytes)

	pubBytes := elliptic.Marshal(privKey.Curve, privKey.PublicKey.X, privKey.PublicKey.Y)
	hash := sha256.Sum256(pubBytes[1:])
	return "0x" + hex.EncodeToString(hash[12:]), nil
}

// EVMSign signs a message with an EVM private key.
func EVMSign(privKeyBytes, message []byte) (string, error) {
	hash := sha256.Sum256(message)

	privKey := new(ecdsa.PrivateKey)
	privKey.Curve = elliptic.P256()
	privKey.D = new(big.Int).SetBytes(privKeyBytes)
	privKey.PublicKey.X, privKey.PublicKey.Y = privKey.Curve.ScalarBaseMult(privKeyBytes)

	r, s, err := ecdsa.Sign(strings.NewReader(hex.EncodeToString(hash[:])), privKey, hash[:])
	if err != nil {
		return "", err
	}

	sig := append(r.Bytes(), s.Bytes()...)
	return "0x" + hex.EncodeToString(sig), nil
}

func padAddress(addr string) []byte {
	addr = strings.TrimPrefix(addr, "0x")
	addrBytes, _ := hex.DecodeString(addr)
	padded := make([]byte, 32)
	copy(padded[32-len(addrBytes):], addrBytes)
	return padded
}

func padUint256(amount string) []byte {
	n := new(big.Int)
	n.SetString(amount, 10)
	b := n.Bytes()
	padded := make([]byte, 32)
	copy(padded[32-len(b):], b)
	return padded
}

// ── Chain Metadata ───────────────────────────────────────────────

// ChainName returns a human-readable chain name.
func ChainName(chainID int) string {
	names := map[int]string{
		1:       "Ethereum",
		8453:    "Base",
		42161:   "Arbitrum One",
		10:      "Optimism",
		137:     "Polygon",
		56:      "BSC",
		43114:   "Avalanche",
		7777777: "Zora",
		369:     "PulseChain",
		900:     "Solana",
		901:     "Solana Devnet",
	}
	if name, ok := names[chainID]; ok {
		return name
	}
	return fmt.Sprintf("Chain %d", chainID)
}

// NativeToken returns the native token symbol for a chain.
func NativeToken(chainID int) string {
	tokens := map[int]string{
		1:       "ETH",
		8453:    "ETH",
		42161:   "ETH",
		10:      "ETH",
		137:     "POL",
		56:      "BNB",
		43114:   "AVAX",
		7777777: "ETH",
		369:     "PLS",
		900:     "SOL",
		901:     "SOL",
	}
	if tok, ok := tokens[chainID]; ok {
		return tok
	}
	return "ETH"
}
