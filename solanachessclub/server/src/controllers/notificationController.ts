import { Request, Response } from 'express';
import knex from '../db/knex';
import { 
  PushToken, 
  RegisterTokenRequest, 
  BroadcastNotificationRequest, 
  NotificationResponse 
} from '../types/notification.types';
import expoNotificationService from '../services/expoNotificationService';

export class NotificationController {
  /**
   * Register or update a push token for a user
   */
  async registerPushToken(req: Request, res: Response): Promise<void> {
    try {
      const { userId, expoPushToken, deviceId, platform, appVersion }: RegisterTokenRequest = req.body;

      // Validate required fields
      if (!userId || !expoPushToken || !platform) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, expoPushToken, platform'
        } as NotificationResponse);
        return;
      }

      // Validate platform
      if (!['ios', 'android'].includes(platform)) {
        res.status(400).json({
          success: false,
          message: 'Platform must be either "ios" or "android"'
        } as NotificationResponse);
        return;
      }

      // Validate Expo push token format
      if (!expoNotificationService.isValidExpoPushToken(expoPushToken)) {
        res.status(400).json({
          success: false,
          message: 'Invalid Expo push token format'
        } as NotificationResponse);
        return;
      }

      // Check if token already exists for this user
      const existingToken = await knex('push_tokens')
        .where({ user_id: userId, expo_push_token: expoPushToken })
        .first();

      if (existingToken) {
        // Update existing token
        await knex('push_tokens')
          .where({ id: existingToken.id })
          .update({
            device_id: deviceId,
            platform,
            app_version: appVersion,
            is_active: true,
            last_used_at: knex.fn.now(),
            updated_at: knex.fn.now()
          });

        res.status(200).json({
          success: true,
          message: 'Push token updated successfully',
          data: { tokenId: existingToken.id }
        } as NotificationResponse);
        return;
      }

      // Create new token record
      const [newToken] = await knex('push_tokens')
        .insert({
          user_id: userId,
          expo_push_token: expoPushToken,
          device_id: deviceId,
          platform,
          app_version: appVersion,
          is_active: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
          last_used_at: knex.fn.now()
        })
        .returning('id');

      res.status(201).json({
        success: true,
        message: 'Push token registered successfully',
        data: { tokenId: newToken.id }
      } as NotificationResponse);

    } catch (error: any) {
      console.error('Error registering push token:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        errors: [error.message]
      } as NotificationResponse);
    }
  }

  /**
   * Broadcast notification to all users or filtered by platform
   */
  async broadcastNotification(req: Request, res: Response): Promise<void> {
    try {
      const { 
        title, 
        body, 
        data, 
        targetType = 'all',
        sound = 'default',
        badge,
        priority = 'default'
      }: BroadcastNotificationRequest = req.body;

      // Validate required fields
      if (!title || !body) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: title, body'
        } as NotificationResponse);
        return;
      }

      // Validate targetType
      if (!['all', 'ios', 'android'].includes(targetType)) {
        res.status(400).json({
          success: false,
          message: 'targetType must be "all", "ios", or "android"'
        } as NotificationResponse);
        return;
      }

      // Build query to get active push tokens
      let query = knex('push_tokens').where('is_active', true);
      
      if (targetType !== 'all') {
        query = query.where('platform', targetType);
      }

      const pushTokenRecords = await query.select('expo_push_token');
      const pushTokens = pushTokenRecords.map(record => record.expo_push_token);

      if (pushTokens.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No active push tokens found for the specified target',
          data: {
            totalTokens: 0,
            successfulSends: 0,
            failedSends: 0
          }
        } as NotificationResponse);
        return;
      }

      // Send notifications
      const result = await expoNotificationService.sendNotifications(pushTokens, {
        title,
        body,
        data,
        targetType,
        sound,
        badge,
        priority
      });

      res.status(200).json({
        success: true,
        message: `Broadcast sent to ${result.totalTokens} tokens`,
        data: {
          totalTokens: result.totalTokens,
          successfulSends: result.successfulSends,
          failedSends: result.failedSends,
          errors: result.errors
        }
      } as NotificationResponse);

    } catch (error: any) {
      console.error('Error broadcasting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        errors: [error.message]
      } as NotificationResponse);
    }
  }

  /**
   * Get push token statistics
   */
  async getTokenStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await knex('push_tokens')
        .select('platform')
        .count('* as count')
        .where('is_active', true)
        .groupBy('platform');

      const totalActive = await knex('push_tokens')
        .count('* as count')
        .where('is_active', true)
        .first();

      const totalInactive = await knex('push_tokens')
        .count('* as count')
        .where('is_active', false)
        .first();

      res.status(200).json({
        success: true,
        message: 'Token statistics retrieved successfully',
        data: {
          totalActive: parseInt(totalActive?.count as string) || 0,
          totalInactive: parseInt(totalInactive?.count as string) || 0,
          byPlatform: stats.reduce((acc, stat) => {
            acc[stat.platform] = parseInt(stat.count as string);
            return acc;
          }, {} as Record<string, number>)
        }
      } as NotificationResponse);

    } catch (error: any) {
      console.error('Error getting token stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        errors: [error.message]
      } as NotificationResponse);
    }
  }

  /**
   * Remove/deactivate a push token
   */
  async removePushToken(req: Request, res: Response): Promise<void> {
    try {
      const { userId, expoPushToken } = req.body;

      if (!userId || !expoPushToken) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, expoPushToken'
        } as NotificationResponse);
        return;
      }

      const updated = await knex('push_tokens')
        .where({ user_id: userId, expo_push_token: expoPushToken })
        .update({ 
          is_active: false,
          updated_at: knex.fn.now()
        });

      if (updated === 0) {
        res.status(404).json({
          success: false,
          message: 'Push token not found'
        } as NotificationResponse);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Push token removed successfully'
      } as NotificationResponse);

    } catch (error: any) {
      console.error('Error removing push token:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        errors: [error.message]
      } as NotificationResponse);
    }
  }
}

export const notificationController = new NotificationController(); 