package agentwallet

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	solanago "github.com/gagliardetto/solana-go"
)

func init() {
	// Cheap parameters for tests only; production uses RFC 9106 defaults.
	argon2Defaults.Time = 1
	argon2Defaults.MemoryKiB = 1024
	argon2Defaults.Threads = 1
}

func legacySeal(t *testing.T, passphrase string, pt []byte) (ct, nonce []byte) {
	t.Helper()
	key := sha256.Sum256([]byte(passphrase))
	block, _ := aes.NewCipher(key[:])
	gcm, _ := cipher.NewGCM(block)
	nonce = make([]byte, gcm.NonceSize())
	_, _ = rand.Read(nonce)
	return gcm.Seal(nil, nonce, pt, nil), nonce
}

// writeLegacyVault writes a vault exactly as the pre-argon2 code did.
func writeLegacyVault(t *testing.T, dir, passphrase string, keys map[string][]byte) {
	t.Helper()
	wallets := map[string]*WalletEntry{}
	for id, k := range keys {
		ct, n := legacySeal(t, passphrase, k)
		wallets[id] = &WalletEntry{ID: id, ChainType: ChainSolana, EncryptedKey: hex.EncodeToString(ct), Nonce: hex.EncodeToString(n)}
	}
	data, _ := json.MarshalIndent(wallets, "", "  ")
	ct, n := legacySeal(t, passphrase, data)
	env, _ := json.Marshal(map[string]string{"data": hex.EncodeToString(ct), "nonce": hex.EncodeToString(n)})
	if err := os.WriteFile(filepath.Join(dir, "wallets.enc.json"), env, 0o600); err != nil {
		t.Fatal(err)
	}
}

func readHeader(t *testing.T, path string) map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestNewVaultUsesArgon2idWithSalt(t *testing.T) {
	dir := t.TempDir()
	v, err := NewVault(VaultConfig{StorePath: dir, Passphrase: "pw"})
	if err != nil {
		t.Fatal(err)
	}
	if err := v.AddWallet("w1", "", ChainSolana, 0, "addr", []byte("secret-key-1")); err != nil {
		t.Fatal(err)
	}
	h := readHeader(t, filepath.Join(dir, "wallets.enc.json"))
	if h["kdf"] != "argon2id" || h["v"] != float64(2) || len(h["salt"].(string)) != 32 {
		t.Fatalf("unexpected header %v", h)
	}
	v2, err := NewVault(VaultConfig{StorePath: dir, Passphrase: "pw"})
	if err != nil {
		t.Fatal(err)
	}
	if got, err := v2.GetPrivateKey("w1"); err != nil || string(got) != "secret-key-1" {
		t.Fatalf("reload: %q %v", got, err)
	}
}

// Existing wallets must keep working and must NOT be silently re-encrypted.
func TestLegacyVaultStillLoadsAndStaysLegacy(t *testing.T) {
	dir := t.TempDir()
	writeLegacyVault(t, dir, "pw", map[string][]byte{"old": []byte("legacy-secret")})
	v, err := NewVault(VaultConfig{StorePath: dir, Passphrase: "pw"})
	if err != nil {
		t.Fatal(err)
	}
	if got, err := v.GetPrivateKey("old"); err != nil || string(got) != "legacy-secret" {
		t.Fatalf("legacy key: %q %v", got, err)
	}
	if err := v.AddWallet("new", "", ChainSolana, 0, "a", []byte("new-secret")); err != nil {
		t.Fatal(err)
	}
	h := readHeader(t, filepath.Join(dir, "wallets.enc.json"))
	if _, ok := h["kdf"]; ok || len(h) != 2 {
		t.Fatalf("legacy vault was silently changed: header %v", h)
	}
}

func TestMigrateVaultKDF(t *testing.T) {
	dir := t.TempDir()
	keys := map[string][]byte{"a": []byte("key-a"), "b": []byte("key-b")}
	writeLegacyVault(t, dir, "pw", keys)
	cfg := VaultConfig{StorePath: dir, Passphrase: "pw"}

	migrated, backup, err := MigrateVaultKDF(cfg)
	if err != nil || !migrated {
		t.Fatalf("migrate: %v %v", migrated, err)
	}
	if h := readHeader(t, filepath.Join(dir, "wallets.enc.json")); h["kdf"] != "argon2id" {
		t.Fatalf("not migrated: %v", h)
	}
	if bh := readHeader(t, backup); len(bh) != 2 {
		t.Fatalf("backup is not the legacy file: %v", bh)
	}
	v, err := NewVault(cfg)
	if err != nil {
		t.Fatal(err)
	}
	for id, want := range keys {
		if got, err := v.GetPrivateKey(id); err != nil || !bytes.Equal(got, want) {
			t.Fatalf("%s after migrate: %q %v", id, got, err)
		}
	}
	// Idempotent.
	if migrated, _, err := MigrateVaultKDF(cfg); err != nil || migrated {
		t.Fatalf("second migrate: %v %v", migrated, err)
	}
}

