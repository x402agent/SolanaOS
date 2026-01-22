import express from 'express';
import {
  getApy,
  lend,
  getBalance,
  initiateWithdraw,
  getPendingWithdrawals,
  completeWithdraw,
} from '../../controllers/luloController';

const router = express.Router();

// GET requests
router.get('/apy', getApy);
router.get('/balance/:userPublicKey', getBalance);
router.get('/pending-withdrawals/:userPublicKey', getPendingWithdrawals);

// POST requests
router.post('/lend', lend);
router.post('/initiate-withdraw', initiateWithdraw);
router.post('/complete-withdraw', completeWithdraw);

export default router; 