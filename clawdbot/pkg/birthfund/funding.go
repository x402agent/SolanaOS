// Package birthfund plans and executes explicit agent birth funding.
package birthfund

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/config"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/wallet"
)

const (
	DefaultSOLAmount   = "0.069420"
	DefaultCLAWDAmount = "1000"
	DefaultCLAWDMint   = "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump"
)

type Config struct {
	Recipient          string
	RPCURL             string
	SOLAmount          string
	CLAWDAmount        string
	CLAWDMint          string
	TreasuryKeypair    string
	TreasuryPrivateKey string
	Enabled            bool
	Send               bool
	InstallID          string
	LedgerPath         string
}

type Result struct {
	Status         string   `json:"status"`
	Send           bool     `json:"send"`
	Recipient      string   `json:"recipient"`
	RPCURL         string   `json:"rpcUrl"`
	SOLAmount      string   `json:"solAmount"`
	SOLLamports    uint64   `json:"solLamports"`
	CLAWDAmount    string   `json:"clawdAmount"`
	CLAWDMint      string   `json:"clawdMint"`
	TreasurySource string   `json:"treasurySource,omitempty"`
	SOLCommand     []string `json:"solCommand,omitempty"`
	CLAWDCommand   []string `json:"clawdCommand,omitempty"`
	SOLSignature   string   `json:"solSignature,omitempty"`
	CLAWDSignature string   `json:"clawdSignature,omitempty"`
	Warnings       []string `json:"warnings,omitempty"`
	InstallID      string   `json:"installId,omitempty"`
	RecordedAt     string   `json:"recordedAt"`
}

type Runner interface {
	Run(ctx context.Context, name string, args ...string) (string, error)
}

type ExecRunner struct{}

