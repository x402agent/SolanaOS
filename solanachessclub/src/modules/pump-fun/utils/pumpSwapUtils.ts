/**
 * PumpSwap utilities for swap operations, pool management, and token calculations
 */

// Default slippage tolerance percentage for swaps (0.5%)
export const DEFAULT_SLIPPAGE = 0.5;

/**
 * Calculate price impact for a swap
 * @param inputAmount Amount of input token
 * @param outputAmount Amount of output token
 * @param marketPrice Current market price
 * @returns Price impact as a percentage
 */
export function calculatePriceImpact(
  inputAmount: number,
  outputAmount: number,
  marketPrice: number
): number {
  if (!inputAmount || !outputAmount || !marketPrice) return 0;
  
  const executionPrice = outputAmount / inputAmount;
  const impact = Math.abs((executionPrice - marketPrice) / marketPrice) * 100;
  
  return impact;
}

/**
 * Format token amount with appropriate decimals
 * @param amount Raw token amount 
 * @param decimals Token decimals (default: 9 for SOL)
 * @returns Formatted amount string
 */
export function formatTokenAmount(amount: number, decimals = 9): string {
  if (amount === 0) return '0';
  
  const formattedAmount = amount.toFixed(decimals);
  // Remove trailing zeros
  return formattedAmount.replace(/\.?0+$/, '');
}

/**
 * Calculates the minimum amount out based on slippage tolerance
 * @param expectedAmount Expected output amount
 * @param slippagePercentage Slippage tolerance percentage (default: DEFAULT_SLIPPAGE)
 * @returns Minimum amount out accounting for slippage
 */
export function calculateMinimumAmountOut(
  expectedAmount: number,
  slippagePercentage: number = DEFAULT_SLIPPAGE
): number {
  if (!expectedAmount) return 0;
  
  const slippageFactor = 1 - (slippagePercentage / 100);
  return expectedAmount * slippageFactor;
}

/**
 * Calculate fee amount for a given trade
 * @param amount Trade amount
 * @param feePercentage Fee percentage (default: 0.3% which is common in AMMs)
 * @returns Fee amount
 */
export function calculateFee(amount: number, feePercentage = 0.3): number {
  return amount * (feePercentage / 100);
}

/**
 * Validate token address for Solana token format
 * @param address Token mint address
 * @returns True if it appears valid
 */
export function isValidTokenAddress(address: string): boolean {
  // Basic validation for Solana public key format
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Get estimated LP token amount from pool creation
 * @param baseAmount Amount of base token
 * @param quoteAmount Amount of quote token
 * @returns Estimated LP token amount
 */
export function estimateLpTokenAmount(baseAmount: number, quoteAmount: number): number {
  // Simplified square root formula commonly used in AMMs
  return Math.sqrt(baseAmount * quoteAmount);
} 