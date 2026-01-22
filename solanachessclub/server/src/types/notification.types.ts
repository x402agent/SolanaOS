export interface PushToken {
  id?: number;
  user_id: string;
  expo_push_token: string;
  device_id?: string;
  platform: 'ios' | 'android';
  app_version?: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
  last_used_at?: Date;
}

export interface RegisterTokenRequest {
  userId: string;
  expoPushToken: string;
  deviceId?: string;
  platform: 'ios' | 'android';
  appVersion?: string;
}

export interface BroadcastNotificationRequest {
  title: string;
  body: string;
  data?: Record<string, any>;
  targetType?: 'all' | 'ios' | 'android';
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

export interface BroadcastResult {
  totalTokens: number;
  successfulSends: number;
  failedSends: number;
  tickets: any[];
  errors: string[];
} 