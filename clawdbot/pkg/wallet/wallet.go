// Package wallet provides local Solana keypair helpers for ClawdBot agents.
package wallet

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/mr-tron/base58"
)

// Keypair holds a solana-go private key and its corresponding public key.
type Keypair struct {
	PrivateKey solanago.PrivateKey
	PublicKey  solanago.PublicKey
}

// Generate creates a fresh ed25519 keypair suitable for Solana.
func Generate() (*Keypair, error) {
	privateKey, err := solanago.NewRandomPrivateKey()
	if err != nil {
		return nil, fmt.Errorf("generate keypair: %w", err)
	}
	return keypairFromPrivateKey(privateKey)
}

// Load reads a Solana CLI keypair JSON file.
func Load(path string) (*Keypair, error) {
	privateKey, err := solanago.PrivateKeyFromSolanaKeygenFile(path)
	if err == nil {
		return keypairFromPrivateKey(privateKey)
	}

	data, readErr := os.ReadFile(path)
	if readErr != nil {
		return nil, fmt.Errorf("read keypair %s: %w", path, readErr)
	}
	secret, parseErr := parseSecret(data)
	if parseErr != nil {
		return nil, parseErr
	}
	kp, fromSecretErr := FromSecret(secret)
	if fromSecretErr != nil {
		return nil, fromSecretErr
	}
	return kp, nil
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

// FromSecret builds a keypair from a 64-byte Solana secret key.
func FromSecret(secret []byte) (*Keypair, error) {
	privateKey := solanago.PrivateKey(append([]byte(nil), secret...))
	kp, err := keypairFromPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("keypair must be %d bytes and match its seed: %w", solanago.PrivateKeyLength, err)
	}
	return kp, nil
}

// Ensure returns the existing keypair at path or creates one when missing.
func Ensure(path string) (*Keypair, bool, error) {
	if strings.TrimSpace(path) == "" {
		return nil, false, fmt.Errorf("keypair path is required")
	}
	if existing, err := Load(path); err == nil {
		return existing, false, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, false, err
	}
	kp, err := Generate()
	if err != nil {
		return nil, false, err
	}
	if err := Save(path, kp, false); err != nil {
		return nil, false, err
	}
	return kp, true, nil
}

// Save writes the keypair in Solana CLI JSON-array format with 0600 permissions.
func Save(path string, kp *Keypair, overwrite bool) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("keypair path is required")
	}
	if kp == nil || kp.PrivateKey.Validate() != nil {
		return fmt.Errorf("valid keypair is required")
	}
	if !overwrite {
		if _, err := os.Stat(path); err == nil {
			return fmt.Errorf("keypair already exists at %s", path)
		} else if !os.IsNotExist(err) {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	values := make([]int, len(kp.PrivateKey))
	for i, b := range kp.PrivateKey {
		values[i] = int(b)
	}
	data, err := json.Marshal(values)
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

// Pubkey returns the base58 Solana public key.
func (kp *Keypair) Pubkey() string {
	if kp == nil {
		return ""
	}
	return kp.PublicKey.String()
}

// IsValidPubkey reports whether value is a base58-encoded 32-byte public key.
func IsValidPubkey(value string) bool {
	_, err := solanago.PublicKeyFromBase58(strings.TrimSpace(value))
	return err == nil
}

// Base58Decode decodes a Bitcoin/Solana base58 string.
func Base58Decode(s string) ([]byte, error) {
	return base58.Decode(s)
}

// Base58Encode encodes bytes with the Bitcoin/Solana base58 alphabet.
func Base58Encode(b []byte) string {
	return base58.Encode(b)
}

func parseSecret(data []byte) ([]byte, error) {
	var bytes64 []byte
	if err := json.Unmarshal(data, &bytes64); err == nil {
		return bytes64, nil
	}
	var ints []int
	if err := json.Unmarshal(data, &ints); err != nil {
		return nil, fmt.Errorf("parse keypair: %w", err)
	}
	bytes64 = make([]byte, len(ints))
	for i, v := range ints {
		if v < 0 || v > 255 {
			return nil, fmt.Errorf("keypair byte %d out of range: %d", i, v)
		}
		bytes64[i] = byte(v)
	}
	return bytes64, nil
}
