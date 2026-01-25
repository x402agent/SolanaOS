/**
 * $OS Token Configuration
 *
 * The $OS token is the native utility token for Solana OS ecosystem.
 * Token holders can:
 * - Earn SOL rewards for holding and staking
 * - Deploy agents and applications on the platform
 * - Access premium features and reduced fees
 * - Participate in governance decisions
 */

import { CLUSTER } from '@env';

// ===========================================
// $OS TOKEN CORE CONFIGURATION
// ===========================================

/**
 * Official $OS Token Mint Address on Solana Mainnet
 * Pump.fun launched token
 */
export const OS_TOKEN_MINT = 'DrU9M6SUaXWua49zeaHQWJuwMpcZ4jMDRT3J5Ywpump';

/**
 * Token metadata
 */
export const OS_TOKEN_METADATA = {
  name: 'Solana OS',
  symbol: '$OS',
  decimals: 6,
  mint: OS_TOKEN_MINT,
  description: 'The native utility token for Solana OS - Build, Deploy, and Earn',
  website: 'https://solanaos.io',
  twitter: 'https://twitter.com/SolanaOS',
  telegram: 'https://t.me/SolanaOS',
};

// ===========================================
// DEVELOPER REWARDS TIERS
// ===========================================

/**
 * Reward tiers based on $OS token holdings
 * Higher holdings = more SOL rewards and benefits
 */
export const OS_REWARD_TIERS = {
  // Tier 1: Explorer - Entry level
  EXPLORER: {
    name: 'Explorer',
    minHolding: 1000,        // Minimum $OS tokens required
    solRewardMultiplier: 1,   // Base reward multiplier
    deploymentDiscount: 0,    // No discount
    maxAgents: 1,             // Can deploy 1 agent
    maxApps: 1,               // Can deploy 1 app
    features: ['basic_agent_deployment', 'community_support'],
  },

  // Tier 2: Builder - Active developers
  BUILDER: {
    name: 'Builder',
    minHolding: 10000,
    solRewardMultiplier: 1.5,
    deploymentDiscount: 10,   // 10% discount on deployment fees
    maxAgents: 5,
    maxApps: 3,
    features: ['basic_agent_deployment', 'priority_support', 'analytics_dashboard'],
  },

  // Tier 3: Architect - Serious builders
  ARCHITECT: {
    name: 'Architect',
    minHolding: 50000,
    solRewardMultiplier: 2,
    deploymentDiscount: 25,
    maxAgents: 20,
    maxApps: 10,
    features: ['advanced_agent_deployment', 'priority_support', 'analytics_dashboard', 'custom_domains'],
  },

  // Tier 4: Visionary - Major stakeholders
  VISIONARY: {
    name: 'Visionary',
    minHolding: 100000,
    solRewardMultiplier: 3,
    deploymentDiscount: 50,
    maxAgents: -1,            // Unlimited
    maxApps: -1,              // Unlimited
    features: ['all_features', 'dedicated_support', 'early_access', 'governance_voting'],
  },
};

// ===========================================
// DEPLOYMENT FEES (in $OS tokens)
// ===========================================

export const OS_DEPLOYMENT_FEES = {
  // Agent deployment fees
  agent: {
    basic: 100,       // Simple chatbot agents
    standard: 500,    // Standard trading agents
    advanced: 1000,   // Complex multi-tool agents
    enterprise: 5000, // Custom enterprise solutions
  },

  // App deployment fees
  app: {
    basic: 200,       // Simple single-page apps
    standard: 1000,   // Standard web apps
    advanced: 2500,   // Full-featured applications
    enterprise: 10000,// Custom enterprise apps
  },

  // Monthly hosting fees (in $OS)
  hosting: {
    basic: 50,        // Shared resources
    standard: 200,    // Dedicated resources
    premium: 500,     // High-performance
  },
};

// ===========================================
// SOL REWARDS DISTRIBUTION
// ===========================================

export const OS_SOL_REWARDS = {
  // Percentage of platform fees distributed to $OS holders
  holderRewardPercent: 30,

  // Minimum SOL balance in rewards pool before distribution
  minPoolBalance: 1.0,

  // Distribution frequency (in hours)
  distributionInterval: 24,

  // Reward calculation: (userOsBalance / totalOsStaked) * poolBalance * tierMultiplier

  // Activity bonuses (extra SOL for active developers)
  activityBonuses: {
    deployAgent: 0.001,      // SOL bonus for deploying an agent
    deployApp: 0.002,        // SOL bonus for deploying an app
    userInteraction: 0.0001, // SOL per unique user interaction
    weeklyActive: 0.01,      // Weekly activity bonus
    monthlyShipping: 0.05,   // Monthly bonus for shipping updates
  },
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get user's reward tier based on $OS holdings
 */
export function getUserTier(osBalance: number): keyof typeof OS_REWARD_TIERS {
  if (osBalance >= OS_REWARD_TIERS.VISIONARY.minHolding) return 'VISIONARY';
  if (osBalance >= OS_REWARD_TIERS.ARCHITECT.minHolding) return 'ARCHITECT';
  if (osBalance >= OS_REWARD_TIERS.BUILDER.minHolding) return 'BUILDER';
  if (osBalance >= OS_REWARD_TIERS.EXPLORER.minHolding) return 'EXPLORER';
  return 'EXPLORER'; // Default tier, but user won't qualify for rewards
}

/**
 * Calculate deployment fee with tier discount
 */
export function calculateDeploymentFee(
  type: 'agent' | 'app',
  tier: 'basic' | 'standard' | 'advanced' | 'enterprise',
  userTier: keyof typeof OS_REWARD_TIERS
): number {
  const baseFee = OS_DEPLOYMENT_FEES[type][tier];
  const discount = OS_REWARD_TIERS[userTier].deploymentDiscount;
  return baseFee * (1 - discount / 100);
}

/**
 * Check if user can deploy based on their tier limits
 */
export function canDeploy(
  userTier: keyof typeof OS_REWARD_TIERS,
  type: 'agent' | 'app',
  currentDeployments: number
): boolean {
  const limits = OS_REWARD_TIERS[userTier];
  const maxAllowed = type === 'agent' ? limits.maxAgents : limits.maxApps;

  if (maxAllowed === -1) return true; // Unlimited
  return currentDeployments < maxAllowed;
}

/**
 * Calculate estimated SOL rewards for a holder
 */
export function estimateSolRewards(
  userOsBalance: number,
  totalOsStaked: number,
  poolBalance: number
): number {
  if (userOsBalance === 0 || totalOsStaked === 0) return 0;

  const userTier = getUserTier(userOsBalance);
  const multiplier = OS_REWARD_TIERS[userTier].solRewardMultiplier;
  const userShare = userOsBalance / totalOsStaked;

  return userShare * poolBalance * multiplier * (OS_SOL_REWARDS.holderRewardPercent / 100);
}
