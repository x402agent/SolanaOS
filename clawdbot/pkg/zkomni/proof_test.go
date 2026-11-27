package zkomni

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"testing"
	"time"
)

func TestPlanAndVerify(t *testing.T) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		t.Fatal(err)
	}
	exp := uint64(time.Now().Add(time.Hour).Unix())
	plan, err := PlanMessage(secret, "robinhood-to-solana", "publish_attestation", "zero-clawd", "", "", exp)
	if err != nil {
		t.Fatal(err)
	}
	if plan.MsgType != 4 {
		t.Fatalf("msgType=%d", plan.MsgType)
	}
	if plan.SrcEID != EIDRobinhoodMainnet || plan.DstEID != EIDSolanaMainnet {
		t.Fatalf("eids %d→%d", plan.SrcEID, plan.DstEID)
	}
	if err := VerifyProof(plan.Message); err != nil {
		t.Fatal(err)
	}
	// Tamper action → verify fails
	bad := plan.Message
	bad.Action = "tampered"
	if err := VerifyProof(bad); err == nil {
		t.Fatal("expected verify failure on tampered action")
	}
}

func TestNullifierBoundToPubkey(t *testing.T) {
	secret := make([]byte, 32)
	rand.Read(secret)
	exp := uint64(time.Now().Add(time.Hour).Unix())
	plan, err := PlanMessage(secret, "robinhood-to-solana", "attest", "", "", "", exp)
	if err != nil {
		t.Fatal(err)
	}
	// Swap proof pubkey
	plan.Message.ProofPubkey = "0x" + strings.Repeat("ff", 32)
	if err := VerifyProof(plan.Message); err == nil {
		t.Fatal("expected nullifier relation failure")
	}
}

func TestDeterministicKeyFromSecret(t *testing.T) {
	secret, _ := hex.DecodeString(strings.Repeat("ab", 32))
	pk1, _, err := DeriveKeypair(secret)
	if err != nil {
		t.Fatal(err)
	}
	pk2, _, err := DeriveKeypair(secret)
	if err != nil {
		t.Fatal(err)
	}
	if hex.EncodeToString(pk1) != hex.EncodeToString(pk2) {
		t.Fatal("keypair not deterministic")
	}
}