func (ExecRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func FromEnv(recipient, workspace string) Config {
	solAmount := firstNonEmpty(os.Getenv("CLAWDBOT_STARTUP_SOL_AMOUNT"), lamportsEnvToSOL(os.Getenv("CLAWDBOT_STARTUP_SOL_LAMPORTS")), DefaultSOLAmount)
	ledgerPath := os.Getenv("CLAWDBOT_BIRTH_FUNDING_LEDGER")
	if strings.TrimSpace(ledgerPath) == "" && strings.TrimSpace(workspace) != "" {
		ledgerPath = filepath.Join(workspace, "install-funding.jsonl")
	}
	return Config{
		Recipient:          recipient,
		RPCURL:             firstNonEmpty(os.Getenv("SOLANA_RPC_URL"), os.Getenv("HELIUS_RPC_URL"), config.PublicRPCURL),
		SOLAmount:          solAmount,
		CLAWDAmount:        firstNonEmpty(os.Getenv("CLAWDBOT_STARTUP_CLAWD_TOKENS"), os.Getenv("CLAWDBOT_BIRTH_CLAWD_AMOUNT"), DefaultCLAWDAmount),
		CLAWDMint:          firstNonEmpty(os.Getenv("CLAWD_TOKEN_MINT"), os.Getenv("CLAWDBOT_CLAWD_MINT"), os.Getenv("CLAWDBOT_CLAWD_TOKEN_MINT"), DefaultCLAWDMint),
		TreasuryKeypair:    os.Getenv("CLAWDBOT_TREASURY_KEYPAIR"),
		TreasuryPrivateKey: os.Getenv("CLAWDBOT_TREASURY_PRIVATE_KEY"),
		Enabled:            envBool("CLAWDBOT_LOCAL_STARTUP_FUNDING") || envBool("CLAWDBOT_BIRTH_FUNDING_ENABLED"),
		Send:               envBool("CLAWDBOT_BIRTH_FUNDING_SEND"),
		InstallID:          os.Getenv("CLAWDBOT_INSTALL_ID"),
		LedgerPath:         ledgerPath,
	}
}

func Fund(ctx context.Context, cfg Config, runner Runner) (Result, error) {
	if runner == nil {
		runner = ExecRunner{}
	}
	result := Result{
		Status:    "disabled",
		Send:      cfg.Send,
		Recipient: strings.TrimSpace(cfg.Recipient),
		RPCURL:    firstNonEmpty(strings.TrimSpace(cfg.RPCURL), config.PublicRPCURL),
		SOLAmount: firstNonEmpty(strings.TrimSpace(cfg.SOLAmount), DefaultSOLAmount),
		CLAWDAmount: firstNonEmpty(
			strings.TrimSpace(cfg.CLAWDAmount),
			DefaultCLAWDAmount,
		),
		CLAWDMint:  strings.TrimSpace(cfg.CLAWDMint),
		InstallID:  strings.TrimSpace(cfg.InstallID),
		RecordedAt: time.Now().UTC().Format(time.RFC3339),
	}

	lamports, err := solToLamports(result.SOLAmount)
	if err != nil {
		return result, err
	}
	result.SOLLamports = lamports

	if !cfg.Enabled && !cfg.Send {
		result.Warnings = append(result.Warnings, "funding disabled; set CLAWDBOT_LOCAL_STARTUP_FUNDING=1 for dry-run planning or CLAWDBOT_BIRTH_FUNDING_SEND=1 to send")
		_ = appendLedger(cfg.LedgerPath, result)
		return result, nil
	}

	if !wallet.IsValidPubkey(result.Recipient) {
		return result, fmt.Errorf("recipient is not a valid Solana public key")
	}

	treasuryPath, treasurySource, cleanup, err := resolveTreasury(cfg)
	if err != nil {
		if cfg.Send {
			return result, err
		}
		result.Warnings = append(result.Warnings, err.Error())
		treasurySource = "missing"
		treasuryPath = "<treasury-keypair>"
	} else if cleanup != nil {
		defer cleanup()
	}
	result.TreasurySource = treasurySource

	actualSOL := []string{"transfer", result.Recipient, result.SOLAmount, "--url", result.RPCURL, "--allow-unfunded-recipient", "--from", treasuryPath}
	actualCLAWD := []string{"transfer", result.CLAWDMint, result.CLAWDAmount, result.Recipient, "--url", result.RPCURL, "--fund-recipient", "--owner", treasuryPath, "--fee-payer", treasuryPath}
	result.SOLCommand = sanitizeCommand("solana", actualSOL)
	result.CLAWDCommand = sanitizeCommand("spl-token", actualCLAWD)

	if strings.TrimSpace(result.CLAWDMint) == "" {
		if cfg.Send {
			return result, fmt.Errorf("CLAWD token mint is required before sending token funding")
		}
		result.Warnings = append(result.Warnings, "CLAWD token transfer needs CLAWD_TOKEN_MINT or CLAWDBOT_CLAWD_MINT")
		result.CLAWDCommand = nil
	}

	if !cfg.Send {
		result.Status = "planned"
		_ = appendLedger(cfg.LedgerPath, result)
		return result, nil
	}

	out, err := runner.Run(ctx, "solana", actualSOL...)
	if err != nil {
		result.Status = "sol_failed"
		_ = appendLedger(cfg.LedgerPath, result)
		return result, fmt.Errorf("solana transfer failed: %w: %s", err, strings.TrimSpace(out))
	}
	result.SOLSignature = firstSignature(out)

	out, err = runner.Run(ctx, "spl-token", actualCLAWD...)
	if err != nil {
		result.Status = "clawd_failed"
		_ = appendLedger(cfg.LedgerPath, result)
		return result, fmt.Errorf("spl-token transfer failed: %w: %s", err, strings.TrimSpace(out))
	}
	result.CLAWDSignature = firstSignature(out)
	result.Status = "sent"
	_ = appendLedger(cfg.LedgerPath, result)
	return result, nil
}

func resolveTreasury(cfg Config) (string, string, func(), error) {
	if path := strings.TrimSpace(cfg.TreasuryKeypair); path != "" {
		path = expandUser(path)
		if _, err := os.Stat(path); err != nil {
			return "", "", nil, fmt.Errorf("treasury keypair not available: %w", err)
		}
		return path, "keypair", nil, nil
	}

	secret := strings.TrimSpace(cfg.TreasuryPrivateKey)
	if secret == "" {
		return "", "", nil, fmt.Errorf("treasury secret missing; set CLAWDBOT_TREASURY_KEYPAIR or CLAWDBOT_TREASURY_PRIVATE_KEY")
	}
	decoded, err := wallet.Base58Decode(secret)
	if err != nil {
		return "", "", nil, fmt.Errorf("treasury private key is not valid base58")
	}
	kp, err := wallet.FromSecret(decoded)
	if err != nil {
		return "", "", nil, fmt.Errorf("treasury private key is not a valid Solana keypair")
	}
	dir, err := os.MkdirTemp("", "clawdbot-treasury-*")
	if err != nil {
		return "", "", nil, err
	}
	path := filepath.Join(dir, "treasury.json")
	if err := wallet.Save(path, kp, true); err != nil {
		_ = os.RemoveAll(dir)
		return "", "", nil, err
	}
	return path, "env:CLAWDBOT_TREASURY_PRIVATE_KEY", func() { _ = os.RemoveAll(dir) }, nil
}

func appendLedger(path string, result Result) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	path = expandUser(path)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(append(data, '\n'))
	return err
}

func sanitizeCommand(name string, args []string) []string {
	out := append([]string{name}, args...)
	for i, arg := range out {
		if (arg == "--from" || arg == "--owner" || arg == "--fee-payer") && i+1 < len(out) {
			out[i+1] = "<treasury-keypair>"
		}
	}
	return out
}

func solToLamports(amount string) (uint64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(amount), 64)
	if err != nil || f < 0 {
		return 0, fmt.Errorf("invalid SOL amount %q", amount)
	}
	return uint64(math.Round(f * 1_000_000_000)), nil
}

func lamportsEnvToSOL(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	lamports, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return ""
	}
	return strconv.FormatFloat(float64(lamports)/1_000_000_000, 'f', 9, 64)
}

func firstSignature(output string) string {
	for _, field := range strings.Fields(output) {
		cleaned := strings.Trim(field, ".,;:()[]{}\"'")
		if len(cleaned) >= 64 && len(cleaned) <= 96 {
			if _, err := wallet.Base58Decode(cleaned); err == nil {
				return cleaned
			}
		}
	}
	return strings.TrimSpace(output)
}

func envBool(key string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func expandUser(path string) string {
	if path == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			return home
		}
	}
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, strings.TrimPrefix(path, "~/"))
		}
	}
	return path
}
