# Admin Operations

Protocol-level operations restricted to the global authority. These instructions control feature flags, creator assignments, and protocol configuration.

> **Programs:** Pump (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`), PumpFees (`pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`)

---

## Feature Toggles

### Mayhem Mode

Enables/disables mayhem mode, which affects token creation and trading behavior globally.

```typescript
const ix = await PUMP_SDK.toggleMayhemModeInstruction({
  authority: globalAuthority,  // Must be the current global authority
  enabled: true,               // true = on, false = off
});
```

When mayhem mode is active:
- `CreateEvent.isMayhemMode` will be `true` for new tokens
- `CreatePoolEvent.isMayhemMode` will be `true` for new AMM pools
- `TradeEvent.mayhemMode` will be `true` for trades

### Cashback

Enables/disables the cashback system for volume-based rewards.

```typescript
const ix = await PUMP_SDK.toggleCashbackEnabledInstruction({
  authority: globalAuthority,
  enabled: true,
});
```

When enabled, trades with `cashback: true` accumulate cashback rewards. See [Cashback](./cashback.md).

### Create V2

Enables/disables the `createV2` token creation instruction.

```typescript
const ix = await PUMP_SDK.toggleCreateV2Instruction({
  authority: globalAuthority,
  enabled: true,
});
```

---

## Authority Management

### Transfer Global Authority

Transfer the global authority to a new address. This is a critical operation — the new authority gains full control.

```typescript
const ix = await PUMP_SDK.updateGlobalAuthorityInstruction({
  authority: currentAuthority,   // Must be current authority
  newAuthority: newAuthorityKey, // New authority address
});
```

### Set Reserved Fee Recipients

Configure the protocol's reserved fee recipient whitelist.

```typescript
const ix = await PUMP_SDK.setReservedFeeRecipientsInstruction({
  authority: globalAuthority,
  whitelistPda: whitelistAddress,
});
```

---

## Creator Management

### Set Metaplex Creator

Set or update the Metaplex creator metadata for a token based on its bonding curve data. This is permissionless — anyone can call it.

```typescript
const ix = await PUMP_SDK.setMetaplexCreatorInstruction({
  mint: tokenMint,
});
```

### Migrate Bonding Curve Creator

Update a bonding curve's creator address based on the fee sharing config. Used when fee sharing ownership changes.

```typescript
const ix = await PUMP_SDK.migrateBondingCurveCreatorInstruction({
  mint: tokenMint,
});
```

Emits `MigrateBondingCurveCreatorEvent` with old and new creator addresses.

### Admin Set Creator (Event Only)

The `AdminSetCreatorEvent` is emitted when the admin overrides a token's creator. There is no public instruction builder — this is an admin-only on-chain operation.

```typescript
// Decode the event from transaction logs
const event = PUMP_SDK.decodeAdminSetCreatorEvent(eventData);
// event.oldCreator, event.newCreator, event.mint
```

---

## AMM Admin Operations

### Migrate Pool Coin Creator

Update a graduated AMM pool's creator based on fee sharing config.

```typescript
const ix = await PUMP_SDK.ammMigratePoolCoinCreatorInstruction({
  pool: poolAddress,
  mint: tokenMint,
});
```

### Set AMM Coin Creator

Set a pool's creator from bonding curve metadata (permissionless).

```typescript
const ix = await PUMP_SDK.ammSetCoinCreatorInstruction({
  pool: poolAddress,
  mint: tokenMint,
});
```

---

## Admin Events

| Event | Trigger |
|-------|---------|
| `AdminSetCreatorEvent` | Admin overrides token creator |
| `MigrateBondingCurveCreatorEvent` | Creator migrated via fee sharing config |
| `SetCreatorEvent` | Creator set on bonding curve |

### AdminSetCreatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `adminSetCreatorAuthority` | `PublicKey` | Admin who made the change |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve address |
| `oldCreator` | `PublicKey` | Previous creator |
| `newCreator` | `PublicKey` | New creator |

### MigrateBondingCurveCreatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve address |
| `sharingConfig` | `PublicKey` | Fee sharing config |
| `oldCreator` | `PublicKey` | Previous creator |
| `newCreator` | `PublicKey` | New creator |

---

## Security Notes

- All toggle and authority operations require the **current global authority** signature.
- `updateGlobalAuthorityInstruction` is **irreversible** — double-check the new authority address.
- Creator management operations (`setMetaplexCreator`, `migrateBondingCurveCreator`) are permissionless and can be called by anyone.

---

## Related

- [Tutorial 35](../tutorials/35-admin-operations.md) — Step-by-step admin guide
- [Security Practices](./security.md) — Security guidelines
- [Events Reference](./events-reference.md) — Complete event catalog
