package agentwallet

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
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
// signerEnvelope is the on-disk key file. Legacy files have no kdfHeader
// fields (SHA-256 KDF); new files carry argon2id parameters.
type signerEnvelope struct {
	kdfHeader
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
			if err := saveEncryptedKey(keyFile, cfg.Passphrase, []byte(pk)); err != nil {
				log.Printf("[LOCAL-SIGNER] ⚠️  Could not persist key to disk: %v", err)
			}
		}

		log.Printf("[LOCAL-SIGNER] 🔑 %s signer loaded from env: %s", cfg.Mode, s.pubkey.String())
		return s, nil
	}

	// Try loading from disk
	if raw, err := os.ReadFile(keyFile); err == nil {
		privKeyBytes, legacy, err := loadEncryptedKey(raw, cfg.Passphrase)
		if err != nil {
			return nil, fmt.Errorf("decrypt %s key: %w", cfg.Mode, err)
		}
		if legacy {
			log.Printf("[LOCAL-SIGNER] ℹ️  %s key file uses the legacy SHA-256 KDF; run `agent-wallet migrate-kdf` to re-encrypt with argon2id", cfg.Mode)
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

	if err := saveEncryptedKey(keyFile, cfg.Passphrase, []byte(wallet.PrivateKey)); err != nil {
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

// saveEncryptedKey encrypts privKeyBytes with AES-256-GCM under an argon2id
// key (fresh random salt) and writes a versioned envelope atomically.
func saveEncryptedKey(path, passphrase string, privKeyBytes []byte) error {
	hdr, err := newKDFHeader()
	if err != nil {
		return err
	}
	return saveEncryptedKeyWith(path, passphrase, hdr, privKeyBytes)
}

func saveEncryptedKeyWith(path, passphrase string, hdr kdfHeader, privKeyBytes []byte) error {
	masterKey, err := deriveKeyWith(passphrase, hdr)
	if err != nil {
		return err
	}
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
		kdfHeader: hdr,
		Data:      hex.EncodeToString(ciphertext),
		Nonce:     hex.EncodeToString(nonce),
	}
	data, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		return err
	}

	return writeFileAtomic(path, data, 0o600)
}

// loadEncryptedKey decrypts an envelope using the KDF recorded in its header
// (legacy envelopes without a header use SHA-256). legacy reports which.
func loadEncryptedKey(raw []byte, passphrase string) (key []byte, legacy bool, err error) {
	var env signerEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, false, fmt.Errorf("decode envelope: %w", err)
	}

	ciphertext, err := hex.DecodeString(env.Data)
	if err != nil {
		return nil, false, fmt.Errorf("decode ciphertext: %w", err)
	}
	nonce, err := hex.DecodeString(env.Nonce)
	if err != nil {
		return nil, false, fmt.Errorf("decode nonce: %w", err)
	}

	masterKey, err := deriveKeyWith(passphrase, env.kdfHeader)
	if err != nil {
		return nil, false, err
	}
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, false, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, false, err
	}

	pt, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, false, err
	}
	return pt, env.isLegacy(), nil
}

// MigrateLocalSignerKDF re-encrypts a legacy <mode>.enc key file with
// argon2id. Opt-in only (`agent-wallet migrate-kdf`). The legacy file is kept
// as <mode>.enc.legacy-<unix>.bak. Returns migrated=false if there is no file
// or it is already argon2id.
func MigrateLocalSignerKDF(cfg LocalSignerConfig) (migrated bool, backup string, err error) {
	keyFile := filepath.Join(cfg.StorePath, string(cfg.Mode)+".enc")
	raw, err := os.ReadFile(keyFile)
	if os.IsNotExist(err) {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}
	pk, legacy, err := loadEncryptedKey(raw, cfg.Passphrase)
	if err != nil {
		return false, "", fmt.Errorf("decrypt %s key: %w", cfg.Mode, err)
	}
	defer func() {
		for i := range pk {
			pk[i] = 0
		}
	}()
	if !legacy {
		return false, "", nil
	}
	backup, err = backupFile(keyFile)
	if err != nil {
		return false, "", fmt.Errorf("backup legacy %s key: %w", cfg.Mode, err)
	}
	if err := saveEncryptedKey(keyFile, cfg.Passphrase, pk); err != nil {
		return false, backup, fmt.Errorf("write migrated %s key (legacy backup kept at %s): %w", cfg.Mode, backup, err)
	}
	raw2, err := os.ReadFile(keyFile)
	if err != nil {
		return false, backup, fmt.Errorf("verify migrated %s key; restore from %s: %w", cfg.Mode, backup, err)
	}
	got, legacy2, err := loadEncryptedKey(raw2, cfg.Passphrase)
	if err != nil || legacy2 || !bytes.Equal(got, pk) {
		return false, backup, fmt.Errorf("verification of migrated %s key failed; restore from %s", cfg.Mode, backup)
	}
	return true, backup, nil
}

// ── LocalSignerManager ───────────────────────────────────────────

// LocalSignerManager holds dev and trade signers.
type LocalSignerManager struct {
	Dev   *LocalSigner
	Trade *LocalSigner
}

// DefaultLocalSignerConfigs returns the dev and trade signer configs exactly as
// NewLocalSignerManager resolves them (trade may use TRADE_SIGNER_PASSPHRASE).
func DefaultLocalSignerConfigs() (dev, trade LocalSignerConfig) {
	dev = DefaultLocalSignerConfig(SignerModeDev)
	trade = DefaultLocalSignerConfig(SignerModeTrade)
	if tp := os.Getenv("TRADE_SIGNER_PASSPHRASE"); tp != "" {
		trade.Passphrase = tp
	}
	return dev, trade
}

// NewLocalSignerManager creates both dev and trade signers from environment config.
func NewLocalSignerManager() (*LocalSignerManager, error) {
	devCfg, tradeCfg := DefaultLocalSignerConfigs()

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
