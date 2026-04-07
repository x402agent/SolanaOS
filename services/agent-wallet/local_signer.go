package agentwallet

import (
	"crypto/aes"
	"crypto/cipher"
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

	solanago "github.com/gagliardetto/solana-go"
)

// SignerMode identifies what the signer is used for.
type SignerMode string

const (
	SignerModeDev   SignerMode = "dev"   // devnet / local development
	SignerModeTrade SignerMode = "trade" // mainnet trading
)

// LocalSigner is an AES-256-GCM encrypted Solana signing key stored on disk.
// It follows the solana-keychain SolanaSigner interface pattern but is purely
// local — no cloud HSM or managed wallet service required.
//
// Key file layout (~/.solanaos/signers/<name>.enc):
//
//	{ "data": "<hex ciphertext>", "nonce": "<hex nonce>" }
//
// The plaintext is the raw 64-byte ed25519 private key (Solana format).
type LocalSigner struct {
	name      SignerMode
	pubkey    solanago.PublicKey
	privKey   solanago.PrivateKey
	storePath string
	mu        sync.RWMutex
}

// signerEnvelope is the on-disk JSON format.
type signerEnvelope struct {
	Data  string `json:"data"`
	Nonce string `json:"nonce"`
}

// LocalSignerConfig configures a local signer.
type LocalSignerConfig struct {
	Mode       SignerMode // "dev" or "trade"
	StorePath  string     // directory for .enc files; defaults to ~/.solanaos/signers
	Passphrase string     // master passphrase; falls back to env vars if empty
}

// DefaultLocalSignerConfig reads configuration from environment.
func DefaultLocalSignerConfig(mode SignerMode) LocalSignerConfig {
	home, _ := os.UserHomeDir()
	storePath := os.Getenv("LOCAL_SIGNER_PATH")
	if storePath == "" {
		storePath = filepath.Join(home, ".solanaos", "signers")
	}

	passphrase := os.Getenv("LOCAL_SIGNER_PASSPHRASE")
	if passphrase == "" {
		passphrase = os.Getenv("VAULT_PASSPHRASE")
	}
	if passphrase == "" {
		passphrase = "solanaos-local-signer-default"
	}

	return LocalSignerConfig{
		Mode:       mode,
		StorePath:  storePath,
		Passphrase: passphrase,
	}
}

// NewLocalSigner loads an existing encrypted keypair or generates a fresh one.
// The keypair is persisted to StorePath/<mode>.enc encrypted with AES-256-GCM.
func NewLocalSigner(cfg LocalSignerConfig) (*LocalSigner, error) {
	if err := os.MkdirAll(cfg.StorePath, 0o700); err != nil {
		return nil, fmt.Errorf("create signer dir: %w", err)
	}

	masterKey := deriveKey(cfg.Passphrase)
	s := &LocalSigner{
		name:      cfg.Mode,
		storePath: cfg.StorePath,
	}

	keyFile := filepath.Join(cfg.StorePath, string(cfg.Mode)+".enc")

	// Try loading from env var first (base58 private key)
	envKey := os.Getenv("LOCAL_SIGNER_" + string(cfg.Mode) + "_KEY")
	if envKey == "" {
		envKey = os.Getenv("SOLANA_PRIVATE_KEY")
	}

	if envKey != "" {
		pk, err := solanago.PrivateKeyFromBase58(envKey)
		if err != nil {
			return nil, fmt.Errorf("invalid private key in env: %w", err)
		}
		s.privKey = pk
		s.pubkey = pk.PublicKey()

		// Persist to disk if not already there
		if _, err := os.Stat(keyFile); os.IsNotExist(err) {
			if err := saveEncryptedKey(keyFile, masterKey, []byte(pk)); err != nil {
				log.Printf("[LOCAL-SIGNER] ⚠️  Could not persist key to disk: %v", err)
			}
		}

		log.Printf("[LOCAL-SIGNER] 🔑 %s signer loaded from env: %s", cfg.Mode, s.pubkey.String())
		return s, nil
	}

	// Try loading from disk
	if raw, err := os.ReadFile(keyFile); err == nil {
		privKeyBytes, err := loadEncryptedKey(raw, masterKey)
		if err != nil {
			return nil, fmt.Errorf("decrypt %s key: %w", cfg.Mode, err)
		}
		s.privKey = solanago.PrivateKey(privKeyBytes)
		s.pubkey = s.privKey.PublicKey()
		log.Printf("[LOCAL-SIGNER] 🔑 %s signer loaded from disk: %s", cfg.Mode, s.pubkey.String())
		return s, nil
	}

	// Generate a fresh keypair
	wallet := solanago.NewWallet()
	s.privKey = wallet.PrivateKey
	s.pubkey = wallet.PublicKey()

	if err := saveEncryptedKey(keyFile, masterKey, []byte(wallet.PrivateKey)); err != nil {
		return nil, fmt.Errorf("save %s key: %w", cfg.Mode, err)
	}

	log.Printf("[LOCAL-SIGNER] ✨ %s signer generated: %s (saved to %s)", cfg.Mode, s.pubkey.String(), keyFile)
	return s, nil
}

