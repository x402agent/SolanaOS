package hyperliquid

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/vmihailenco/msgpack/v5"
)

// actionHash computes keccak256(msgpack(action) || nonce || vault).
// This replicates the Hyperliquid Python SDK signing.py logic exactly.
func actionHash(action any, vaultAddress string, nonce int64) ([]byte, error) {
	var buf bytes.Buffer
	enc := msgpack.NewEncoder(&buf)
	enc.UseCompactInts(true)
	if err := enc.Encode(action); err != nil {
		return nil, fmt.Errorf("msgpack encode: %w", err)
	}
	data := convertStr16ToStr8(buf.Bytes())

	// Append nonce as 8-byte big-endian.
	nonceBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(nonceBytes, uint64(nonce)) //nolint:gosec
	data = append(data, nonceBytes...)

	// Append vault flag + address.
	if vaultAddress == "" {
		data = append(data, 0x00)
	} else {
		data = append(data, 0x01)
		addr := strings.TrimPrefix(vaultAddress, "0x")
		addrBytes, _ := hex.DecodeString(addr)
		data = append(data, addrBytes...)
	}

	return crypto.Keccak256(data), nil
}

// convertStr16ToStr8 converts msgpack str16 (0xda + 2-byte len) to str8 (0xd9 + 1-byte len)
// for strings < 256 bytes, matching Python msgpack behaviour.
func convertStr16ToStr8(data []byte) []byte {
	result := make([]byte, 0, len(data))
	for i := 0; i < len(data); {
		b := data[i]
		if b == 0xda && i+2 < len(data) {
			length := (int(data[i+1]) << 8) | int(data[i+2])
			if length < 256 {
				result = append(result, 0xd9, byte(length)) //nolint:gosec
				i += 3
				if i+length <= len(data) {
					result = append(result, data[i:i+length]...)
					i += length
				}
				continue
			}
		}
		result = append(result, b)
		i++
	}
	return result
}

// signL1Action signs an action using the Hyperliquid L1 phantom-agent EIP-712 scheme.
func (c *Client) signL1Action(action any, nonce int64) (signatureResult, error) {
	hash, err := actionHash(action, "", nonce)
	if err != nil {
		return signatureResult{}, err
	}

	source := "b" // testnet
	if c.IsMainnet() {
		source = "a"
	}
	phantomAgent := map[string]any{
		"source":       source,
		"connectionId": hash,
	}

	chainID := math.HexOrDecimal256(*big.NewInt(1337))
	typedData := apitypes.TypedData{
		Domain: apitypes.TypedDataDomain{
			ChainId:           &chainID,
			Name:              "Exchange",
			Version:           "1",
			VerifyingContract: "0x0000000000000000000000000000000000000000",
		},
		Types: apitypes.Types{
			"Agent": []apitypes.Type{
				{Name: "source", Type: "string"},
				{Name: "connectionId", Type: "bytes32"},
			},
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
		},
		PrimaryType: "Agent",
		Message:     phantomAgent,
	}

	domainSep, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return signatureResult{}, fmt.Errorf("hash domain: %w", err)
	}
	msgHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		return signatureResult{}, fmt.Errorf("hash message: %w", err)
	}

	raw := append([]byte{0x19, 0x01}, domainSep...)
	raw = append(raw, msgHash...)
	finalHash := crypto.Keccak256Hash(raw)

	sig, err := crypto.Sign(finalHash.Bytes(), c.privateKey)
	if err != nil {
		return signatureResult{}, fmt.Errorf("sign: %w", err)
	}

	r := new(big.Int).SetBytes(sig[:32])
	s := new(big.Int).SetBytes(sig[32:64])
	v := int(sig[64]) + 27

	return signatureResult{
		R: hexutil.EncodeBig(r),
		S: hexutil.EncodeBig(s),
		V: v,
	}, nil
}
