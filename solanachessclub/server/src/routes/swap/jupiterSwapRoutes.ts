import {Router, Request, Response} from 'express';
import {jupiterSwapHandler} from '../../controllers/jupiterSwapController';

const jupiterSwapRouter = Router();

/**
 * POST /api/jupiter/swap
 * For performing Jupiter swaps via server.
 */
jupiterSwapRouter.post('/swap', jupiterSwapHandler);

export default jupiterSwapRouter;
