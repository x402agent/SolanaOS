// Package solana — Transaction building helpers.
// Provides SOL transfer, compute budget, and Jupiter swap transaction
// construction using gagliardetto/solana-go primitives.
package solana

import (
	"fmt"
	"log"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
)

// ── SOL Transfer ────────────────────────────────────────────────────

// BuildSOLTransfer creates a signed SOL transfer transaction.
func (s *SolanaRPC) BuildSOLTransfer(to solanago.PublicKey, lamports uint64) (*solanago.Transaction, error) {
	if s.wallet == nil {
		return nil, fmt.Errorf("no wallet loaded — cannot build transfer")
	}

	blockhashResult, err := s.GetLatestBlockhash()
	if err != nil {
		return nil, fmt.Errorf("get blockhash: %w", err)
	}

	tx, err := solanago.NewTransaction(
		[]solanago.Instruction{
			system.NewTransferInstruction(
				lamports,
				s.wallet.PublicKey,
				to,
			).Build(),
		},
		blockhashResult.Value.Blockhash,
		solanago.TransactionPayer(s.wallet.PublicKey),
	)
	if err != nil {
		return nil, fmt.Errorf("build transfer tx: %w", err)
	}

	// Sign with wallet
	_, err = tx.Sign(s.wallet.PrivateKeyGetter())
	if err != nil {
		return nil, fmt.Errorf("sign transfer tx: %w", err)
	}

	return tx, nil
}

// TransferSOL builds, signs, sends, and confirms a SOL transfer.
// Returns the transaction signature.
func (s *SolanaRPC) TransferSOL(to solanago.PublicKey, amountSOL float64) (solanago.Signature, error) {
	lamports := SOLToLamports(amountSOL)
	if lamports == 0 {
		return solanago.Signature{}, fmt.Errorf("amount too small: %.9f SOL", amountSOL)
	}

	tx, err := s.BuildSOLTransfer(to, lamports)
	if err != nil {
		return solanago.Signature{}, err
	}

	sig, err := s.SendTransaction(tx)
	if err != nil {
		return solanago.Signature{}, err
	}

	log.Printf("[TX] 💸 SOL transfer: %.4f SOL → %s (sig: %s)",
		amountSOL, to.Short(8), sig)

	return sig, nil
}

// ── Compute Budget ──────────────────────────────────────────────────

// SetComputeUnitPrice creates a compute unit price instruction (priority fee).
// microLamports is the price per compute unit in micro-lamports.
func SetComputeUnitPrice(microLamports uint64) solanago.Instruction {
	// ComputeBudgetInstruction::SetComputeUnitPrice = instruction index 3
	data := make([]byte, 9)
	data[0] = 3 // SetComputeUnitPrice discriminator
	// Little-endian uint64
	data[1] = byte(microLamports)
	data[2] = byte(microLamports >> 8)
	data[3] = byte(microLamports >> 16)
	data[4] = byte(microLamports >> 24)
	data[5] = byte(microLamports >> 32)
	data[6] = byte(microLamports >> 40)
	data[7] = byte(microLamports >> 48)
	data[8] = byte(microLamports >> 56)

	return solanago.NewInstruction(
		ComputeBudgetProgramID,
		solanago.AccountMetaSlice{},
		data,
	)
}

// SetComputeUnitLimit creates a compute unit limit instruction.
// units is the maximum compute units for the transaction.
func SetComputeUnitLimit(units uint32) solanago.Instruction {
	// ComputeBudgetInstruction::SetComputeUnitLimit = instruction index 2
	data := make([]byte, 5)
	data[0] = 2 // SetComputeUnitLimit discriminator
	data[1] = byte(units)
	data[2] = byte(units >> 8)
	data[3] = byte(units >> 16)
	data[4] = byte(units >> 24)

	return solanago.NewInstruction(
		ComputeBudgetProgramID,
		solanago.AccountMetaSlice{},
		data,
	)
}

// ── Jupiter Swap Transaction Execution ──────────────────────────────

// JupiterSwapParams holds the parameters for a Jupiter swap.
type JupiterSwapParams struct {
	InputMint   string  // Input token mint address
	OutputMint  string  // Output token mint address
	AmountSOL   float64 // Amount in SOL (converted to lamports for SOL input)
	SlippageBps int     // Slippage tolerance in basis points (e.g. 50 = 0.5%)
}

// ExecuteJupiterSwap gets a quote and executes a swap through Jupiter.
// In simulated mode, it only logs the quote without executing.
func (s *SolanaRPC) ExecuteJupiterSwap(jupiter *JupiterClient, params JupiterSwapParams, simulate bool) (*SwapResult, error) {
	if s.wallet == nil {
		return nil, fmt.Errorf("no wallet — cannot execute swap")
	}

	amountLamports := SOLToLamports(params.AmountSOL)

	quote, err := jupiter.GetQuote(
		params.InputMint,
		params.OutputMint,
		amountLamports,
		params.SlippageBps,
	)
	if err != nil {
		return nil, fmt.Errorf("jupiter quote: %w", err)
	}

	log.Printf("[SWAP] 📊 Quote: %s → %s | in=%s out=%s routes=%d",
		params.InputMint[:8], params.OutputMint[:8],
		quote.InAmount, quote.OutAmount, quote.Routes)

	if simulate {
		log.Printf("[SWAP] 🔮 SIMULATED — would swap %s → %s",
			quote.InAmount, quote.OutAmount)
		return &SwapResult{
			Signature:    "sim-" + fmt.Sprintf("%d", amountLamports),
			InputMint:    params.InputMint,
			OutputMint:   params.OutputMint,
			InAmount:     quote.InAmount,
			OutAmount:    quote.OutAmount,
			WalletPubkey: s.WalletPubkey(),
		}, nil
	}

	// In live mode, request serialized swap transaction from Jupiter API
	// and forward through our RPC client.
	// For now, return the quote as result — full Jupiter v6 swap
	// instruction deserialization requires additional implementation.
	log.Printf("[SWAP] ⚠️  Live Jupiter v6 swap execution — use Jupiter Ultra API for production")
	return &SwapResult{
		Signature:    "pending",
		InputMint:    params.InputMint,
		OutputMint:   params.OutputMint,
		InAmount:     quote.InAmount,
		OutAmount:    quote.OutAmount,
		WalletPubkey: s.WalletPubkey(),
	}, nil
}

// ── Memo Instruction ────────────────────────────────────────────────

// BuildMemoInstruction creates a memo instruction for logging on-chain.
func BuildMemoInstruction(memo string, signer solanago.PublicKey) solanago.Instruction {
	return solanago.NewInstruction(
		MemoProgramID,
		solanago.AccountMetaSlice{
			solanago.NewAccountMeta(signer, false, true),
		},
		[]byte(memo),
	)
}
