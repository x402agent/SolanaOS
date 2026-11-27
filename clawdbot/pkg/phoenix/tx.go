// Package phoenix :: tx.go
// Solana transaction builder, signer, and RPC submitter.
//
// Flow:
//  1. Load ed25519 keypair from Solana CLI JSON file
//  2. Fetch recent blockhash via Solana RPC
//  3. Build legacy transaction message from Phoenix instructions with solana-go
//  4. Sign with the local keypair
//  5. Submit the transaction via sendTransaction RPC
package phoenix

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// ── Keypair loading ───────────────────────────────────────────────────

// Keypair holds an ed25519 private key and its corresponding public key.
type Keypair struct {
	PrivateKey solanago.PrivateKey
	PublicKey  solanago.PublicKey
}

// LoadKeypair reads a Solana CLI keypair file (JSON array of 64 bytes).
func LoadKeypair(path string) (*Keypair, error) {
	privateKey, err := solanago.PrivateKeyFromSolanaKeygenFile(path)
	if err == nil {
		return keypairFromPrivateKey(privateKey)
	}

	data, readErr := os.ReadFile(path)
	if readErr != nil {
		return nil, fmt.Errorf("read keypair %s: %w", path, readErr)
	}

	var bytes64 []byte
	if parseErr := json.Unmarshal(data, &bytes64); parseErr != nil {
		// Try as array of ints (Solana CLI format)
		var ints []int
		if err2 := json.Unmarshal(data, &ints); err2 != nil {
			return nil, fmt.Errorf("parse keypair: %w", parseErr)
		}
		bytes64 = make([]byte, len(ints))
		for i, v := range ints {
			if v < 0 || v > 255 {
				return nil, fmt.Errorf("keypair byte %d out of range: %d", i, v)
			}
			bytes64[i] = byte(v)
		}
	}

	return keypairFromPrivateKey(solanago.PrivateKey(bytes64))
}

func keypairFromPrivateKey(privateKey solanago.PrivateKey) (*Keypair, error) {
	if err := privateKey.Validate(); err != nil {
		return nil, fmt.Errorf("invalid keypair: %w", err)
	}
	return &Keypair{
		PrivateKey: privateKey,
		PublicKey:  privateKey.PublicKey(),
	}, nil
}

// Pubkey returns the base58-encoded public key string.
func (kp *Keypair) Pubkey() string {
	if kp == nil {
		return ""
	}
	return kp.PublicKey.String()
}

// ── Solana transaction builder ────────────────────────────────────────

// BuildAndSign constructs a signed legacy Solana transaction from Phoenix instructions.
// blockhash is the recent blockhash (base58).
func BuildAndSign(kp *Keypair, instructions []Instruction, blockhash string) ([]byte, error) {
	if kp == nil {
		return nil, fmt.Errorf("keypair is required")
	}
	if err := kp.PrivateKey.Validate(); err != nil {
		return nil, fmt.Errorf("invalid keypair: %w", err)
	}

	recentBlockhash, err := solanago.HashFromBase58(blockhash)
	if err != nil {
		return nil, fmt.Errorf("decode blockhash: %w", err)
	}

	solanaInstructions := make([]solanago.Instruction, 0, len(instructions))
	for i, ix := range instructions {
		solanaInstruction, err := toSolanaInstruction(ix)
		if err != nil {
			return nil, fmt.Errorf("instruction %d: %w", i, err)
		}
		solanaInstructions = append(solanaInstructions, solanaInstruction)
	}

	tx, err := solanago.NewTransaction(
		solanaInstructions,
		recentBlockhash,
		solanago.TransactionPayer(kp.PublicKey),
	)
	if err != nil {
		return nil, fmt.Errorf("create transaction: %w", err)
	}

	if _, err := tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(kp.PublicKey) {
			return &kp.PrivateKey
		}
		return nil
	}); err != nil {
		return nil, fmt.Errorf("sign transaction: %w", err)
	}

	txBytes, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("serialize transaction: %w", err)
	}
	return txBytes, nil
}

func toSolanaInstruction(ix Instruction) (solanago.Instruction, error) {
	programID, err := solanago.PublicKeyFromBase58(ix.ProgramID)
	if err != nil {
		return nil, fmt.Errorf("decode program id %q: %w", ix.ProgramID, err)
	}

	accounts := make(solanago.AccountMetaSlice, 0, len(ix.Keys))
	for i, key := range ix.Keys {
		pubkey, err := solanago.PublicKeyFromBase58(key.Pubkey)
		if err != nil {
			return nil, fmt.Errorf("decode account %d pubkey %q: %w", i, key.Pubkey, err)
		}
		accounts = append(accounts, solanago.NewAccountMeta(pubkey, key.IsWritable, key.IsSigner))
	}

	return solanago.NewInstruction(programID, accounts, ix.DataBytes()), nil
}

// GetLatestBlockhash fetches the latest blockhash from the Solana RPC.
func GetLatestBlockhash(ctx context.Context, rpcURL string) (string, error) {
	client := rpc.New(rpcURL)
	defer client.Close()

	result, err := client.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
	if err != nil {
		return "", err
	}
	if result == nil || result.Value == nil {
		return "", fmt.Errorf("latest blockhash response was empty")
	}
	return result.Value.Blockhash.String(), nil
}

// SendTransaction submits a signed transaction to Solana RPC.
// Returns the transaction signature (base58) on success.
func SendTransaction(ctx context.Context, rpcURL string, txBytes []byte) (string, error) {
	tx, err := solanago.TransactionFromBytes(txBytes)
	if err != nil {
		return "", fmt.Errorf("decode transaction: %w", err)
	}

	client := rpc.New(rpcURL)
	defer client.Close()

	signature, err := client.SendTransactionWithOpts(ctx, tx, rpc.TransactionOpts{
		SkipPreflight:       false,
		PreflightCommitment: rpc.CommitmentConfirmed,
	})
	if err != nil {
		return "", err
	}
	return signature.String(), nil
}

// SignAndSend is a convenience wrapper: fetches blockhash, signs instructions, submits tx.
func SignAndSend(ctx context.Context, kp *Keypair, instructions []Instruction, rpcURL string) (string, error) {
	blockhash, err := GetLatestBlockhash(ctx, rpcURL)
	if err != nil {
		return "", fmt.Errorf("get blockhash: %w", err)
	}
	txBytes, err := BuildAndSign(kp, instructions, blockhash)
	if err != nil {
		return "", fmt.Errorf("build tx: %w", err)
	}
	return SendTransaction(ctx, rpcURL, txBytes)
}
