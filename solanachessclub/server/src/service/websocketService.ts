/**
 * File: server/src/services/websocketService.ts
 * 
 * WebSocket service for real-time chat:
 * - Connect/disconnect handling
 * - Join/leave chat rooms
 * - Send/receive messages
 * - Typing indicators
 */
import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

// Interface for chat message
interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  image_url?: string;
  additionalData?: any;
  timestamp: Date;
  sender?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
}

// Main WebSocket service class                       
export class WebSocketService {
  // Change io to public for access from main server file
  public io: SocketServer;
  private userSocketMap: Map<string, string[]> = new Map(); // userId -> socketIds[]
  private socketUserMap: Map<string, string> = new Map(); // socketId -> userId

  constructor(server: HttpServer) {
    // Configure Socket.IO with better options for production on App Engine Flex
    this.io = new SocketServer(server, {
      path: '/socket.io',
      cors: {
        origin: '*', // Restrict in production
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
      },
      // App Engine Flex environment settings
      transports: ['websocket', 'polling'],
      // Keep connection alive through App Engine proxy
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6, // 1MB
      allowUpgrades: true,
      perMessageDeflate: {
        threshold: 1024 // Only compress messages larger than 1KB
      },
      httpCompression: {
        threshold: 1024
      },
      connectTimeout: 45000
    });

    this.initializeEventHandlers();
    console.log('WebSocket service initialized with WebSocket and polling support');
    
    // Log transport-related details on startup
    setInterval(() => {
      const activeSockets = this.io.sockets.sockets.size;
      console.log(`Active connections: ${activeSockets}`);
      
      // Log transport distribution
      const transports: Record<string, number> = { 'websocket': 0, 'polling': 0 };
      this.io.sockets.sockets.forEach(socket => {
        const transport = socket.conn?.transport?.name;
        if (transport) {
          transports[transport] = (transports[transport] || 0) + 1;
        }
      });
      
      console.log('Transport distribution:', transports);
    }, 60000); // Log every minute
  }

  /**
   * Initialize Socket.IO event handlers
   */
  private initializeEventHandlers(): void {
    // Add additional engine-level error logging
    this.io.engine.on('initial_headers', (headers: any, req: any) => {
      // Extract client IP and forwarded info for debugging
      const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const forwardedProto = req.headers['x-forwarded-proto'];
      console.log(`Socket.IO initial headers for connection attempt from ${clientIp} (proto: ${forwardedProto})`);
    });

    this.io.on('connection', (socket: Socket) => {
      const transport = socket.conn.transport.name; // 'websocket' or 'polling'
      console.log(`New socket connection: ${socket.id} using transport: ${transport}`);
      
      // Keep track of the client's IP for debugging App Engine proxy issues
      const clientInfo = {
        transport,
        ip: socket.handshake.headers['x-forwarded-for'] || socket.handshake.address,
        secure: socket.handshake.secure,
        forwardedProto: socket.handshake.headers['x-forwarded-proto'] || 'unknown',
        userAgent: socket.handshake.headers['user-agent'] || 'unknown'
      };
      console.log(`Client info for ${socket.id}:`, clientInfo);

      // Authenticate user on connect
      socket.on('authenticate', (data: { userId: string }) => {
        this.handleAuthentication(socket, data.userId);
      });

      // Join a chat room
      socket.on('join_chat', (data: { chatId: string }) => {
        this.joinChat(socket, data.chatId);
      });

      // Leave a chat room
      socket.on('leave_chat', (data: { chatId: string }) => {
        this.leaveChat(socket, data.chatId);
      });

      // Handle chat message
      socket.on('send_message', (data: ChatMessage) => {
        this.handleChatMessage(socket, data);
      });

      // Handle typing indicator
      socket.on('typing', (data: { chatId: string, isTyping: boolean }) => {
        this.handleTypingIndicator(socket, data);
      });

      // Handle user status
      socket.on('user_status', (data: { userId: string, isOnline: boolean }) => {
        this.handleUserStatus(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`Socket ${socket.id} disconnected due to: ${reason}`);
        this.handleDisconnect(socket);
      });

      // Handle errors at socket level
      socket.on('error', (error) => {
        console.error(`Socket ${socket.id} error:`, error);
      });
      
      // Handle transport upgrade
      socket.conn.on('upgrade', (transport) => {
        console.log(`Socket ${socket.id} upgraded transport to: ${transport.name}`);
      });
    });

    // Add server-wide connection error handler
    this.io.engine.on('connection_error', (err: any) => {
      console.error('Socket.IO engine connection error:', err);
    });
  }

