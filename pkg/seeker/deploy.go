package seeker

import (
	"context"
	"fmt"
	"log"

	"github.com/x402agent/Solana-Os-Go/pkg/pinata"
)

// ── Seeker Deployment Support ───────────────────────────────────────
// Enables deploying agents to Solana mainnet directly from
// Solana Seeker phones and Android devices via the IPFS hub.

// DeployFromSeeker deploys an agent to mainnet from a Seeker device.
// Uses the Pinata deployer with device-specific context.
func DeployFromSeeker(ctx context.Context, deployer *pinata.Deployer, cfg pinata.DeployConfig, bridge *BridgeClient) (*pinata.DeployResult, error) {
	// Enrich config with device info
	if bridge != nil {
		if bat, err := bridge.GetBattery(ctx); err == nil {
			if bat.Level < 20 && !bat.IsCharging {
				return nil, fmt.Errorf("seeker deploy: battery too low (%d%%), charge device first", bat.Level)
			}
		}

		if storage, err := bridge.GetStorage(ctx); err == nil {
			if storage.AvailableGB < 0.1 {
				return nil, fmt.Errorf("seeker deploy: insufficient storage (%.1f GB free)", storage.AvailableGB)
			}
		}
	}

	// Execute deployment
	result, err := deployer.Deploy(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("seeker deploy: %w", err)
	}

	log.Printf("[seeker-deploy] agent %q deployed: asset=%s mode=%s",
		cfg.Name, result.AssetAddress, result.Mode)
	return result, nil
}
