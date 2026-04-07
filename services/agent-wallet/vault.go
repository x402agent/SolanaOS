// Package agentwallet provides an agentic wallet vault service.
// Manages encrypted Solana + EVM keypairs, exposes HTTP API endpoints,
// and can deploy itself into E2B sandboxes for remote agent access.
package agentwallet

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ChainType identifies the blockchain family.
type ChainType string

const (
	ChainSolana ChainType = "solana"
	ChainEVM    ChainType = "evm"
)

// WalletEntry is an encrypted wallet record in the vault.
type WalletEntry struct {
	ID           string    `json:"id"`
	Label        string    `json:"label"`
	ChainType    ChainType `json:"chain_type"`
	ChainID      int       `json:"chain_id"`
	Address      string    `json:"address"`
	EncryptedKey string    `json:"encrypted_key"` // AES-256-GCM encrypted private key
	Nonce        string    `json:"nonce"`          // GCM nonce
	CreatedAt    time.Time `json:"created_at"`
	Paused       bool      `json:"paused"`
}

// Vault manages encrypted wallet storage.
type Vault struct {
	mu         sync.RWMutex
	wallets    map[string]*WalletEntry
	masterKey  []byte // 32-byte AES key derived from passphrase
	storePath  string
}

// VaultConfig configures the wallet vault.
type VaultConfig struct {
	StorePath  string // directory for vault data
	Passphrase string // master encryption passphrase
}

// DefaultVaultConfig returns config from environment.
func DefaultVaultConfig() VaultConfig {
	home, _ := os.UserHomeDir()
	passphrase := os.Getenv("VAULT_PASSPHRASE")
	if passphrase == "" {
		passphrase = os.Getenv("SOLANA_PRIVATE_KEY") // fallback derivation seed
	}
	if passphrase == "" {
		passphrase = "solanaos-agent-vault-default"
	}
	return VaultConfig{
		StorePath:  filepath.Join(home, ".solanaos", "vault"),
		Passphrase: passphrase,
	}
}

// NewVault creates or loads a wallet vault.
func NewVault(cfg VaultConfig) (*Vault, error) {
	if err := os.MkdirAll(cfg.StorePath, 0o700); err != nil {
		return nil, fmt.Errorf("create vault dir: %w", err)
	}

	// Derive 32-byte master key from passphrase via SHA-256
	hash := sha256.Sum256([]byte(cfg.Passphrase))

	v := &Vault{
		wallets:   make(map[string]*WalletEntry),
		masterKey: hash[:],
		storePath: cfg.StorePath,
	}

	// Load existing wallets
	if err := v.load(); err != nil {
		log.Printf("[VAULT] ⚠️  No existing vault data: %v", err)
	}

	log.Printf("[VAULT] 🔐 Vault initialized (%d wallets) at %s", len(v.wallets), cfg.StorePath)
	return v, nil
}

