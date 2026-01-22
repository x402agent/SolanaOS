import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { BroadcastNotificationRequest, BroadcastResult } from '../types/notification.types';

class ExpoNotificationService {
  private expo: Expo;

  constructor() {
    // Create a new Expo SDK client
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true, // Use FCM v1 (recommended)
    });
  }

  /**
   * Validate if a token is a valid Expo push token
   */
  isValidExpoPushToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  /**
   * Send notifications to multiple push tokens
   */
  async sendNotifications(
    pushTokens: string[],
    notification: BroadcastNotificationRequest
  ): Promise<BroadcastResult> {
    const result: BroadcastResult = {
      totalTokens: pushTokens.length,
      successfulSends: 0,
      failedSends: 0,
      tickets: [],
      errors: []
    };

    if (pushTokens.length === 0) {
      result.errors.push('No push tokens provided');
      return result;
    }

    // Filter out invalid tokens
    const validTokens = pushTokens.filter(token => {
      const isValid = this.isValidExpoPushToken(token);
      if (!isValid) {
        result.errors.push(`Invalid push token: ${token}`);
        result.failedSends++;
      }
      return isValid;
    });

    if (validTokens.length === 0) {
      result.errors.push('No valid push tokens found');
      return result;
    }

    // Create messages
    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      sound: notification.sound || 'default',
      badge: notification.badge,
      priority: notification.priority || 'default',
    }));

    try {
      // Chunk messages for batch sending (Expo recommends chunks of 100)
      const chunks = this.expo.chunkPushNotifications(messages);
      
      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          result.tickets.push(...ticketChunk);
          
          // Count successful and failed sends
          ticketChunk.forEach((ticket: ExpoPushTicket) => {
            if (ticket.status === 'ok') {
              result.successfulSends++;
            } else {
              result.failedSends++;
              if ('message' in ticket) {
                result.errors.push(ticket.message);
              }
            }
          });
        } catch (chunkError: any) {
          console.error('Error sending notification chunk:', chunkError);
          result.errors.push(`Chunk error: ${chunkError.message}`);
          result.failedSends += chunk.length;
        }
      }
    } catch (error: any) {
      console.error('Error sending notifications:', error);
      result.errors.push(`Send error: ${error.message}`);
      result.failedSends = validTokens.length;
    }

    return result;
  }

  /**
   * Send a single notification to one token
   */
  async sendSingleNotification(
    pushToken: string,
    notification: BroadcastNotificationRequest
  ): Promise<BroadcastResult> {
    return this.sendNotifications([pushToken], notification);
  }

  /**
   * Get push notification receipts
   */
  async getPushNotificationReceipts(receiptIds: string[]): Promise<{ [id: string]: ExpoPushReceipt }> {
    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      const receipts: { [id: string]: ExpoPushReceipt } = {};

      for (const chunk of receiptIdChunks) {
        const chunkReceipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
        Object.assign(receipts, chunkReceipts);
      }

      return receipts;
    } catch (error: any) {
      console.error('Error getting push notification receipts:', error);
      throw error;
    }
  }
}

export const expoNotificationService = new ExpoNotificationService();
export default expoNotificationService; 