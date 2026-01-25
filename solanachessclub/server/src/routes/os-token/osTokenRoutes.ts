/**
 * $OS Token API Routes
 *
 * Endpoints for:
 * - Token balance and tier info
 * - Developer rewards
 * - Agent/App deployment
 */

import express, { Request, Response } from 'express';
import osTokenService from '../../service/os-token/osTokenService';
import deploymentService, {
  AgentConfig,
  AppConfig,
} from '../../service/os-token/deploymentService';

const router = express.Router();

// ===========================================
// TOKEN INFO ENDPOINTS
// ===========================================

/**
 * GET /api/os-token/info
 * Get $OS token information
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      mint: osTokenService.OS_TOKEN_MINT.toString(),
      name: 'Solana OS',
      symbol: '$OS',
      decimals: 6,
      website: 'https://solanaos.io',
      description: 'The native utility token for Solana OS ecosystem',
      tiers: osTokenService.REWARD_TIERS,
    },
  });
});

/**
 * GET /api/os-token/balance/:wallet
 * Get $OS balance for a wallet
 */
router.get('/balance/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    const balance = await osTokenService.getOsTokenBalance(wallet);

    res.json({
      success: true,
      data: {
        wallet,
        balance,
        formatted: `${balance.toLocaleString()} $OS`,
      },
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get token balance',
    });
  }
});

/**
 * GET /api/os-token/tier/:wallet
 * Get tier info for a wallet
 */
router.get('/tier/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    const tierInfo = await osTokenService.getWalletTierInfo(wallet);

    res.json({
      success: true,
      data: tierInfo,
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error getting tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tier info',
    });
  }
});

// ===========================================
// REWARDS ENDPOINTS
// ===========================================

/**
 * GET /api/os-token/rewards/estimate/:wallet
 * Estimate SOL rewards for a holder
 */
router.get('/rewards/estimate/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const { totalStaked = '1000000', poolBalance = '10' } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    const userBalance = await osTokenService.getOsTokenBalance(wallet);
    const estimate = osTokenService.estimateHolderRewards(
      userBalance,
      Number(totalStaked),
      Number(poolBalance)
    );

    res.json({
      success: true,
      data: {
        wallet,
        osBalance: userBalance,
        ...estimate,
      },
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error estimating rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate rewards',
    });
  }
});

/**
 * POST /api/os-token/rewards/activity
 * Calculate activity bonus for a developer
 */
router.post('/rewards/activity', (req: Request, res: Response) => {
  try {
    const activity = req.body;

    const bonus = osTokenService.calculateActivityBonus({
      agentsDeployed: activity.agentsDeployed || 0,
      appsDeployed: activity.appsDeployed || 0,
      uniqueUsers: activity.uniqueUsers || 0,
      weeklyActive: activity.weeklyActive || false,
      shippedThisMonth: activity.shippedThisMonth || false,
    });

    res.json({
      success: true,
      data: bonus,
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error calculating activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate activity bonus',
    });
  }
});

// ===========================================
// DEPLOYMENT ENDPOINTS
// ===========================================

/**
 * POST /api/os-token/deploy/agent
 * Deploy a new agent
 */
router.post('/deploy/agent', async (req: Request, res: Response) => {
  try {
    const { wallet, config } = req.body as { wallet: string; config: AgentConfig };

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    if (!config || !config.name || !config.type) {
      return res.status(400).json({
        success: false,
        error: 'Agent config with name and type is required',
      });
    }

    const result = await deploymentService.deployAgent(wallet, config);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        feeDetails: result.feeDetails,
      });
    }

    res.json({
      success: true,
      data: {
        deployment: result.deployment,
        feeDetails: result.feeDetails,
        message: 'Agent deployed successfully!',
      },
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error deploying agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deploy agent',
    });
  }
});

/**
 * POST /api/os-token/deploy/app
 * Deploy a new app
 */
router.post('/deploy/app', async (req: Request, res: Response) => {
  try {
    const { wallet, config } = req.body as { wallet: string; config: AppConfig };

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    if (!config || !config.name || !config.type) {
      return res.status(400).json({
        success: false,
        error: 'App config with name and type is required',
      });
    }

    const result = await deploymentService.deployApp(wallet, config);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        feeDetails: result.feeDetails,
      });
    }

    res.json({
      success: true,
      data: {
        deployment: result.deployment,
        feeDetails: result.feeDetails,
        message: 'App deployed successfully!',
      },
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error deploying app:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deploy app',
    });
  }
});

