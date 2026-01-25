/**
 * Solana OS Deployment Service
 *
 * Enables developers to deploy agents and apps using $OS tokens.
 * Handles:
 * - Deployment validation and eligibility
 * - $OS fee processing
 * - Agent/App registry management
 * - Hosting and runtime management
 */

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getOsTokenBalance,
  calculateTier,
  checkDeploymentEligibility,
  calculateDeploymentFee,
  REWARD_TIERS,
  RewardTier,
} from './osTokenService';

// ===========================================
// TYPES
// ===========================================

export interface AgentConfig {
  name: string;
  description: string;
  type: 'basic' | 'standard' | 'advanced' | 'enterprise';
  tools: string[];
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'llama-3';
  systemPrompt: string;
  publicAccess: boolean;
  metadata?: Record<string, any>;
}

export interface AppConfig {
  name: string;
  description: string;
  type: 'basic' | 'standard' | 'advanced' | 'enterprise';
  framework: 'react' | 'next' | 'vue' | 'svelte';
  features: string[];
  customDomain?: string;
  metadata?: Record<string, any>;
}

export interface Deployment {
  id: string;
  ownerWallet: string;
  type: 'agent' | 'app';
  config: AgentConfig | AppConfig;
  status: 'pending' | 'deploying' | 'active' | 'paused' | 'terminated';
  deploymentUrl: string;
  createdAt: Date;
  updatedAt: Date;
  osFeesPaid: number;
  monthlyHostingFee: number;
  stats: {
    totalUsers: number;
    totalInteractions: number;
    lastActiveAt: Date | null;
  };
}

// ===========================================
// IN-MEMORY REGISTRY (Replace with DB in production)
// ===========================================

const deployments: Map<string, Deployment> = new Map();
const deploymentsByWallet: Map<string, string[]> = new Map();

// ===========================================
// DEPLOYMENT OPERATIONS
// ===========================================

/**
 * Create a new agent deployment
 */
