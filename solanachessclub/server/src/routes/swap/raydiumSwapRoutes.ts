import { Router } from 'express';
import { raydiumSwapHandler } from '../../controllers/raydiumSwapController';

const raydiumSwapRouter = Router();

/**
 * POST /api/raydium/swap
 * Single entry point for all Raydium swap operations
 * Handles the complete process of:
 * - Getting quotes
 * - Building transactions
 * - Returning the transaction for signing
 */
raydiumSwapRouter.post('/', raydiumSwapHandler);

export default raydiumSwapRouter; 