/**
 * GET /api/os-token/deployments/:wallet
 * Get all deployments for a wallet
 */
router.get('/deployments/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    const deployments = await deploymentService.getWalletDeployments(wallet);

    res.json({
      success: true,
      data: deployments,
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error getting deployments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployments',
    });
  }
});

/**
 * GET /api/os-token/deployment/:id
 * Get a specific deployment
 */
router.get('/deployment/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deployment = deploymentService.getDeployment(id);

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error getting deployment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment',
    });
  }
});

/**
 * PATCH /api/os-token/deployment/:id/status
 * Update deployment status
 */
router.patch('/deployment/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { wallet, status } = req.body;

    if (!wallet || !status) {
      return res.status(400).json({
        success: false,
        error: 'Wallet and status are required',
      });
    }

    if (!['active', 'paused', 'terminated'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be active, paused, or terminated',
      });
    }

    const result = await deploymentService.updateDeploymentStatus(id, wallet, status);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: `Deployment status updated to ${status}`,
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error updating status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update deployment status',
    });
  }
});

/**
 * GET /api/os-token/discover
 * Discover public agents and apps
 */
router.get('/discover', (req: Request, res: Response) => {
  try {
    const { type, limit = '50' } = req.query;

    const deployments = deploymentService.getPublicDeployments(
      type as 'agent' | 'app' | undefined,
      Number(limit)
    );

    res.json({
      success: true,
      data: {
        deployments,
        total: deployments.length,
      },
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error discovering:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover deployments',
    });
  }
});

/**
 * GET /api/os-token/search
 * Search for agents and apps
 */
router.get('/search', (req: Request, res: Response) => {
  try {
    const { q, type } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    const results = deploymentService.searchDeployments(
      q as string,
      type as 'agent' | 'app' | undefined
    );

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        query: q,
      },
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error searching:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search deployments',
    });
  }
});

/**
 * GET /api/os-token/eligibility/:wallet
 * Check deployment eligibility for a wallet
 */
router.get('/eligibility/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const { type = 'agent' } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    // Get current deployments count
    const deployments = await deploymentService.getWalletDeployments(wallet);
    const currentCount = type === 'agent' ? deployments.agents.length : deployments.apps.length;

    const eligibility = await osTokenService.checkDeploymentEligibility(
      wallet,
      type as 'agent' | 'app',
      currentCount
    );

    res.json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    console.error('[OsTokenRoutes] Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check eligibility',
    });
  }
});

/**
 * GET /api/os-token/fees
 * Get deployment fee schedule
 */
router.get('/fees', async (req: Request, res: Response) => {
  const { wallet } = req.query;

  let userTier: osTokenService.RewardTier = 'EXPLORER';

  if (wallet) {
    try {
      const balance = await osTokenService.getOsTokenBalance(wallet as string);
      userTier = osTokenService.calculateTier(balance);
    } catch (e) {
      // Use default tier
    }
  }

  const agentFees = {
    basic: osTokenService.calculateDeploymentFee('agent', 'basic', userTier),
    standard: osTokenService.calculateDeploymentFee('agent', 'standard', userTier),
    advanced: osTokenService.calculateDeploymentFee('agent', 'advanced', userTier),
    enterprise: osTokenService.calculateDeploymentFee('agent', 'enterprise', userTier),
  };

  const appFees = {
    basic: osTokenService.calculateDeploymentFee('app', 'basic', userTier),
    standard: osTokenService.calculateDeploymentFee('app', 'standard', userTier),
    advanced: osTokenService.calculateDeploymentFee('app', 'advanced', userTier),
    enterprise: osTokenService.calculateDeploymentFee('app', 'enterprise', userTier),
  };

  res.json({
    success: true,
    data: {
      userTier,
      agent: agentFees,
      app: appFees,
      hosting: {
        basic: 50,
        standard: 200,
        advanced: 500,
        enterprise: 1000,
      },
    },
  });
});

export default router;
