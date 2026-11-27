package agentwallet

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/argon2"
)

// Key-derivation versioning for encrypted wallet files.
//
// Legacy files (written before this change) have no "kdf" field and use
// SHA-256(passphrase) as the AES-256-GCM key. They keep loading unchanged and
// are only re-encrypted when the operator explicitly runs `agent-wallet
// migrate-kdf` (see MigrateVaultKDF / MigrateLocalSignerKDF).
//
// Newly created files use argon2id with a random per-file salt, recorded in
// the envelope header:
//
//	{"v":2,"kdf":"argon2id","salt":"<hex>","t":3,"m":65536,"p":4,"data":"…","nonce":"…"}

const (
	kdfLegacySHA256 = "" // absent field == legacy
	kdfArgon2id     = "argon2id"

	envelopeVersionArgon2 = 2
)

// argon2Defaults follow RFC 9106 §4 second recommended option (64 MiB, t=3, p=4).
// It is a variable only so tests can use cheaper parameters.
var argon2Defaults = kdfHeader{
	Version:   envelopeVersionArgon2,
	KDF:       kdfArgon2id,
	Time:      3,
	MemoryKiB: 64 * 1024,
	Threads:   4,
}

// kdfHeader is embedded in every on-disk envelope. All fields are omitempty so
// legacy envelopes round-trip byte-compatible.
type kdfHeader struct {
	Version   int    `json:"v,omitempty"`
	KDF       string `json:"kdf,omitempty"`
	Salt      string `json:"salt,omitempty"`
	Time      uint32 `json:"t,omitempty"`
	MemoryKiB uint32 `json:"m,omitempty"`
	Threads   uint8  `json:"p,omitempty"`
}

func (h kdfHeader) isLegacy() bool { return h.KDF == kdfLegacySHA256 }

// newKDFHeader returns argon2id parameters with a fresh random salt.
func newKDFHeader() (kdfHeader, error) {
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return kdfHeader{}, fmt.Errorf("generate salt: %w", err)
	}
	h := argon2Defaults
	h.Salt = hex.EncodeToString(salt)
	return h, nil
}

// deriveKeyWith derives the 32-byte AES key described by h.
func deriveKeyWith(passphrase string, h kdfHeader) ([]byte, error) {
	switch h.KDF {
	case kdfLegacySHA256:
		sum := sha256.Sum256([]byte(passphrase))
		return sum[:], nil
	case kdfArgon2id:
		salt, err := hex.DecodeString(h.Salt)
		if err != nil || len(salt) < 16 {
			return nil, fmt.Errorf("invalid argon2id salt")
		}
		if h.Time == 0 || h.MemoryKiB == 0 || h.Threads == 0 {
			return nil, fmt.Errorf("invalid argon2id parameters")
		}
		return argon2.IDKey([]byte(passphrase), salt, h.Time, h.MemoryKiB, h.Threads, 32), nil
	default:
		return nil, fmt.Errorf("unsupported kdf %q", h.KDF)
	}
}

// writeFileAtomic writes data to path via a temp file + rename so a crash
// mid-write never leaves a truncated key file.
func writeFileAtomic(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(perm); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

// backupFile copies path to path.legacy-<unix>.bak (still encrypted with the
// legacy key; no plaintext is written) and returns the backup path.
func backupFile(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	bak := fmt.Sprintf("%s.legacy-%d.bak", path, time.Now().Unix())
	if err := os.WriteFile(bak, raw, 0o600); err != nil {
		return "", err
	}
	return bak, nil
}
