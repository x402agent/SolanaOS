package phoenix

import (
	"testing"

	solanago "github.com/gagliardetto/solana-go"
)

func TestBuildAndSignProducesVerifiableTransaction(t *testing.T) {
	privateKey, err := solanago.NewRandomPrivateKey()
	if err != nil {
		t.Fatalf("generate private key: %v", err)
	}
	kp := &Keypair{
		PrivateKey: privateKey,
		PublicKey:  privateKey.PublicKey(),
	}

	hashBytes := make([]byte, solanago.PublicKeyLength)
	for i := range hashBytes {
		hashBytes[i] = byte(i + 1)
	}
	blockhash := solanago.HashFromBytes(hashBytes).String()

	txBytes, err := BuildAndSign(kp, []Instruction{
		{
			ProgramID: solanago.SystemProgramID.String(),
			Keys: []AccountMeta{
				{
					Pubkey:     kp.Pubkey(),
					IsSigner:   true,
					IsWritable: true,
				},
			},
		},
	}, blockhash)
	if err != nil {
		t.Fatalf("build and sign: %v", err)
	}

	tx, err := solanago.TransactionFromBytes(txBytes)
	if err != nil {
		t.Fatalf("decode transaction: %v", err)
	}
	if err := tx.VerifySignatures(); err != nil {
		t.Fatalf("verify signatures: %v", err)
	}
	if got := tx.Message.RecentBlockhash.String(); got != blockhash {
		t.Fatalf("blockhash = %s, want %s", got, blockhash)
	}
}

func TestBuildAndSignRejectsUnknownSigner(t *testing.T) {
	privateKey, err := solanago.NewRandomPrivateKey()
	if err != nil {
		t.Fatalf("generate private key: %v", err)
	}
	kp := &Keypair{
		PrivateKey: privateKey,
		PublicKey:  privateKey.PublicKey(),
	}
	otherPrivateKey, err := solanago.NewRandomPrivateKey()
	if err != nil {
		t.Fatalf("generate other private key: %v", err)
	}

	hashBytes := make([]byte, solanago.PublicKeyLength)
	for i := range hashBytes {
		hashBytes[i] = byte(i + 1)
	}

	_, err = BuildAndSign(kp, []Instruction{
		{
			ProgramID: solanago.SystemProgramID.String(),
			Keys: []AccountMeta{
				{
					Pubkey:     otherPrivateKey.PublicKey().String(),
					IsSigner:   true,
					IsWritable: true,
				},
			},
		},
	}, solanago.HashFromBytes(hashBytes).String())
	if err == nil {
		t.Fatalf("expected missing signer error")
	}
}