func TestMigrateVaultKDFWrongPassphraseTouchesNothing(t *testing.T) {
	dir := t.TempDir()
	writeLegacyVault(t, dir, "pw", map[string][]byte{"a": []byte("key-a")})
	before, _ := os.ReadFile(filepath.Join(dir, "wallets.enc.json"))
	if _, _, err := MigrateVaultKDF(VaultConfig{StorePath: dir, Passphrase: "wrong"}); err == nil {
		t.Fatal("migration with wrong passphrase succeeded")
	}
	after, _ := os.ReadFile(filepath.Join(dir, "wallets.enc.json"))
	if !bytes.Equal(before, after) {
		t.Fatal("vault file changed after failed migration")
	}
}

// Previously a wrong passphrase loaded an empty vault and the next AddWallet
// overwrote the real file, destroying every stored key.
func TestVaultRefusesToOverwriteUndecryptableFile(t *testing.T) {
	dir := t.TempDir()
	writeLegacyVault(t, dir, "pw", map[string][]byte{"a": []byte("key-a")})
	before, _ := os.ReadFile(filepath.Join(dir, "wallets.enc.json"))
	v, err := NewVault(VaultConfig{StorePath: dir, Passphrase: "wrong"})
	if err != nil {
		t.Fatal(err)
	}
	if err := v.AddWallet("x", "", ChainSolana, 0, "a", []byte("k")); err == nil || !strings.Contains(err.Error(), "refusing to overwrite") {
		t.Fatalf("AddWallet on undecryptable vault: %v", err)
	}
	after, _ := os.ReadFile(filepath.Join(dir, "wallets.enc.json"))
	if !bytes.Equal(before, after) {
		t.Fatal("undecryptable vault was overwritten")
	}
}

func signerCfg(dir string) LocalSignerConfig {
	return LocalSignerConfig{Mode: SignerModeDev, StorePath: dir, Passphrase: "pw"}
}

func clearSignerEnv(t *testing.T) {
	t.Setenv("LOCAL_SIGNER_dev_KEY", "")
	t.Setenv("SOLANA_PRIVATE_KEY", "")
}

func TestLocalSignerLegacyLoadAndMigrate(t *testing.T) {
	clearSignerEnv(t)
	dir := t.TempDir()
	w := solanago.NewWallet()
	ct, n := legacySeal(t, "pw", []byte(w.PrivateKey))
	env, _ := json.Marshal(signerEnvelope{Data: hex.EncodeToString(ct), Nonce: hex.EncodeToString(n)})
	keyFile := filepath.Join(dir, "dev.enc")
	if err := os.WriteFile(keyFile, env, 0o600); err != nil {
		t.Fatal(err)
	}

	s, err := NewLocalSigner(signerCfg(dir))
	if err != nil || s.Pubkey() != w.PublicKey().String() {
		t.Fatalf("legacy signer load: %v", err)
	}
	if h := readHeader(t, keyFile); len(h) != 2 {
		t.Fatalf("legacy signer file silently changed: %v", h)
	}

	migrated, backup, err := MigrateLocalSignerKDF(signerCfg(dir))
	if err != nil || !migrated || backup == "" {
		t.Fatalf("migrate signer: %v %v", migrated, err)
	}
	if h := readHeader(t, keyFile); h["kdf"] != "argon2id" {
		t.Fatalf("signer not migrated: %v", h)
	}
	s2, err := NewLocalSigner(signerCfg(dir))
	if err != nil || s2.Pubkey() != w.PublicKey().String() {
		t.Fatalf("migrated signer reload: %v", err)
	}
	if migrated, _, err := MigrateLocalSignerKDF(signerCfg(dir)); err != nil || migrated {
		t.Fatalf("second migrate: %v %v", migrated, err)
	}
}

func TestNewLocalSignerWritesArgon2id(t *testing.T) {
	clearSignerEnv(t)
	dir := t.TempDir()
	s, err := NewLocalSigner(signerCfg(dir))
	if err != nil {
		t.Fatal(err)
	}
	if h := readHeader(t, filepath.Join(dir, "dev.enc")); h["kdf"] != "argon2id" {
		t.Fatalf("new signer header %v", h)
	}
	s2, err := NewLocalSigner(signerCfg(dir))
	if err != nil || s2.Pubkey() != s.Pubkey() {
		t.Fatalf("reload: %v", err)
	}
	if _, err := NewLocalSigner(LocalSignerConfig{Mode: SignerModeDev, StorePath: dir, Passphrase: "wrong"}); err == nil {
		t.Fatal("wrong passphrase accepted")
	}
}

func TestDeriveKeyWithRejectsBadHeaders(t *testing.T) {
	for _, h := range []kdfHeader{
		{KDF: "scrypt"},
		{KDF: kdfArgon2id, Salt: "zz", Time: 1, MemoryKiB: 1024, Threads: 1},
		{KDF: kdfArgon2id, Salt: "00112233445566778899aabbccddeeff", Time: 0, MemoryKiB: 1024, Threads: 1},
	} {
		if _, err := deriveKeyWith("pw", h); err == nil {
			t.Errorf("header %+v accepted", h)
		}
	}
}
