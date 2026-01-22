export const formatAmount = (value: number | null | undefined): string => {
  // Return a default value if null or undefined
  if (value === null || value === undefined) {
    return '0.00';
  }

  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  } else {
    return `${value.toFixed(2)}`;
  }
};

/**
 * Formats liquidity score as a percentage
 * @param score Liquidity score
 * @returns Formatted percentage string
 */
export const formatLiquidityAsPercentage = (
  score: number | null | undefined,
): string => {
  // Return a default value if null or undefined
  if (score === null || score === undefined) {
    return '0.00%';
  }

  return `${score.toFixed(2)}%`;
};
