# Mayhem Mode Implementation Summary

## ✅ Completed Features

### 1. Mayhem Mode Detection (`src/pumputils/utils/isMayhemMode.ts`)
- Created utility function to detect Mayhem Mode tokens
- Detection method: Checks if `tokenTotalSupply === 2,000,000,000` (2 billion)
- Normal tokens have 1 billion total supply
- Includes error handling and retry logic

### 2. Configuration (`src/constants/constants.ts`)
- Added `MAYHEM_MODE_ONLY` environment variable
- When set to `true`, bot only snipes Mayhem Mode tokens
- When set to `false`, bot snipes all tokens (including Mayhem Mode)

### 3. Main Bot Logic (`src/index.ts`)
- Integrated Mayhem Mode detection into token launch monitoring
- Added visual indicators (🔥) for Mayhem Mode tokens
- Implemented filtering logic:
  - If `MAYHEM_MODE_ONLY=true` and token is NOT Mayhem Mode → Skip
  - If `MAYHEM_MODE_ONLY=true` and token IS Mayhem Mode → Buy immediately (if `CHECK_DEV_BUY=false`)
  - If `MAYHEM_MODE_ONLY=false` → Process all tokens normally
- Enhanced logging to show Mayhem Mode status

### 4. Documentation
- Created comprehensive `README.md` with:
  - Explanation of Mayhem Mode
  - Installation instructions
  - Configuration guide
  - Usage examples
  - Troubleshooting tips
- Created `.env.example` with all required variables

## 🎯 How It Works

1. **Token Detection**: Bot monitors Pump.fun program via WebSocket
2. **Mayhem Mode Check**: When new token is detected, checks total supply
3. **Filtering**: Applies `MAYHEM_MODE_ONLY` filter if enabled
4. **Trading**: Executes buy/sell based on configured parameters

## 🔧 Key Files Modified/Created

- ✅ `src/pumputils/utils/isMayhemMode.ts` - NEW: Mayhem Mode detection utility
- ✅ `src/constants/constants.ts` - Added `MAYHEM_MODE_ONLY` config
- ✅ `src/index.ts` - Integrated Mayhem Mode detection and filtering
- ✅ `README.md` - NEW: Comprehensive documentation
- ✅ `.env.example` - NEW: Environment variable template

## 🚀 Usage

### Snipe Only Mayhem Mode Tokens
```env
MAYHEM_MODE_ONLY=true
CHECK_DEV_BUY=false
```

### Snipe All Tokens (Including Mayhem Mode)
```env
MAYHEM_MODE_ONLY=false
CHECK_DEV_BUY=true
MIN_DEV_BUY_AMOUNT=0.1
```

## 📊 Detection Logic

```typescript
// Mayhem Mode = 2 billion total supply
const MAYHEM_MODE_TOTAL_SUPPLY = 2_000_000_000n;
const NORMAL_TOTAL_SUPPLY = 1_000_000_000n;

// Detection
const isMayhem = tokenData.tokenTotalSupply === MAYHEM_MODE_TOTAL_SUPPLY;
```

## ⚠️ Important Notes

1. Mayhem Mode detection requires reading the bonding curve account
2. Detection happens immediately after token launch
3. Mayhem Mode tokens have higher volatility due to AI trading
4. Adjust slippage tolerance for Mayhem Mode tokens (recommended: 5-10%)

## 🔄 Next Steps (Optional Enhancements)

- [ ] Add Mayhem Mode statistics tracking
- [ ] Implement separate slippage settings for Mayhem Mode
- [ ] Add Mayhem Mode token age tracking (24-hour window)
- [ ] Create Mayhem Mode performance analytics

