import { Router } from 'express';
import { notificationController } from '../../controllers/notificationController';
import { adminAuthMiddleware } from '../auth/adminAuthRoutes';

const router = Router();

/**
 * @route POST /api/notifications/register-token
 * @desc Register or update a push token for a user
 * @body { userId: string, expoPushToken: string, deviceId?: string, platform: 'ios'|'android', appVersion?: string }
 */
router.post('/register-token', notificationController.registerPushToken.bind(notificationController));

/**
 * @route POST /api/notifications/broadcast
 * @desc Broadcast notification to all users or filtered by platform (ADMIN ONLY)
 * @body { title: string, body: string, data?: object, targetType?: 'all'|'ios'|'android', sound?: string, badge?: number, priority?: string }
 */
router.post('/broadcast', adminAuthMiddleware, notificationController.broadcastNotification.bind(notificationController));

/**
 * @route GET /api/notifications/stats
 * @desc Get push token statistics (ADMIN ONLY)
 */
router.get('/stats', adminAuthMiddleware, notificationController.getTokenStats.bind(notificationController));

/**
 * @route DELETE /api/notifications/remove-token
 * @desc Remove/deactivate a push token
 * @body { userId: string, expoPushToken: string }
 */
router.delete('/remove-token', notificationController.removePushToken.bind(notificationController));

export default router; 