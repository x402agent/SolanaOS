import { Router } from 'express';
import {
  getUltraSwapOrderHandler,
  executeUltraSwapOrderHandler,
  getUltraBalancesHandler
} from '../../controllers/jupiterUltraSwapController';

const jupiterUltraSwapRouter = Router();

/**
 * POST /api/jupiter/ultra/order
 * Get a swap order from Jupiter Ultra API
 */
jupiterUltraSwapRouter.post('/order', getUltraSwapOrderHandler);

/**
 * POST /api/jupiter/ultra/execute
 * Execute a swap order via Jupiter Ultra API
 */
jupiterUltraSwapRouter.post('/execute', executeUltraSwapOrderHandler);

/**
 * GET /api/jupiter/ultra/balances
 * Get token balances for a wallet via Jupiter Ultra API
 */
jupiterUltraSwapRouter.get('/balances', getUltraBalancesHandler);

export default jupiterUltraSwapRouter; 