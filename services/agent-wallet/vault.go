// Package agentwallet provides an agentic wallet vault service.
// Manages encrypted Solana + EVM keypairs, exposes HTTP API endpoints,
// and can deploy itself into E2B sandboxes for remote agent access.
package agentwallet

import (
	"bytes"
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
	Nonce        string    `json:"nonce"`         // GCM nonce
	CreatedAt    time.Time `json:"created_at"`
	Paused       bool      `json:"paused"`
}

// Vault manages encrypted wallet storage.
type Vault struct {
	mu        sync.RWMutex
	wallets   map[string]*WalletEntry
	masterKey []byte // 32-byte AES key derived from passphrase
	kdf       kdfHeader
	storePath string
	// loadFailed is set when an existing vault file could not be decrypted
	// (e.g. wrong passphrase). Saves are then refused so the unreadable file
	// is never overwritten with an empty vault.
	loadFailed bool
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

	v := &Vault{
		wallets:   make(map[string]*WalletEntry),
		storePath: cfg.StorePath,
	}

	// Existing vaults keep the KDF recorded in their header (legacy files have
	// none and stay on SHA-256 until `agent-wallet migrate-kdf` is run). New
	// vaults use argon2id with a random salt.
	if raw, err := os.ReadFile(v.vaultFile()); err == nil {
		var hdr struct {
			kdfHeader
		}
		_ = json.Unmarshal(raw, &hdr)
		v.kdf = hdr.kdfHeader
	} else if os.IsNotExist(err) {
		hdr, err := newKDFHeader()
		if err != nil {
			return nil, err
		}
		v.kdf = hdr
	} else {
		return nil, fmt.Errorf("read vault: %w", err)
	}
	key, err := deriveKeyWith(cfg.Passphrase, v.kdf)
	if err != nil {
		return nil, fmt.Errorf("derive vault key: %w", err)
	}
	v.masterKey = key

	// Load existing wallets
	if err := v.load(); err != nil {
		if !os.IsNotExist(err) {
			v.loadFailed = true
			log.Printf("[VAULT] ⚠️  Existing vault could not be loaded; refusing to overwrite it: %v", err)
		} else {
			log.Printf("[VAULT] ⚠️  No existing vault data: %v", err)
		}
	}
	if v.kdf.isLegacy() && !v.loadFailed && len(v.wallets) > 0 {
		log.Printf("[VAULT] ℹ️  Vault uses the legacy SHA-256 KDF; run `agent-wallet migrate-kdf` to re-encrypt with argon2id")
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

// vaultEnvelope is the on-disk format. kdfHeader fields are omitempty, so a
// legacy vault is written exactly as before: {"data":…,"nonce":…}.
type vaultEnvelope struct {
	kdfHeader
	Data  string `json:"data"`
	Nonce string `json:"nonce"`
}

func (v *Vault) saveLocked() error {
	if v.loadFailed {
		return fmt.Errorf("vault file exists but could not be decrypted; refusing to overwrite it")
	}
	data, err := json.MarshalIndent(v.wallets, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal vault: %w", err)
	}

	// Encrypt the entire vault file
	ciphertext, nonce, err := v.encrypt(data)
	if err != nil {
		return fmt.Errorf("encrypt vault: %w", err)
	}

	envData, err := json.Marshal(vaultEnvelope{
		kdfHeader: v.kdf,
		Data:      hex.EncodeToString(ciphertext),
		Nonce:     hex.EncodeToString(nonce),
	})
	if err != nil {
		return fmt.Errorf("marshal vault envelope: %w", err)
	}

	return writeFileAtomic(v.vaultFile(), envData, 0o600)
}

func (v *Vault) load() error {
	raw, err := os.ReadFile(v.vaultFile())
	if err != nil {
		return err
	}

	var envelope vaultEnvelope
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

// MigrateVaultKDF re-encrypts a legacy (SHA-256 KDF) vault with argon2id.
// It is opt-in only (`agent-wallet migrate-kdf`); nothing calls it
// automatically. A copy of the legacy file is kept as
// wallets.enc.json.legacy-<unix>.bak (still encrypted). Returns migrated=false
// when there is no vault or it already uses argon2id.
func MigrateVaultKDF(cfg VaultConfig) (migrated bool, backup string, err error) {
	old, err := NewVault(cfg)
	if err != nil {
		return false, "", err
	}
	if _, statErr := os.Stat(old.vaultFile()); os.IsNotExist(statErr) {
		return false, "", nil
	}
	if old.loadFailed {
		return false, "", fmt.Errorf("cannot migrate: vault could not be decrypted with the configured passphrase")
	}
	if !old.kdf.isLegacy() {
		return false, "", nil
	}

	hdr, err := newKDFHeader()
	if err != nil {
		return false, "", err
	}
	newKey, err := deriveKeyWith(cfg.Passphrase, hdr)
	if err != nil {
		return false, "", err
	}
	next := &Vault{wallets: make(map[string]*WalletEntry), masterKey: newKey, kdf: hdr, storePath: old.storePath}

	plain := make(map[string][]byte, len(old.wallets))
	defer func() {
		for _, b := range plain {
			for i := range b {
				b[i] = 0
			}
		}
	}()
	for id, w := range old.wallets {
		ct, err := hex.DecodeString(w.EncryptedKey)
		if err != nil {
			return false, "", fmt.Errorf("wallet %s: decode ciphertext: %w", id, err)
		}
		nonce, err := hex.DecodeString(w.Nonce)
		if err != nil {
			return false, "", fmt.Errorf("wallet %s: decode nonce: %w", id, err)
		}
		pk, err := old.decrypt(ct, nonce)
		if err != nil {
			return false, "", fmt.Errorf("wallet %s: decrypt: %w", id, err)
		}
		plain[id] = pk
		nct, nnonce, err := next.encrypt(pk)
		if err != nil {
			return false, "", fmt.Errorf("wallet %s: re-encrypt: %w", id, err)
		}
		entry := *w
		entry.EncryptedKey = hex.EncodeToString(nct)
		entry.Nonce = hex.EncodeToString(nnonce)
		next.wallets[id] = &entry
	}

	backup, err = backupFile(old.vaultFile())
	if err != nil {
		return false, "", fmt.Errorf("backup legacy vault: %w", err)
	}
	if err := next.saveLocked(); err != nil {
		return false, backup, fmt.Errorf("write migrated vault (legacy backup kept at %s): %w", backup, err)
	}

	// Verify: reopen and check every key decrypts to the same bytes.
	check, err := NewVault(cfg)
	if err != nil || check.loadFailed || check.kdf.KDF != kdfArgon2id || len(check.wallets) != len(plain) {
		return false, backup, fmt.Errorf("verification of migrated vault failed; restore from %s", backup)
	}
	for id, want := range plain {
		got, err := check.decryptEntry(id)
		if err != nil || !bytes.Equal(got, want) {
			return false, backup, fmt.Errorf("verification of wallet %s failed; restore from %s", id, backup)
		}
	}
	return true, backup, nil
}

// decryptEntry decrypts a wallet's key regardless of its paused state.
func (v *Vault) decryptEntry(id string) ([]byte, error) {
	v.mu.RLock()
	w, ok := v.wallets[id]
	v.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("wallet %s not found", id)
	}
	ct, err := hex.DecodeString(w.EncryptedKey)
	if err != nil {
		return nil, err
	}
	nonce, err := hex.DecodeString(w.Nonce)
	if err != nil {
		return nil, err
	}
	return v.decrypt(ct, nonce)
}