export async function deployAgent(
  walletAddress: string,
  config: AgentConfig
): Promise<{
  success: boolean;
  deployment?: Deployment;
  error?: string;
  feeDetails?: { baseFee: number; discount: number; finalFee: number };
}> {
  try {
    // Get current deployments for this wallet
    const walletDeployments = deploymentsByWallet.get(walletAddress) || [];
    const agentCount = walletDeployments.filter(id => {
      const d = deployments.get(id);
      return d && d.type === 'agent' && d.status !== 'terminated';
    }).length;

    // Check eligibility
    const eligibility = await checkDeploymentEligibility(walletAddress, 'agent', agentCount);
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason,
      };
    }

    // Calculate fee
    const feeDetails = calculateDeploymentFee('agent', config.type, eligibility.tier);

    // Verify user has enough $OS
    const balance = await getOsTokenBalance(walletAddress);
    if (balance < feeDetails.finalFee) {
      return {
        success: false,
        error: `Insufficient $OS balance. Required: ${feeDetails.finalFee}, Available: ${balance}`,
        feeDetails,
      };
    }

    // Create deployment
    const deploymentId = generateDeploymentId();
    const deployment: Deployment = {
      id: deploymentId,
      ownerWallet: walletAddress,
      type: 'agent',
      config,
      status: 'active',
      deploymentUrl: `https://agents.solanaos.io/${deploymentId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      osFeesPaid: feeDetails.finalFee,
      monthlyHostingFee: getHostingFee(config.type),
      stats: {
        totalUsers: 0,
        totalInteractions: 0,
        lastActiveAt: null,
      },
    };

    // Store deployment
    deployments.set(deploymentId, deployment);
    const existingDeployments = deploymentsByWallet.get(walletAddress) || [];
    deploymentsByWallet.set(walletAddress, [...existingDeployments, deploymentId]);

    console.log(`[DeploymentService] Agent deployed: ${deploymentId} for wallet ${walletAddress}`);

    return {
      success: true,
      deployment,
      feeDetails,
    };
  } catch (error) {
    console.error('[DeploymentService] Error deploying agent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new app deployment
 */
export async function deployApp(
  walletAddress: string,
  config: AppConfig
): Promise<{
  success: boolean;
  deployment?: Deployment;
  error?: string;
  feeDetails?: { baseFee: number; discount: number; finalFee: number };
}> {
  try {
    // Get current deployments for this wallet
    const walletDeployments = deploymentsByWallet.get(walletAddress) || [];
    const appCount = walletDeployments.filter(id => {
      const d = deployments.get(id);
      return d && d.type === 'app' && d.status !== 'terminated';
    }).length;

    // Check eligibility
    const eligibility = await checkDeploymentEligibility(walletAddress, 'app', appCount);
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason,
      };
    }

    // Calculate fee
    const feeDetails = calculateDeploymentFee('app', config.type, eligibility.tier);

    // Verify user has enough $OS
    const balance = await getOsTokenBalance(walletAddress);
    if (balance < feeDetails.finalFee) {
      return {
        success: false,
        error: `Insufficient $OS balance. Required: ${feeDetails.finalFee}, Available: ${balance}`,
        feeDetails,
      };
    }

    // Create deployment
    const deploymentId = generateDeploymentId();
    const subdomain = config.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const deployment: Deployment = {
      id: deploymentId,
      ownerWallet: walletAddress,
      type: 'app',
      config,
      status: 'active',
      deploymentUrl: config.customDomain || `https://${subdomain}.solanaos.io`,
      createdAt: new Date(),
      updatedAt: new Date(),
      osFeesPaid: feeDetails.finalFee,
      monthlyHostingFee: getHostingFee(config.type),
      stats: {
        totalUsers: 0,
        totalInteractions: 0,
        lastActiveAt: null,
      },
    };

    // Store deployment
    deployments.set(deploymentId, deployment);
    const existingDeployments = deploymentsByWallet.get(walletAddress) || [];
    deploymentsByWallet.set(walletAddress, [...existingDeployments, deploymentId]);

    console.log(`[DeploymentService] App deployed: ${deploymentId} for wallet ${walletAddress}`);

    return {
      success: true,
      deployment,
      feeDetails,
    };
  } catch (error) {
    console.error('[DeploymentService] Error deploying app:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all deployments for a wallet
 */
export async function getWalletDeployments(walletAddress: string): Promise<{
  agents: Deployment[];
  apps: Deployment[];
  tier: RewardTier;
  limits: {
    maxAgents: number;
    maxApps: number;
    agentsRemaining: number;
    appsRemaining: number;
  };
}> {
  const deploymentIds = deploymentsByWallet.get(walletAddress) || [];
  const walletDeployments = deploymentIds
    .map(id => deployments.get(id))
    .filter((d): d is Deployment => d !== undefined && d.status !== 'terminated');

  const agents = walletDeployments.filter(d => d.type === 'agent');
  const apps = walletDeployments.filter(d => d.type === 'app');

  const balance = await getOsTokenBalance(walletAddress);
  const tier = calculateTier(balance);
  const tierLimits = REWARD_TIERS[tier];

  return {
    agents,
    apps,
    tier,
    limits: {
      maxAgents: tierLimits.maxAgents,
      maxApps: tierLimits.maxApps,
      agentsRemaining: tierLimits.maxAgents === -1 ? -1 : Math.max(0, tierLimits.maxAgents - agents.length),
      appsRemaining: tierLimits.maxApps === -1 ? -1 : Math.max(0, tierLimits.maxApps - apps.length),
    },
  };
}

/**
 * Get a specific deployment
 */
export function getDeployment(deploymentId: string): Deployment | undefined {
  return deployments.get(deploymentId);
}

/**
 * Update deployment status
 */
export async function updateDeploymentStatus(
  deploymentId: string,
  walletAddress: string,
  status: 'active' | 'paused' | 'terminated'
): Promise<{ success: boolean; error?: string }> {
  const deployment = deployments.get(deploymentId);

  if (!deployment) {
    return { success: false, error: 'Deployment not found' };
  }

  if (deployment.ownerWallet !== walletAddress) {
    return { success: false, error: 'Unauthorized: You do not own this deployment' };
  }

  deployment.status = status;
  deployment.updatedAt = new Date();
  deployments.set(deploymentId, deployment);

  console.log(`[DeploymentService] Deployment ${deploymentId} status updated to ${status}`);

  return { success: true };
}

/**
 * Record user interaction with a deployment
 */
export function recordInteraction(deploymentId: string, uniqueUser: boolean): void {
  const deployment = deployments.get(deploymentId);
  if (deployment) {
    deployment.stats.totalInteractions++;
    if (uniqueUser) {
      deployment.stats.totalUsers++;
    }
    deployment.stats.lastActiveAt = new Date();
    deployments.set(deploymentId, deployment);
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateDeploymentId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'os_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getHostingFee(type: 'basic' | 'standard' | 'advanced' | 'enterprise'): number {
  const fees = {
    basic: 50,
    standard: 200,
    advanced: 500,
    enterprise: 1000,
  };
  return fees[type];
}

// ===========================================
// PUBLIC AGENT/APP DISCOVERY
// ===========================================

/**
 * Get all public deployments for discovery
 */
export function getPublicDeployments(
  type?: 'agent' | 'app',
  limit: number = 50
): Deployment[] {
  const allDeployments = Array.from(deployments.values());

  return allDeployments
    .filter(d => {
      if (d.status !== 'active') return false;
      if (type && d.type !== type) return false;

      // Check if public access is enabled
      if (d.type === 'agent') {
        return (d.config as AgentConfig).publicAccess;
      }
      return true; // Apps are public by default
    })
    .sort((a, b) => b.stats.totalUsers - a.stats.totalUsers)
    .slice(0, limit);
}

/**
 * Search deployments by name or description
 */
export function searchDeployments(
  query: string,
  type?: 'agent' | 'app'
): Deployment[] {
  const normalizedQuery = query.toLowerCase();

  return Array.from(deployments.values()).filter(d => {
    if (d.status !== 'active') return false;
    if (type && d.type !== type) return false;

    const config = d.config;
    return (
      config.name.toLowerCase().includes(normalizedQuery) ||
      config.description.toLowerCase().includes(normalizedQuery)
    );
  });
}

export default {
  deployAgent,
  deployApp,
  getWalletDeployments,
  getDeployment,
  updateDeploymentStatus,
  recordInteraction,
  getPublicDeployments,
  searchDeployments,
};
