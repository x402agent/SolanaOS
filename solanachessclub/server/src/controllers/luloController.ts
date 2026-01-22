import { Request, Response } from 'express';
import { LuloService } from '../services/luloService';

export const getApy = async (req: Request, res: Response): Promise<void> => {
  try {
    const apy = await LuloService.fetchApy();
    res.json({ success: true, apy });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const lend = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userPublicKey, amount } = req.body;
    if (!userPublicKey || !amount) {
      res.status(400).json({ success: false, error: 'userPublicKey and amount are required' });
      return;
    }
    const result = await LuloService.lend(userPublicKey, amount);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userPublicKey } = req.params;
    if (!userPublicKey) {
      res.status(400).json({ success: false, error: 'userPublicKey is required' });
      return;
    }
    const balance = await LuloService.getBalance(userPublicKey);
    res.json({ success: true, balance });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const initiateWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userPublicKey, amount } = req.body;
    if (!userPublicKey || !amount) {
      res.status(400).json({ success: false, error: 'userPublicKey and amount are required' });
      return;
    }
    const result = await LuloService.initiateWithdraw(userPublicKey, amount);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPendingWithdrawals = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userPublicKey } = req.params;
        if (!userPublicKey) {
            res.status(400).json({ success: false, error: 'userPublicKey is required' });
            return;
        }
        const withdrawals = await LuloService.fetchPendingWithdrawals(userPublicKey);
        res.json({ success: true, withdrawals });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const completeWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userPublicKey } = req.body;
    if (!userPublicKey) {
      res.status(400).json({ success: false, error: 'userPublicKey is required' });
      return;
    }
    const result = await LuloService.completeWithdraw(userPublicKey);
    if (!result) {
        res.status(404).json({ success: false, error: 'No pending withdrawals to complete.'});
        return;
    }
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 