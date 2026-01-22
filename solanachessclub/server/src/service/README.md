# Service Directory

This directory contains service implementations that handle the core business logic of the Solana App Kit server. Services abstract away the details of interacting with external systems, APIs, and blockchain networks, providing a clean interface for controllers to use.

## Architecture

Services follow a modular architecture where each service handles a specific domain or integration:

- **TokenMill**: Core token creation and management functionality
- **PumpSwap**: Integration with the Pump.fun swap protocol
- **IPFS**: Pinata-based IPFS storage service
- **Storage**: Google Cloud Storage integration for file storage

## Service Structure

Each service is contained in its own directory and typically includes:

1. Main service file(s) with core functionality
2. Helper utilities specific to the service
3. Type definitions
4. Configuration setup
5. README.md with service-specific documentation

## Available Services

### TokenMill Service

The TokenMill service handles interactions with the TokenMill Solana program. It provides functionality for:

- Token creation and market management
- Setting bonding curves for token pricing
- Token swapping (buy/sell)
- Staking tokens for rewards
- Creating and releasing vesting plans
- Fund markets with SOL

This service is located in the `TokenMill/` directory.

### PumpSwap Service

PumpSwap service provides interaction with the @pump-fun/pump-swap-sdk for:

- Token swapping on the PumpSwap DEX
- Liquidity provision and pool management
- Quote retrieval for swaps and liquidity operations
- Transaction building for various operations

This service is located in the `pumpSwap/` directory.

## Service Pattern

Services follow a consistent pattern:

```typescript
// Service class or functions export
export class ExampleService {
  private config: ExampleServiceConfig;
  
  constructor(config: ExampleServiceConfig) {
    this.config = config;
  }
  
  /**
   * Performs a specific operation
   * @param param1 Description of parameter 1
   * @param param2 Description of parameter 2
   * @returns Operation result
   */
  public async performOperation(param1: string, param2: number): Promise<OperationResult> {
    try {
      // Implementation logic
      return result;
    } catch (error) {
      console.error('Error in performOperation:', error);
      throw new Error(`Failed to perform operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
```

## Creating a New Service

When creating a new service:

1. Create a directory named after your service in the `service/` directory
2. Create a README.md file that explains the service's purpose and usage
3. Implement the core service functionality in one or more files
4. Create any necessary helper files or utilities
5. Export a clean interface for controllers to use
6. Include proper error handling and logging
7. Document all functions and parameters with JSDoc comments

## Best Practices

- Keep service functions focused on a single responsibility
- Handle all errors properly and provide meaningful error messages
- Use TypeScript for type safety
- Document all public interfaces
- Implement proper logging for debugging
- Use dependency injection where appropriate
- Keep business logic separate from API or blockchain interaction code
- Write modular, reusable, and easily customizable code 