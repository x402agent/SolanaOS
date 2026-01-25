/**
 * $OS Token Service
 *
 * Handles all $OS token operations including:
 * - Balance verification
 * - Tier calculation
 * - Rewards distribution
 * - Deployment fee processing
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

// ===========================================
// CONFIGURATION
// ===========================================

// $OS Token Mint Address (Pump.fun launched)
export const OS_TOKEN_MINT = new PublicKey('DrU9M6SUaXWua49zeaHQWJuwMpcZ4jMDRT3J5Ywpump');

// Token decimals
export const OS_TOKEN_DECIMALS = 6;

// Reward tiers configuration
export const REWARD_TIERS = {
  EXPLORER: { minHolding: 1000, multiplier: 1, discount: 0, maxAgents: 1, maxApps: 1 },
  BUILDER: { minHolding: 10000, multiplier: 1.5, discount: 10, maxAgents: 5, maxApps: 3 },
  ARCHITECT: { minHolding: 50000, multiplier: 2, discount: 25, maxAgents: 20, maxApps: 10 },
  VISIONARY: { minHolding: 100000, multiplier: 3, discount: 50, maxAgents: -1, maxApps: -1 },
} as const;

export type RewardTier = keyof typeof REWARD_TIERS;

// ===========================================
// CONNECTION
// ===========================================

const getRpcUrl = (): string => {
  return process.env.SOLANA_RPC_URL ||
         process.env.HELIUS_STAKED_URL ||
         'https://api.mainnet-beta.solana.com';
};

const getConnection = (): Connection => {
  return new Connection(getRpcUrl(), 'confirmed');
};

// ===========================================
// BALANCE OPERATIONS
// ===========================================

/**
 * Get $OS token balance for a wallet
 */
export async function getOsTokenBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection();
    const walletPubkey = new PublicKey(walletAddress);

    // Get the associated token account for $OS
    const tokenAccount = await getAssociatedTokenAddress(
      OS_TOKEN_MINT,
      walletPubkey
    );

    try {
      const account = await getAccount(connection, tokenAccount);
      // Convert from raw amount to tokens (accounting for decimals)
      return Number(account.amount) / Math.pow(10, OS_TOKEN_DECIMALS);
    } catch (e) {
      // Token account doesn't exist = 0 balance
      return 0;
    }
  } catch (error) {
    console.error('[OsTokenService] Error getting balance:', error);
    throw error;
  }
}

/**
 * Verify wallet has minimum $OS holdings
 */
export async function verifyMinimumHolding(
  walletAddress: string,
  minimumRequired: number
): Promise<{ valid: boolean; balance: number; shortfall: number }> {
  const balance = await getOsTokenBalance(walletAddress);
  const shortfall = Math.max(0, minimumRequired - balance);

  return {
    valid: balance >= minimumRequired,
    balance,
    shortfall,
  };
}

// ===========================================
// TIER OPERATIONS
// ===========================================

/**
 * Get user's reward tier based on $OS holdings
 */
export function calculateTier(osBalance: number): RewardTier {
  if (osBalance >= REWARD_TIERS.VISIONARY.minHolding) return 'VISIONARY';
  if (osBalance >= REWARD_TIERS.ARCHITECT.minHolding) return 'ARCHITECT';
  if (osBalance >= REWARD_TIERS.BUILDER.minHolding) return 'BUILDER';
  return 'EXPLORER';
}

/**
 * Get full tier info for a wallet
 */
export async function getWalletTierInfo(walletAddress: string): Promise<{
  balance: number;
  tier: RewardTier;
  tierInfo: typeof REWARD_TIERS[RewardTier];
  nextTier: RewardTier | null;
  tokensToNextTier: number;
}> {
  const balance = await getOsTokenBalance(walletAddress);
  const tier = calculateTier(balance);
  const tierInfo = REWARD_TIERS[tier];

  // Calculate next tier
  const tierOrder: RewardTier[] = ['EXPLORER', 'BUILDER', 'ARCHITECT', 'VISIONARY'];
  const currentIndex = tierOrder.indexOf(tier);
  const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  const tokensToNextTier = nextTier ? REWARD_TIERS[nextTier].minHolding - balance : 0;

  return {
    balance,
    tier,
    tierInfo,
    nextTier,
    tokensToNextTier: Math.max(0, tokensToNextTier),
  };
}

// ===========================================
// DEPLOYMENT ELIGIBILITY
// ===========================================

/**
 * Check if user can deploy an agent or app
 */
export async function checkDeploymentEligibility(
  walletAddress: string,
  type: 'agent' | 'app',
  currentDeployments: number
): Promise<{
  eligible: boolean;
  reason?: string;
  tier: RewardTier;
  deploymentsRemaining: number;
}> {
  const tierInfo = await getWalletTierInfo(walletAddress);
  const maxAllowed = type === 'agent' ? tierInfo.tierInfo.maxAgents : tierInfo.tierInfo.maxApps;

  // Unlimited (-1) or under limit
  const unlimited = maxAllowed === -1;
  const underLimit = currentDeployments < maxAllowed;

  if (!unlimited && !underLimit) {
    return {
      eligible: false,
      reason: `Maximum ${type} deployments reached for ${tierInfo.tier} tier. Upgrade by holding more $OS.`,
      tier: tierInfo.tier,
      deploymentsRemaining: 0,
    };
  }

  // Check minimum holding
  if (tierInfo.balance < REWARD_TIERS.EXPLORER.minHolding) {
    return {
      eligible: false,
      reason: `Minimum ${REWARD_TIERS.EXPLORER.minHolding} $OS required. Current balance: ${tierInfo.balance}`,
      tier: tierInfo.tier,
      deploymentsRemaining: 0,
    };
  }

  return {
    eligible: true,
    tier: tierInfo.tier,
    deploymentsRemaining: unlimited ? -1 : maxAllowed - currentDeployments,
  };
}

