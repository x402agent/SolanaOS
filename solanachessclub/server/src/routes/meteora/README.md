# Meteora DBC API Routes

This module provides API endpoints for interacting with the Meteora Dynamic Bonding Curve (DBC) protocol.

## Overview

The Meteora DBC API allows:

- Creating and managing bonding curve configurations
- Creating token pools with dynamic bonding curves
- Swapping tokens within these pools
- Migrating pools to DAMM V1 or V2 when thresholds are reached
- Managing partner and creator fees

All endpoints return a transaction that must be signed on the client side before being submitted to the Solana network.

## Setup

### Environment Variables

Before using this module, you need to set up the required environment variables:

1. Create a `.env` file in the root of your project
2. Add the following variables:

```
# Solana RPC URL - Required
RPC_URL=https://api.mainnet-beta.solana.com

# For devnet testing
# RPC_URL=https://api.devnet.solana.com

# For custom RPC providers like Helius or Alchemy
# RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
# RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

The service will fall back to devnet if no RPC_URL is provided, but this is not recommended for production use.

## API Endpoints

### Partner Functions

#### Create Configuration

```
POST /api/meteora/config
```

Creates a new configuration key that will dictate the behavior of all pools created with this key.

#### Build Curve and Create Config

```
POST /api/meteora/build-curve
```

Builds a new constant product config based on percentage of supply on migration and migration quote threshold.

#### Build Curve by Market Cap and Create Config

```
POST /api/meteora/build-curve-by-market-cap
```

Builds a new constant product config based on market cap parameters.

#### Create Partner Metadata

```
POST /api/meteora/partner-metadata
```

Creates a new partner metadata account.

#### Claim Partner Trading Fee

```
POST /api/meteora/claim-partner-fee
```

Claims trading fees for the partner.

#### Partner Withdraw Surplus

```
POST /api/meteora/partner-withdraw-surplus
```

Withdraws surplus tokens for the partner.

### Pool Functions

#### Create Pool

```
POST /api/meteora/pool
```

Creates a new pool with a specific configuration key.

#### Create Pool and Buy

```
POST /api/meteora/pool-and-buy
```

Creates a new pool and buys tokens immediately.

#### Swap Tokens

```
POST /api/meteora/swap
```

Swaps tokens within an existing pool.

### Migration Functions

#### Create Locker

```
POST /api/meteora/migration/locker
```

Creates a new locker for migration.

#### Withdraw Leftover

```
POST /api/meteora/migration/withdraw-leftover
```

Withdraws leftover tokens from a pool.

#### Create DAMM V1 Migration Metadata

```
POST /api/meteora/migration/damm-v1-metadata
```

Creates metadata for DAMM V1 migration.

#### Migrate to DAMM V1

```
POST /api/meteora/migration/damm-v1
```

Migrates a pool to DAMM V1.

#### Lock DAMM V1 LP Token

```
POST /api/meteora/migration/lock-damm-v1-lp
```

Locks a DAMM V1 LP token.

#### Claim DAMM V1 LP Token

```
POST /api/meteora/migration/claim-damm-v1-lp
```

Claims a DAMM V1 LP token.

#### Create DAMM V2 Migration Metadata

```
POST /api/meteora/migration/damm-v2-metadata
```

Creates metadata for DAMM V2 migration.

#### Migrate to DAMM V2

```
POST /api/meteora/migration/damm-v2
```

Migrates a pool to DAMM V2.

### Creator Functions

#### Create Pool Metadata

```
POST /api/meteora/pool-metadata
```

Creates metadata for a pool.

#### Claim Creator Trading Fee

```
POST /api/meteora/claim-creator-fee
```

Claims trading fees for the creator.

#### Creator Withdraw Surplus

```
POST /api/meteora/creator-withdraw-surplus
```

Withdraws surplus tokens for the creator.

### State Query Functions

#### Get Pool State

```
GET /api/meteora/pool/:poolAddress
```

Gets the state information for a specific pool.

#### Get Pool Config State

```
GET /api/meteora/config/:configAddress
```

Gets the state information for a specific configuration.

#### Get Pool Curve Progress

```
GET /api/meteora/pool/:poolAddress/progress
```

Gets the progress of a pool's curve toward migration.

#### Get Pool Fee Metrics

```
GET /api/meteora/pool/:poolAddress/fees
```

Gets the fee metrics for a specific pool.

## Response Format

All endpoints return a response in the following format:

```json
{
  "success": true,
  "transaction": "base64_encoded_transaction_string"
}
```

In case of error:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Usage Flow

1. Create a configuration for the bonding curve
2. Create a pool with the configuration
3. Users can swap tokens in the pool
4. When the migration threshold is reached, the pool can be migrated
5. After migration, LP tokens can be claimed or locked

## Migration Flow

### DAMM V1 Migration

1. Create DAMM V1 migration metadata
2. Create locker (if token has locked vesting)
3. Migrate to DAMM V1
4. Lock DAMM V1 LP token (if applicable)
5. Claim DAMM V1 LP token (if applicable)

### DAMM V2 Migration

1. Create DAMM V2 migration metadata
2. Create locker (if token has locked vesting)
3. Migrate to DAMM V2
 