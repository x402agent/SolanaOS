// Package solana — Solana program IDs, constants, and PDA utilities.
// Re-exports key identifiers from gagliardetto/solana-go so the rest of
// the codebase doesn't need to import the library directly.
package solana

import (
	solanago "github.com/gagliardetto/solana-go"
)

// ── Solana Constants ────────────────────────────────────────────────

const (
	// LAMPORTS_PER_SOL is the number of lamports per SOL.
	LAMPORTS_PER_SOL = solanago.LAMPORTS_PER_SOL // 1_000_000_000
)

// ── Core Program IDs ────────────────────────────────────────────────
// Re-exported from solana-go for convenience across the codebase.

var (
	// System Program
	SystemProgramID            = solanago.SystemProgramID
	SystemProgramInstructionID = solanago.MustPublicKeyFromBase58("11111111111111111111111111111111")

	// Token Programs (note: TokenProgramID is declared in clients.go as a string constant)
	SolanaTokenProgramID = solanago.TokenProgramID
	Token2022ProgramID   = solanago.Token2022ProgramID

	// Associated Token Account Program
	SPLAssociatedTokenAccountProgramID = solanago.SPLAssociatedTokenAccountProgramID

	// Compute Budget Program
	ComputeBudgetProgramID = solanago.MustPublicKeyFromBase58("ComputeBudget111111111111111111111111111111")

	// BPF Loader Programs
	BPFLoaderProgramID            = solanago.BPFLoaderProgramID
	BPFLoaderDeprecatedProgramID  = solanago.BPFLoaderDeprecatedProgramID
	BPFLoaderUpgradeableProgramID = solanago.BPFLoaderUpgradeableProgramID

	// Memo Program
	MemoProgramID = solanago.MemoProgramID

	// Rent Program
	SysVarRentPubkey           = solanago.SysVarRentPubkey
	SysVarClockPubkey          = solanago.SysVarClockPubkey
	SysVarRecentBlockHashesPubkey = solanago.SysVarRecentBlockHashesPubkey
	SysVarInstructionsPubkey   = solanago.SysVarInstructionsPubkey
	SysVarStakeHistoryPubkey   = solanago.SysVarStakeHistoryPubkey

	// Stake Program
	StakeProgramID = solanago.StakeProgramID

	// Vote Program
	VoteProgramID = solanago.VoteProgramID

	// Serum / OpenBook DEX v3
	SerumV3ProgramID = solanago.MustPublicKeyFromBase58("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")

	// Pump.fun — bonding curve program (pre-graduation)
	PumpFunProgramID = solanago.MustPublicKeyFromBase58("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")

	// PumpAMM — constant-product AMM (post-graduation)
	PumpAMMProgramID = solanago.MustPublicKeyFromBase58("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA")

	// Jupiter v6 Aggregator
	JupiterV6ProgramID = solanago.MustPublicKeyFromBase58("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")

	// Metaplex Token Metadata
	TokenMetadataProgramID = solanago.TokenMetadataProgramID

	// Address Lookup Table Program
	AddressLookupTableProgramID = solanago.MustPublicKeyFromBase58("AddressLookupTab1e1111111111111111111111111")

	// Native Mint (wrapped SOL)
	NativeMint = solanago.SolMint // So11111111111111111111111111111111111111112
)

// ── Well-Known Token Mints ──────────────────────────────────────────

var (
	// SOL wrapped mint
	WrappedSOLMint = solanago.SolMint

	// USDC on Solana mainnet
	USDCMint = solanago.MustPublicKeyFromBase58("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")

	// USDT on Solana mainnet
	USDTMint = solanago.MustPublicKeyFromBase58("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
)

// ── PDA Derivation Helpers ──────────────────────────────────────────

// DeriveTokenMetadataAddress derives the Metaplex token metadata PDA
// for the given mint address.
func DeriveTokenMetadataAddress(mint solanago.PublicKey) (solanago.PublicKey, uint8, error) {
	return solanago.FindProgramAddress(
		[][]byte{
			[]byte("metadata"),
			TokenMetadataProgramID.Bytes(),
			mint.Bytes(),
		},
		TokenMetadataProgramID,
	)
}

// DeriveAssociatedTokenAddress derives the associated token account
// address for a wallet and mint.
func DeriveAssociatedTokenAddress(wallet, mint solanago.PublicKey) (solanago.PublicKey, uint8, error) {
	return solanago.FindAssociatedTokenAddress(wallet, mint)
}

// DerivePDA is a generic PDA derivation helper.
func DerivePDA(seeds [][]byte, programID solanago.PublicKey) (solanago.PublicKey, uint8, error) {
	return solanago.FindProgramAddress(seeds, programID)
}

// ── Encoding Helpers ────────────────────────────────────────────────

// PublicKeyFromString parses a base58 public key string.
// Returns zero value and error on invalid input.
func PublicKeyFromString(s string) (solanago.PublicKey, error) {
	return solanago.PublicKeyFromBase58(s)
}

// MustPublicKey parses a base58 public key string, panicking on error.
// Only use for compile-time constants.
func MustPublicKey(s string) solanago.PublicKey {
	return solanago.MustPublicKeyFromBase58(s)
}

// LamportsToSOL converts lamports to SOL.
func LamportsToSOL(lamports uint64) float64 {
	return float64(lamports) / float64(LAMPORTS_PER_SOL)
}

// SOLToLamports converts SOL to lamports.
func SOLToLamports(sol float64) uint64 {
	return uint64(sol * float64(LAMPORTS_PER_SOL))
}
