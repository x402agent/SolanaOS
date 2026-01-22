/**
 * Service for managing WebSocket connections for real-time chat
 */
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '@env';
import { store } from '@/shared/state/store';
import { receiveMessage, incrementUnreadCount } from '@/shared/state/chat/slice';

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private activeRooms: Set<string> = new Set();
  private _isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isPersistent: boolean = true; // Keep connection persistent by default

  // Initialize the socket connection
  public initSocket(userId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this._isConnected && this.userId === userId) {
        console.log('Socket already connected for user', userId);
        resolve(true);
        return;
      }

      if (this.socket) {
        this.socket.disconnect();
      }

      this.userId = userId;
      this.reconnectAttempts = 0;

      console.log('Initializing socket connection to:', SERVER_URL);
      
      // Determine if we should force secure WebSockets based on server URL
      const forceSecure = SERVER_URL.startsWith('https://');

      // Calculate connection timeout based on attempt number
      const connectionTimeout = 5000 + (this.reconnectAttempts * 2000);
      
      this.socket = io(SERVER_URL, {
        transports: ['websocket' , 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        // App Engine Standard specific settings
        timeout: connectionTimeout,
        // Don't force SSL - App Engine handles this
        secure: forceSecure,
        forceNew: true,
        path: '/socket.io/',
        // Remove extraHeaders for Standard
      });

      this.setupEventListeners();

      // Authenticate after connecting
      this.socket.on('connect', () => {
        console.log('Socket connected, authenticating...');
        console.log('Active transport:', this.socket?.io.engine.transport.name);
        this.authenticate(userId);
        this._isConnected = true;
        
        // Rejoin all active rooms after reconnection
        if (this.activeRooms.size > 0) {
          console.log('Rejoining active rooms after reconnection');
          this.activeRooms.forEach(roomId => {
            this.joinChat(roomId);
          });
        }
        
        resolve(true);
      });

      // Log transport changes - using any for engine to avoid TypeScript errors
      if (this.socket && this.socket.io && (this.socket.io.engine as any)) {
        (this.socket.io.engine as any).on('transportChange', (transport: any) => {
          console.log('Transport changed from', transport.name, 'to', (this.socket?.io.engine as any).transport.name);
        });
      }

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        console.error('Connection details:', {
          url: SERVER_URL,
          userId: this.userId,
          attempt: this.reconnectAttempts + 1,
          error: error.message,
          transport: this.socket?.io?.engine?.transport?.name || 'unknown'
        });
        
        this._isConnected = false;
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnect attempts reached, falling back to HTTP polling only');
          
          // Last attempt with polling only before giving up
          if (this.socket) {
            this.socket.io.opts.transports = ['polling'];
            this.socket.connect();
            
            // Set a timeout for this final attempt
            setTimeout(() => {
              if (!this._isConnected) {
                console.error('Failed to connect even with polling transport');
                resolve(false);
              }
            }, 5000);
          } else {
            resolve(false);
          }
        }
      });
      
      // Add additional error event handler
      this.socket.on('error', (error) => {
        console.error('Socket general error:', error);
      });
      
      // Add connect timeout handler
      this.socket.on('connect_timeout', (timeout) => {
        console.error('Socket connection timeout after', timeout, 'ms');
      });

      // Set a timeout for initial connection
      setTimeout(() => {
        if (!this._isConnected) {
          console.error('Initial connection timeout, resolving as false');
          resolve(false);
        }
      }, 10000); // 10 second timeout for initial connection
    });
  }

  // Set up socket event listeners
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Authentication response
    this.socket.on('authenticated', (data: { success: boolean }) => {
      console.log('Authentication result:', data);
    });

    // New message received
    this.socket.on('new_message', (message: any) => {
      console.log('New message received via WebSocket:', message);
      
      // Ensure message has all required fields before dispatching
      if (message && message.id && message.chat_room_id) {
        // Get currently selected chat from Redux store
        const state = store.getState();
        const selectedChatId = state.chat.selectedChatId;
        
        // Don't dispatch messages sent by the current user (already in state from API response)
        if (message.sender_id === this.userId) {
          console.log('Ignoring own message broadcast from server');
          return;
        }
        
        // Dispatch to add message to chat's message list
        store.dispatch(receiveMessage(message));
        
        // Increment unread count if the message is not for the currently viewed chat
        if (selectedChatId !== message.chat_room_id) {
          console.log('[socketService] Incrementing unread count for chat:', message.chat_room_id);
          store.dispatch(incrementUnreadCount({
            chatId: message.chat_room_id,
            senderId: message.sender_id
          }));
        }
      } else {
        console.error('Received malformed message from socket:', message);
      }
    });

    // Additional listener for message_broadcast event (server might use a different event name)
    this.socket.on('message_broadcast', (message: any) => {
      console.log('Message broadcast received:', message);
      if (message && message.id) {
        // Get currently selected chat from Redux store
        const state = store.getState();
        const selectedChatId = state.chat.selectedChatId;
        
        // Don't dispatch messages sent by the current user (already in state from API response)
        if (message.sender_id === this.userId || message.senderId === this.userId) {
          console.log('Ignoring own message broadcast');
          return;
        }
        
        // Dispatch to add message to chat's message list
        store.dispatch(receiveMessage(message));
        
        // Increment unread count if the message is not for the currently viewed chat
        if (selectedChatId !== message.chat_room_id) {
          console.log('[socketService] Incrementing unread count for chat:', message.chat_room_id);
          store.dispatch(incrementUnreadCount({
            chatId: message.chat_room_id,
            senderId: message.sender_id || message.senderId
          }));
        }
      }
    });

    // User typing indicator
    this.socket.on('user_typing', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      console.log('User typing:', data);
      // Implement typing indicator in UI if needed
    });

    // Handle disconnection
    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      this._isConnected = false;
      
      // Don't clear active rooms on disconnect - we want to rejoin them on reconnect
      
      // Attempt to reconnect if not intentionally closed
      if (reason !== 'io client disconnect' && this.isPersistent) {
        console.log('Attempting to reconnect...');
        if (this.userId) {
          setTimeout(() => {
            this.initSocket(this.userId!);
          }, 2000);
        }
      }
    });
    
    // Listen for any socket events to help debug (development only)
    if (process.env.NODE_ENV !== 'production') {
      this.socket.onAny((event, ...args) => {
        console.log(`Socket event received: ${event}`, args);
      });
    }
  }

  // Authenticate with the socket server
  private authenticate(userId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot authenticate: socket not connected');
      return;
    }

    this.socket.emit('authenticate', { userId });
  }

  // Join a chat room
  public joinChat(chatId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot join chat: socket not connected');
      return;
    }

    if (this.activeRooms.has(chatId)) {
      console.log('Already in room:', chatId);
      return;
    }

    console.log('Joining chat room:', chatId);
    this.socket.emit('join_chat', { chatId });
    this.activeRooms.add(chatId);
  }

  // Join multiple chat rooms at once
  public joinChats(chatIds: string[]): void {
    if (!chatIds || chatIds.length === 0) {
      return;
    }
    
    console.log('Joining multiple chat rooms:', chatIds);
    chatIds.forEach(chatId => {
      if (chatId && !this.activeRooms.has(chatId)) {
        this.joinChat(chatId);
      }
    });
  }

  // Leave a chat room
  public leaveChat(chatId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot leave chat: socket not connected');
      return;
    }

    if (!this.activeRooms.has(chatId)) {
      console.log('Not in room:', chatId);
      return;
    }

    console.log('Leaving chat room:', chatId);
    this.socket.emit('leave_chat', { chatId });
    this.activeRooms.delete(chatId);
  }

  // Update persistent mode
  public setPersistentMode(isPersistent: boolean): void {
    this.isPersistent = isPersistent;
  }

  // Send a message to a chat room
  public sendMessage(chatId: string, message: any): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot send message: socket not connected');
      return;
    }

    if (!this.activeRooms.has(chatId)) {
      console.log('Not in room:', chatId, 'joining now...');
      this.joinChat(chatId);
    }

    this.socket.emit('send_message', { ...message, chatId });
  }

  // Send typing indicator
  public sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('typing', { chatId, isTyping });
  }

  // Disconnect socket
  public disconnect(): void {
    // Only actually disconnect if we're not in persistent mode
    if (!this.isPersistent) {
      if (this.socket) {
        this.socket.disconnect();
        this.activeRooms.clear();
        this._isConnected = false;
      }
    } else {
      console.log('Disconnection requested but persistent mode is enabled, keeping connection active');
    }
  }

  // Update the isConnected method to be public
  public isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }

  // Add an emit method to send events
  public emit(event: string, data: any): void {
    if (this.isConnected()) {
      this.socket!.emit(event, data);
    } else {
      console.warn(`Cannot emit "${event}" - socket not connected`);
    }
  }

  // Add subscribeToEvent and unsubscribeFromEvent methods
  public subscribeToEvent(event: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn(`Cannot subscribe to "${event}" - socket not initialized`);
      return;
    }
    
    this.socket.on(event, callback);
    console.log(`Subscribed to ${event} events`);
  }

  public unsubscribeFromEvent(event: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn(`Cannot unsubscribe from "${event}" - socket not initialized`);
      return;
    }
    
    this.socket.off(event, callback);
    console.log(`Unsubscribed from ${event} events`);
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService; 