// Pubkey returns the signer's public key as a base58 string.
func (s *LocalSigner) Pubkey() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.pubkey.String()
}

// PublicKey returns the native solanago.PublicKey.
func (s *LocalSigner) PublicKey() solanago.PublicKey {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.pubkey
}

// PrivateKey returns the native solanago.PrivateKey.
// Callers MUST zeroize the returned bytes after use.
func (s *LocalSigner) PrivateKey() solanago.PrivateKey {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.privKey
}

// SignMessage signs arbitrary bytes and returns a base58-encoded signature.
func (s *LocalSigner) SignMessage(msg []byte) (string, error) {
	s.mu.RLock()
	pk := s.privKey
	s.mu.RUnlock()

	sig, err := pk.Sign(msg)
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}
	return sig.String(), nil
}

// Mode returns the signer mode ("dev" or "trade").
func (s *LocalSigner) Mode() SignerMode {
	return s.name
}

// ── AES-256-GCM helpers ──────────────────────────────────────────

// deriveKey derives a 32-byte AES key from a passphrase via SHA-256.
func deriveKey(passphrase string) []byte {
	h := sha256.Sum256([]byte(passphrase))
	return h[:]
}

// saveEncryptedKey encrypts privKeyBytes with AES-256-GCM and writes to path.
func saveEncryptedKey(path string, masterKey, privKeyBytes []byte) error {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}

	ciphertext := gcm.Seal(nil, nonce, privKeyBytes, nil)

	env := signerEnvelope{
		Data:  hex.EncodeToString(ciphertext),
		Nonce: hex.EncodeToString(nonce),
	}
	data, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o600)
}

// loadEncryptedKey decrypts AES-256-GCM key data from an envelope.
func loadEncryptedKey(raw, masterKey []byte) ([]byte, error) {
	var env signerEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("decode envelope: %w", err)
	}

	ciphertext, err := hex.DecodeString(env.Data)
	if err != nil {
		return nil, fmt.Errorf("decode ciphertext: %w", err)
	}
	nonce, err := hex.DecodeString(env.Nonce)
	if err != nil {
		return nil, fmt.Errorf("decode nonce: %w", err)
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return gcm.Open(nil, nonce, ciphertext, nil)
}

// ── LocalSignerManager ───────────────────────────────────────────

// LocalSignerManager holds dev and trade signers.
type LocalSignerManager struct {
	Dev   *LocalSigner
	Trade *LocalSigner
}

// NewLocalSignerManager creates both dev and trade signers from environment config.
func NewLocalSignerManager() (*LocalSignerManager, error) {
	devCfg := DefaultLocalSignerConfig(SignerModeDev)
	tradeCfg := DefaultLocalSignerConfig(SignerModeTrade)

	// Trade signer uses a separate passphrase if set
	if tp := os.Getenv("TRADE_SIGNER_PASSPHRASE"); tp != "" {
		tradeCfg.Passphrase = tp
	}

	dev, err := NewLocalSigner(devCfg)
	if err != nil {
		return nil, fmt.Errorf("dev signer: %w", err)
	}

	trade, err := NewLocalSigner(tradeCfg)
	if err != nil {
		return nil, fmt.Errorf("trade signer: %w", err)
	}

	return &LocalSignerManager{Dev: dev, Trade: trade}, nil
}

// Get returns the signer for the given mode.
func (m *LocalSignerManager) Get(mode SignerMode) *LocalSigner {
	switch mode {
	case SignerModeTrade:
		return m.Trade
	default:
		return m.Dev
	}
}