// encrypt encrypts plaintext with AES-256-GCM using the master key.
func (v *Vault) encrypt(plaintext []byte) (ciphertext, nonce []byte, err error) {
	block, err := aes.NewCipher(v.masterKey)
	if err != nil {
		return nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// decrypt decrypts AES-256-GCM ciphertext with the master key.
func (v *Vault) decrypt(ciphertext, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(v.masterKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return gcm.Open(nil, nonce, ciphertext, nil)
}

// AddWallet stores a new wallet with encrypted private key.
func (v *Vault) AddWallet(id, label string, chainType ChainType, chainID int, address string, privateKey []byte) error {
	ciphertext, nonce, err := v.encrypt(privateKey)
	if err != nil {
		return fmt.Errorf("encrypt key: %w", err)
	}

	entry := &WalletEntry{
		ID:           id,
		Label:        label,
		ChainType:    chainType,
		ChainID:      chainID,
		Address:      address,
		EncryptedKey: hex.EncodeToString(ciphertext),
		Nonce:        hex.EncodeToString(nonce),
		CreatedAt:    time.Now(),
	}

	v.mu.Lock()
	v.wallets[id] = entry
	v.mu.Unlock()

	return v.save()
}

// GetWallet returns a wallet entry by ID.
func (v *Vault) GetWallet(id string) (*WalletEntry, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()

	w, ok := v.wallets[id]
	if !ok {
		return nil, fmt.Errorf("wallet %s not found", id)
	}
	return w, nil
}

// GetPrivateKey decrypts and returns the private key for a wallet.
func (v *Vault) GetPrivateKey(id string) ([]byte, error) {
	v.mu.RLock()
	w, ok := v.wallets[id]
	v.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("wallet %s not found", id)
	}
	if w.Paused {
		return nil, fmt.Errorf("wallet %s is paused", id)
	}

	ciphertext, err := hex.DecodeString(w.EncryptedKey)
	if err != nil {
		return nil, fmt.Errorf("decode ciphertext: %w", err)
	}
	nonce, err := hex.DecodeString(w.Nonce)
	if err != nil {
		return nil, fmt.Errorf("decode nonce: %w", err)
	}

	return v.decrypt(ciphertext, nonce)
}

// ListWallets returns all wallet entries (without private keys).
func (v *Vault) ListWallets() []*WalletEntry {
	v.mu.RLock()
	defer v.mu.RUnlock()

	result := make([]*WalletEntry, 0, len(v.wallets))
	for _, w := range v.wallets {
		result = append(result, w)
	}
	return result
}

// PauseWallet freezes a wallet.
func (v *Vault) PauseWallet(id string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	w, ok := v.wallets[id]
	if !ok {
		return fmt.Errorf("wallet %s not found", id)
	}
	w.Paused = true
	return v.saveLocked()
}

// UnpauseWallet unfreezes a wallet.
func (v *Vault) UnpauseWallet(id string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	w, ok := v.wallets[id]
	if !ok {
		return fmt.Errorf("wallet %s not found", id)
	}
	w.Paused = false
	return v.saveLocked()
}

// DeleteWallet removes a wallet from the vault.
func (v *Vault) DeleteWallet(id string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if _, ok := v.wallets[id]; !ok {
		return fmt.Errorf("wallet %s not found", id)
	}
	delete(v.wallets, id)
	return v.saveLocked()
}

// GenerateEVMKeypair creates a new ECDSA keypair for EVM chains.
func GenerateEVMKeypair() (*ecdsa.PrivateKey, string, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, "", err
	}
	// Keccak-256 address derivation (simplified — use secp256k1 in production)
	pubBytes := elliptic.Marshal(key.Curve, key.PublicKey.X, key.PublicKey.Y)
	hash := sha256.Sum256(pubBytes[1:]) // skip 0x04 prefix
	address := "0x" + hex.EncodeToString(hash[12:])
	return key, address, nil
}

// GenerateID creates a random hex wallet ID.
func GenerateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ── Persistence ──────────────────────────────────────────────────

func (v *Vault) vaultFile() string {
	return filepath.Join(v.storePath, "wallets.enc.json")
}

func (v *Vault) save() error {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.saveLocked()
}

func (v *Vault) saveLocked() error {
	data, err := json.MarshalIndent(v.wallets, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal vault: %w", err)
	}

	// Encrypt the entire vault file
	ciphertext, nonce, err := v.encrypt(data)
	if err != nil {
		return fmt.Errorf("encrypt vault: %w", err)
	}

	envelope := map[string]string{
		"data":  hex.EncodeToString(ciphertext),
		"nonce": hex.EncodeToString(nonce),
	}
	envData, _ := json.Marshal(envelope)

	return os.WriteFile(v.vaultFile(), envData, 0o600)
}

func (v *Vault) load() error {
	raw, err := os.ReadFile(v.vaultFile())
	if err != nil {
		return err
	}

	var envelope struct {
		Data  string `json:"data"`
		Nonce string `json:"nonce"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return fmt.Errorf("decode vault envelope: %w", err)
	}

	ciphertext, err := hex.DecodeString(envelope.Data)
	if err != nil {
		return fmt.Errorf("decode vault data: %w", err)
	}
	nonce, err := hex.DecodeString(envelope.Nonce)
	if err != nil {
		return fmt.Errorf("decode vault nonce: %w", err)
	}

	plaintext, err := v.decrypt(ciphertext, nonce)
	if err != nil {
		return fmt.Errorf("decrypt vault: %w", err)
	}

	return json.Unmarshal(plaintext, &v.wallets)
}
