# PumpSwap Service

This service provides a backend API for interacting with the @pump-fun/pump-swap-sdk. It serves as an intermediary between the client application and the Solana blockchain.

## Implementation Status

The current implementation includes:

- API routes for all functions directly supported by the SDK
- Type definitions for request/response objects
- Basic connection setup with fallback RPC URL

⚠️ **Important Note**: The implementation exclusively uses SDK functionality, with some methods currently implemented as placeholders:

1. The quote methods (`getSwapQuote` and `getLiquidityQuote`) are fully implemented
2. Transaction building methods are currently using placeholder instructions until SDK method signatures are clarified

## Known Issues

- The `Direction` enum appears to not be exported correctly from the SDK, requiring a local implementation and type casting
- Method signatures for transaction building don't match the documentation
- Some SDK methods require different parameter counts than documented
- Type conversions between numbers and BNs need careful handling
- The SDK may be expecting numeric values (0, 1) instead of enum values for direction parameters

## Next Steps for Complete Implementation

To fully implement this service with the actual SDK functionality:

1. Review the SDK source code directly to understand the correct method signatures
2. Update the transaction building methods to use the correct SDK methods with proper parameters
3. Test each endpoint with real data to ensure proper functionality
4. Consider reaching out to the SDK maintainers for clarification on API usage

## Available Endpoints

- POST `/api/pump-swap/quote-swap` - Get a swap quote
- POST `/api/pump-swap/quote-liquidity` - Get a liquidity quote
- POST `/api/pump-swap/build-swap` - Build a swap transaction
- POST `/api/pump-swap/build-add-liquidity` - Build an add liquidity transaction
- POST `/api/pump-swap/build-remove-liquidity` - Build a remove liquidity transaction
- POST `/api/pump-swap/build-create-pool` - Build a create pool transaction
- POST `/api/pump-swap/simulate-swap` - Simulate a swap

## Configuration

The service uses the following environment variables:

- `HELIUS_RPC_URL` - The Helius RPC URL for connecting to the Solana network

If `HELIUS_RPC_URL` is not set, the service will fall back to using the public Solana mainnet RPC URL (`https://api.mainnet-beta.solana.com`). For production use, it's recommended to set up a dedicated RPC endpoint through Helius or another provider to avoid rate limits and ensure better reliability.

## Dependencies

- `@pump-fun/pump-swap-sdk` - The SDK for interacting with PumpSwap on Solana
- `@solana/web3.js` - Solana Web3 library for interacting with the Solana blockchain
- `@solana/spl-token` - Solana SPL Token library
- `bn.js` - For handling big numbers in cryptocurrency amounts