  /**
   * Handle user authentication
   */
  private handleAuthentication(socket: Socket, userId: string): void {
    console.log(`Authenticating user: ${userId} for socket: ${socket.id}`);
    
    // Store mapping of socket to user
    this.socketUserMap.set(socket.id, userId);
    
    // Store mapping of user to sockets (a user can have multiple active connections)
    const userSockets = this.userSocketMap.get(userId) || [];
    userSockets.push(socket.id);
    this.userSocketMap.set(userId, userSockets);
    
    // Acknowledge successful authentication
    socket.emit('authenticated', { success: true });
    
    console.log(`User ${userId} authenticated with socket ${socket.id}`);
  }

  /**
   * Handle joining a chat room
   */
  private joinChat(socket: Socket, chatId: string): void {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    // Join the socket.io room for this chat
    socket.join(`chat:${chatId}`);
    console.log(`User ${userId} joined chat room: ${chatId}`);
    
    // Notify other participants that this user joined
    socket.to(`chat:${chatId}`).emit('user_joined', {
      chatId,
      userId,
    });
  }

  /**
   * Handle leaving a chat room
   */
  private leaveChat(socket: Socket, chatId: string): void {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) return;
    
    // Leave the socket.io room
    socket.leave(`chat:${chatId}`);
    console.log(`User ${userId} left chat room: ${chatId}`);
    
    // Notify other participants
    socket.to(`chat:${chatId}`).emit('user_left', {
      chatId,
      userId,
    });
  }

  /**
   * Handle chat message
   */
  private handleChatMessage(socket: Socket, message: ChatMessage): void {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    if (userId !== message.senderId) {
      socket.emit('error', { message: 'Sender ID mismatch' });
      return;
    }
    
    // Broadcast message to all users in the chat room
    this.io.to(`chat:${message.chatId}`).emit('new_message', message);
    
    console.log(`Message sent in chat ${message.chatId} by user ${userId}`);
  }

  /**
   * Handle typing indicator
   */
  private handleTypingIndicator(socket: Socket, data: { chatId: string, isTyping: boolean }): void {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) return;
    
    // Broadcast typing status to other users in the chat
    socket.to(`chat:${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId,
      isTyping: data.isTyping,
    });
  }

  /**
   * Handle user online status
   */
  private handleUserStatus(socket: Socket, data: { userId: string, isOnline: boolean }): void {
    const userId = this.socketUserMap.get(socket.id);
    
    // Verify the user is authenticated and the userId matches
    if (!userId || userId !== data.userId) {
      socket.emit('error', { message: 'User ID mismatch or not authenticated' });
      return;
    }
    
    console.log(`User ${userId} status changed to ${data.isOnline ? 'online' : 'offline'}`);
    
    // Broadcast to all connected clients that this user's status changed
    // This is a global broadcast to all sockets
    this.io.emit('user_status_change', {
      userId: data.userId,
      isOnline: data.isOnline
    });
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) return;

    // Remove this socket from user's socket list
    const userSockets = this.userSocketMap.get(userId) || [];
    const updatedSockets = userSockets.filter(id => id !== socket.id);
    
    // Remove userId -> socketId mapping if no sockets left
    if (updatedSockets.length === 0) {
      this.userSocketMap.delete(userId);
      
      // Broadcast that user is offline
      this.io.emit('user_status_change', {
        userId,
        isOnline: false
      });
      
      console.log(`User ${userId} is now fully offline (no active sockets)`);
    } else {
      // User still has active sockets
      this.userSocketMap.set(userId, updatedSockets);
      console.log(`User ${userId} still has ${updatedSockets.length} active sockets`);
    }
    
    // Remove socketId -> userId mapping
    this.socketUserMap.delete(socket.id);
  }

  /**
   * Public method to broadcast a message to a specific chat room
   * Used by external services to send system messages or notifications
   */
  public broadcastToChatRoom(chatId: string, event: string, data: any): void {
    this.io.to(`chat:${chatId}`).emit(event, data);
  }

  /**
   * Public method to send a direct message to a specific user
   * Used by external services to send notifications
   */
  public sendToUser(userId: string, event: string, data: any): void {
    const userSockets = this.userSocketMap.get(userId) || [];
    
    userSockets.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }
} 