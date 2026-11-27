package birthfund

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/wallet"
)

type fakeRunner struct {
	calls [][]string
}

func (r *fakeRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	r.calls = append(r.calls, append([]string{name}, args...))
	return "Signature 5n9P6xZ64ZdQ6pE4TpnH2czEc9pZNiVx6BTSmCx4EnrV7bZ5HHqJ84kFjoTb7NvBocZxuHhV65tYyxodVxm8wJ7p\n", nil
}

func TestFundPlansWithoutSending(t *testing.T) {
	kp, err := wallet.Generate()
	if err != nil {
		t.Fatal(err)
	}
	ledger := filepath.Join(t.TempDir(), "funding.jsonl")
	result, err := Fund(context.Background(), Config{
		Enabled:     true,
		Recipient:   kp.Pubkey(),
		RPCURL:      "http://localhost:8899",
		SOLAmount:   "0.069420",
		CLAWDAmount: "1000",
		CLAWDMint:   DefaultCLAWDMint,
		LedgerPath:  ledger,
	}, nil)
	if err != nil {
		t.Fatalf("fund plan: %v", err)
	}
	if result.Status != "planned" {
		t.Fatalf("status = %s, want planned", result.Status)
	}
	if result.SOLLamports != 69_420_000 {
		t.Fatalf("lamports = %d", result.SOLLamports)
	}
	want := []string{"solana", "transfer", kp.Pubkey(), "0.069420", "--url", "http://localhost:8899", "--allow-unfunded-recipient", "--from", "<treasury-keypair>"}
	if !reflect.DeepEqual(result.SOLCommand, want) {
		t.Fatalf("SOL command = %#v", result.SOLCommand)
	}
}

func TestFundSendsWithKeypairFile(t *testing.T) {
	recipient, err := wallet.Generate()
	if err != nil {
		t.Fatal(err)
	}
	treasury, err := wallet.Generate()
	if err != nil {
		t.Fatal(err)
	}
	keypairPath := filepath.Join(t.TempDir(), "treasury.json")
	if err := wallet.Save(keypairPath, treasury, false); err != nil {
		t.Fatal(err)
	}
	runner := &fakeRunner{}
	result, err := Fund(context.Background(), Config{
		Enabled:         true,
		Send:            true,
		Recipient:       recipient.Pubkey(),
		RPCURL:          "http://localhost:8899",
		SOLAmount:       "0.069420",
		CLAWDAmount:     "1000",
		CLAWDMint:       DefaultCLAWDMint,
		TreasuryKeypair: keypairPath,
	}, runner)
	if err != nil {
		t.Fatalf("fund send: %v", err)
	}
	if result.Status != "sent" {
		t.Fatalf("status = %s, want sent", result.Status)
	}
	if len(runner.calls) != 2 {
		t.Fatalf("calls = %d, want 2", len(runner.calls))
	}
	if runner.calls[0][0] != "solana" || runner.calls[1][0] != "spl-token" {
		t.Fatalf("unexpected calls: %#v", runner.calls)
	}
}