// ===========================================
// FEE CALCULATIONS
// ===========================================

const DEPLOYMENT_FEES = {
  agent: { basic: 100, standard: 500, advanced: 1000, enterprise: 5000 },
  app: { basic: 200, standard: 1000, advanced: 2500, enterprise: 10000 },
};

/**
 * Calculate deployment fee with tier discount
 */
export function calculateDeploymentFee(
  type: 'agent' | 'app',
  tier: 'basic' | 'standard' | 'advanced' | 'enterprise',
  userTier: RewardTier
): { baseFee: number; discount: number; finalFee: number } {
  const baseFee = DEPLOYMENT_FEES[type][tier];
  const discountPercent = REWARD_TIERS[userTier].discount;
  const discount = baseFee * (discountPercent / 100);
  const finalFee = baseFee - discount;

  return {
    baseFee,
    discount,
    finalFee,
  };
}

// ===========================================
// REWARDS DISTRIBUTION
// ===========================================

export interface RewardDistribution {
  wallet: string;
  osBalance: number;
  tier: RewardTier;
  sharePercent: number;
  solReward: number;
}

/**
 * Calculate rewards distribution for all eligible holders
 */
export async function calculateRewardsDistribution(
  holders: { wallet: string; balance: number }[],
  totalPoolSol: number
): Promise<{
  distributions: RewardDistribution[];
  totalDistributed: number;
  platformRetained: number;
}> {
  // Filter eligible holders (minimum EXPLORER tier)
  const eligibleHolders = holders.filter(h => h.balance >= REWARD_TIERS.EXPLORER.minHolding);

  if (eligibleHolders.length === 0) {
    return {
      distributions: [],
      totalDistributed: 0,
      platformRetained: totalPoolSol,
    };
  }

  // Calculate weighted total (balance * tier multiplier)
  let weightedTotal = 0;
  const holderWeights = eligibleHolders.map(h => {
    const tier = calculateTier(h.balance);
    const weight = h.balance * REWARD_TIERS[tier].multiplier;
    weightedTotal += weight;
    return { ...h, tier, weight };
  });

  // 30% of pool goes to holders
  const holderPoolPercent = 0.30;
  const holderPool = totalPoolSol * holderPoolPercent;

  // Calculate individual distributions
  const distributions: RewardDistribution[] = holderWeights.map(h => {
    const sharePercent = (h.weight / weightedTotal) * 100;
    const solReward = (h.weight / weightedTotal) * holderPool;

    return {
      wallet: h.wallet,
      osBalance: h.balance,
      tier: h.tier,
      sharePercent,
      solReward,
    };
  });

  const totalDistributed = distributions.reduce((sum, d) => sum + d.solReward, 0);

  return {
    distributions,
    totalDistributed,
    platformRetained: totalPoolSol - totalDistributed,
  };
}

/**
 * Get estimated SOL rewards for a single holder
 */
export function estimateHolderRewards(
  userBalance: number,
  totalStaked: number,
  poolBalance: number
): {
  tier: RewardTier;
  multiplier: number;
  estimatedSol: number;
  dailyEstimate: number;
  monthlyEstimate: number;
} {
  if (userBalance === 0 || totalStaked === 0 || poolBalance === 0) {
    return {
      tier: 'EXPLORER',
      multiplier: 1,
      estimatedSol: 0,
      dailyEstimate: 0,
      monthlyEstimate: 0,
    };
  }

  const tier = calculateTier(userBalance);
  const multiplier = REWARD_TIERS[tier].multiplier;
  const userWeight = userBalance * multiplier;

  // Estimate total weighted (assume average multiplier of 1.5)
  const estimatedTotalWeight = totalStaked * 1.5;

  const holderPool = poolBalance * 0.30;
  const estimatedSol = (userWeight / estimatedTotalWeight) * holderPool;

  return {
    tier,
    multiplier,
    estimatedSol,
    dailyEstimate: estimatedSol,
    monthlyEstimate: estimatedSol * 30,
  };
}

// ===========================================
// DEVELOPER ACTIVITY REWARDS
// ===========================================

const ACTIVITY_REWARDS_SOL = {
  deployAgent: 0.001,
  deployApp: 0.002,
  userInteraction: 0.0001,
  weeklyActive: 0.01,
  monthlyShip: 0.05,
};

/**
 * Calculate activity bonus for a developer
 */
export function calculateActivityBonus(activity: {
  agentsDeployed: number;
  appsDeployed: number;
  uniqueUsers: number;
  weeklyActive: boolean;
  shippedThisMonth: boolean;
}): { totalSol: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {
    deployAgent: activity.agentsDeployed * ACTIVITY_REWARDS_SOL.deployAgent,
    deployApp: activity.appsDeployed * ACTIVITY_REWARDS_SOL.deployApp,
    userInteraction: activity.uniqueUsers * ACTIVITY_REWARDS_SOL.userInteraction,
    weeklyActive: activity.weeklyActive ? ACTIVITY_REWARDS_SOL.weeklyActive : 0,
    monthlyShip: activity.shippedThisMonth ? ACTIVITY_REWARDS_SOL.monthlyShip : 0,
  };

  const totalSol = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return { totalSol, breakdown };
}

export default {
  OS_TOKEN_MINT,
  getOsTokenBalance,
  verifyMinimumHolding,
  calculateTier,
  getWalletTierInfo,
  checkDeploymentEligibility,
  calculateDeploymentFee,
  calculateRewardsDistribution,
  estimateHolderRewards,
  calculateActivityBonus,
};
