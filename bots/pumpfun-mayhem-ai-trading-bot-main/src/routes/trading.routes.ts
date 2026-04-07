import { Router, Request, Response } from 'express';
import { AITradingBot } from '../services/ai-trading.service';

const router = Router();
const aiBot = new AITradingBot();

router.get('/status', (req: Request, res: Response) => {
  try {
    const status = aiBot.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get bot status',
    });
  }
});

router.post('/start', async (req: Request, res: Response) => {
  try {
    await aiBot.start();
    res.json({
      success: true,
      message: 'AI trading bot started',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start AI trading bot',
    });
  }
});

router.post('/stop', (req: Request, res: Response) => {
  try {
    aiBot.stop();
    res.json({
      success: true,
      message: 'AI trading bot stopped',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to stop AI trading bot',
    });
  }
});

router.get('/predictions', (req: Request, res: Response) => {
  try {
    const predictions = aiBot.getPredictions();
    res.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get predictions',
    });
  }
});

router.get('/trades', (req: Request, res: Response) => {
  try {
    const trades = aiBot.getTradeHistory();
    res.json({
      success: true,
      data: trades,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get trade history',
    });
  }
});

export { router as tradingRoutes };

