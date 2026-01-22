// FILE: server/src/routes/profileWalletRoutes.ts
import {Router, Request, Response} from 'express';
import knex from '../../db/knex';

const profileWalletRouter = Router();

/**
 * POST /api/profile/wallets
 * Body: { userId, walletAddress }
 * 
 * Adds a new walletAddress to the user_wallets table for userId (which is the "primary" user address).
 */
profileWalletRouter.post('/', async (req: any, res: any) => {
  try {
    const {userId, walletAddress} = req.body;
    if (!userId || !walletAddress) {
      return res.status(400).json({success: false, error: 'Missing userId or walletAddress'});
    }

    // Check if user exists
    const user = await knex('users').where({id: userId}).first();
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    // Insert into user_wallets
    await knex('user_wallets').insert({
      user_id: userId,
      wallet_address: walletAddress,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.json({success: true, userId, walletAddress});
  } catch (error: any) {
    console.error('[Add Wallet] error:', error);
    if (error?.code === 'ER_DUP_ENTRY' || error?.constraint === 'user_wallets_user_id_wallet_address_unique') {
      return res.status(400).json({
        success: false,
        error: 'Wallet already added for this user',
      });
    }
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * DELETE /api/profile/wallets
 * Body: { userId, walletAddress }
 * 
 * Removes a wallet from user_wallets for the specified userId.
 */
profileWalletRouter.delete('/', async (req: any, res: any) => {
  try {
    const {userId, walletAddress} = req.body;
    if (!userId || !walletAddress) {
      return res.status(400).json({success: false, error: 'Missing userId or walletAddress'});
    }

    // Ensure user exists
    const user = await knex('users').where({id: userId}).first();
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    await knex('user_wallets')
      .where({user_id: userId, wallet_address: walletAddress})
      .del();

    return res.json({success: true, userId, walletAddress});
  } catch (error: any) {
    console.error('[Remove Wallet] error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * GET /api/profile/wallets?userId=xxx
 * Returns all the extra wallets the user has (not including the primary address from users.id)
 */
profileWalletRouter.get('/', async (req: any, res: any) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({success: false, error: 'Missing userId query param'});
    }

    // Check user
    const user = await knex('users').where({id: userId}).first();
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    const rows = await knex('user_wallets').where({user_id: userId}).select('wallet_address');
    const addresses = rows.map(r => r.wallet_address);

    return res.json({success: true, userId, walletAddresses: addresses});
  } catch (error: any) {
    console.error('[Get Wallets] error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

export default profileWalletRouter;
