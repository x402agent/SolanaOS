package wallet

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureCreatesAndPreservesKeypair(t *testing.T) {
	path := filepath.Join(t.TempDir(), "agent-wallet.json")

	first, created, err := Ensure(path)
	if err != nil {
		t.Fatalf("ensure first: %v", err)
	}
	if !created {
		t.Fatalf("expected first ensure to create keypair")
	}
	if !IsValidPubkey(first.Pubkey()) {
		t.Fatalf("generated pubkey is invalid: %s", first.Pubkey())
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat keypair: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("keypair permissions = %o, want 0600", info.Mode().Perm())
	}

	second, created, err := Ensure(path)
	if err != nil {
		t.Fatalf("ensure second: %v", err)
	}
	if created {
		t.Fatalf("expected existing keypair to be preserved")
	}
	if second.Pubkey() != first.Pubkey() {
		t.Fatalf("pubkey changed: %s != %s", second.Pubkey(), first.Pubkey())
	}
}

func TestBase58RoundTripAndValidation(t *testing.T) {
	kp, err := Generate()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	encoded := Base58Encode(kp.PublicKey[:])
	decoded, err := Base58Decode(encoded)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if string(decoded) != string(kp.PublicKey[:]) {
		t.Fatalf("base58 round trip changed bytes")
	}
	if !IsValidPubkey(encoded) {
		t.Fatalf("expected valid public key")
	}
	if IsValidPubkey("not-a-pubkey") {
		t.Fatalf("expected invalid public key")
	}
}
