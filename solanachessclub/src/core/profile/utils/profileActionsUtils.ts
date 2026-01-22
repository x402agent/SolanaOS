/**
 * Profile actions service
 * Handles profile-related API calls and data transformations for wallet actions
 */

import COLORS from '@/assets/colors';
import { Action, TransactionEvents } from '../types/index';

/**
 * Format SOL amount from lamports
 * @param lamports - Amount in lamports
 * @returns Formatted SOL string with appropriate decimals
 */
export function formatSolAmount(lamports: number): string {
  // 1 SOL = 1,000,000,000 lamports (9 decimal places)
  const sol = lamports / 1_000_000_000;

  // For small amounts, show more decimal places
  if (Math.abs(sol) < 0.001) {
    // For very small amounts, show enough decimal places
    return sol.toLocaleString('en-US', {
      minimumFractionDigits: 9,
      maximumFractionDigits: 9,
      useGrouping: false,
    });
  } else if (Math.abs(sol) < 0.01) {
    return sol.toLocaleString('en-US', {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
      useGrouping: false,
    });
  }

  return sol.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
    useGrouping: false,
  });
}

/**
 * Format token amounts with appropriate decimal places
 * @param amount - Raw token amount
 * @param decimals - Token decimals
 * @returns Formatted token amount string
 */
export function formatTokenAmount(amount: number, decimals: number = 0): string {
  if (amount === 0 || decimals === 0) {
    return amount.toString();
  }

  const divisor = Math.pow(10, decimals);
  const convertedAmount = amount / divisor;

  // Adjust decimal places based on amount size
  if (Math.abs(convertedAmount) < 0.001) {
    return convertedAmount.toLocaleString('en-US', {
      minimumFractionDigits: Math.min(8, decimals),
      maximumFractionDigits: Math.min(8, decimals),
      useGrouping: false,
    });
  } else if (Math.abs(convertedAmount) < 0.01) {
    return convertedAmount.toLocaleString('en-US', {
      minimumFractionDigits: Math.min(6, decimals),
      maximumFractionDigits: Math.min(6, decimals),
      useGrouping: false,
    });
  }

  return convertedAmount.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(4, decimals),
    maximumFractionDigits: Math.min(4, decimals),
    useGrouping: false,
  });
}

/**
 * Get icon name and color for transaction type
 * @param type - Transaction type
 * @returns Object with icon name, color, and display label
 */
export function getTransactionTypeInfo(type: string): {
  icon: string;
  color: string;
  label: string;
} {
  const lowerType = type.toLowerCase();
  
  if (lowerType.includes('transfer')) {
    return {
      icon: 'exchange-alt',
      color: COLORS.brandBlue,
      label: 'Transfer',
    };
  }

  if (lowerType.includes('swap')) {
    return {
      icon: 'sync-alt',
      color: COLORS.brandBlue,
      label: 'Swap',
    };
  }

  if (lowerType.includes('buy')) {
    return {
      icon: 'shopping-cart',
      color: COLORS.brandPrimary,
      label: 'Buy',
    };
  }

  if (lowerType.includes('sell')) {
    return {
      icon: 'tag',
      color: COLORS.errorRed,
      label: 'Sell',
    };
  }

  if (lowerType.includes('stake')) {
    return {
      icon: 'certificate',
      color: COLORS.brandBlue,
      label: 'Stake',
    };
  }

  if (lowerType.includes('nft')) {
    return {
      icon: 'image',
      color: COLORS.brandPurple,
      label: 'NFT',
    };
  }

  if (lowerType.includes('sol') && lowerType.includes('transfer')) {
    return {
      icon: 'exchange-alt',
      color: COLORS.brandBlue,
      label: 'SOL Transfer',
    };
  } else if (lowerType.includes('token') && lowerType.includes('transfer')) {
    return {
      icon: 'exchange-alt',
      color: COLORS.brandBlue,
      label: 'Token Transfer',
    };
  }

  // Default case
  return {
    icon: 'receipt',
    color: COLORS.accessoryDarkColor,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  };
}

/**
 * Extract a transaction amount from the description if possible
 */
export function extractAmountFromDescription(
  description?: string,
): {amount: number; symbol: string} | null {
  if (!description) return null;

  // Match patterns like "0.0001 SOL" or "5 tokens"
  const amountMatch = description.match(/(\d+\.?\d*)\s+([A-Za-z]+)/);
  if (amountMatch && amountMatch.length >= 3) {
    const amount = parseFloat(amountMatch[1]);
    const symbol = amountMatch[2];

    if (!isNaN(amount)) {
      return {amount, symbol};
    }
  }

  return null;
}

/**
 * Truncate addresses: abcd...wxyz
 * @param address - Wallet or token address
 * @returns Truncated address string
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return address.slice(0, 4) + '...' + address.slice(-4);
}

/**
 * Format timestamp to time-ago string
 * @param timestampSeconds - Timestamp in seconds
 * @returns Formatted time-ago string
 */
export function getTimeAgo(timestampSeconds: number): string {
  const nowMs = Date.now();
  const txMs = timestampSeconds * 1000;
  const diff = nowMs - txMs;
  if (diff < 0) return 'just now';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
} 