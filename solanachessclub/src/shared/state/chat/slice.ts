import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { SERVER_URL } from '@env';

// Types
export interface ChatParticipant {
  id: string;
  username: string;
  profile_picture_url: string | null;
  is_admin?: boolean;
  is_active?: boolean;
}

export interface ChatMessage {
  id: string;
  chat_room_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  additional_data?: any;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  sender?: {
    id: string;
    username: string;
    profile_picture_url: string | null;
  };
}

export interface ChatRoom {
  id: string;
  type: 'direct' | 'group' | 'global';
  name: string | null;
  meta_data?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  participants: ChatParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

// State interface
interface ChatState {
  chats: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  selectedChatId: string | null;
  usersForChat: ChatParticipant[];
  loadingChats: boolean;
  loadingMessages: boolean;
  loadingUsers: boolean;
  error: string | null;
  onlineUsers: { [userId: string]: boolean };
}

// Initial state
const initialState: ChatState = {
  chats: [],
  messages: {},
  selectedChatId: null,
  usersForChat: [],
  loadingChats: false,
  loadingMessages: false,
  loadingUsers: false,
  error: null,
  onlineUsers: {},
};

// Async Thunks
export const fetchUserChats = createAsyncThunk(
  'chat/fetchUserChats',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/chat/users/${userId}/chats`);
      return response.data.chats;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch chats');
    }
  }
);

export const fetchChatMessages = createAsyncThunk(
  'chat/fetchChatMessages',
  async ({ chatId, limit = 50, before = '', resetUnread = false }: { 
    chatId: string; 
    limit?: number; 
    before?: string;
    resetUnread?: boolean;
  }, { rejectWithValue }) => {
    try {
      const url = `${SERVER_URL}/api/chat/chats/${chatId}/messages${before ? `?before=${before}&limit=${limit}` : `?limit=${limit}`}`;
      const response = await axios.get(url);
      return { chatId, messages: response.data.messages, resetUnread };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch messages');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ 
    chatId, 
    userId, 
    content, 
    imageUrl,
    additionalData 
  }: { 
    chatId: string; 
    userId: string; 
    content: string; 
    imageUrl?: string;
    additionalData?: any 
  }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${SERVER_URL}/api/chat/messages`, {
        chatId,
        userId,
        content,
        imageUrl,
        additionalData,
      });
      return response.data.message;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to send message');
    }
  }
);

export const createDirectChat = createAsyncThunk(
  'chat/createDirectChat',
  async ({ userId, otherUserId }: { userId: string; otherUserId: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${SERVER_URL}/api/chat/direct`, {
        userId,
        otherUserId,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create chat');
    }
  }
);

export const createGroupChat = createAsyncThunk(
  'chat/createGroupChat',
  async ({ name, userId, participantIds }: { name: string; userId: string; participantIds: string[] }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${SERVER_URL}/api/chat/group`, {
        name,
        userId,
        participantIds,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create group chat');
    }
  }
);

export const fetchUsersForChat = createAsyncThunk(
  'chat/fetchUsersForChat',
  async ({ query, userId }: { query?: string; userId?: string }, { rejectWithValue }) => {
    try {
      let url = `${SERVER_URL}/api/chat/users`;
      const params = [];
      
      if (query) params.push(`query=${encodeURIComponent(query)}`);
      if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const response = await axios.get(url);
      return response.data.users;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch users');
    }
  }
);

export const editMessage = createAsyncThunk(
  'chat/editMessage',
  async ({ 
    messageId, 
    userId, 
    content 
  }: { 
    messageId: string; 
    userId: string; 
    content: string; 
  }, { rejectWithValue }) => {
    console.log(`[Thunk editMessage] Editing message ${messageId} for user ${userId}`);
    try {
      const response = await axios.put(`${SERVER_URL}/api/chat/messages/${messageId}`, {
        userId,
        content,
      });
      console.log(`[Thunk editMessage] Success:`, response.data);
      return response.data.message;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to edit message';
      console.error(`[Thunk editMessage] Error:`, errorMsg, error.response?.data);
      return rejectWithValue(errorMsg);
    }
  }
);

export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async ({ 
    messageId, 
    userId 
  }: { 
    messageId: string; 
    userId: string; 
  }, { rejectWithValue }) => {
    console.log(`[Thunk deleteMessage] Deleting message ${messageId} for user ${userId}`);
    try {
      const response = await axios.delete(`${SERVER_URL}/api/chat/messages/${messageId}`, {
        data: { userId } // For DELETE requests, data needs to be passed as { data: ... }
      });
      console.log(`[Thunk deleteMessage] Success:`, response.data);
      // Make sure response.data includes chatId as added in the controller
      if (!response.data || !response.data.chatId) {
        console.error('[Thunk deleteMessage] Error: Server response missing chatId');
        return rejectWithValue('Server error: Missing chat ID in response');
      }
      return { messageId, chatId: response.data.chatId };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to delete message';
      console.error(`[Thunk deleteMessage] Error:`, errorMsg, error.response?.data);
      return rejectWithValue(errorMsg);
    }
  }
);

export const updateUserOnlineStatus = createAsyncThunk(
  'chat/updateUserOnlineStatus',
  async (payload: { userId: string; isOnline: boolean }, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update user online status');
    }
  }
);

// Create slice
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSelectedChat: (state, action) => {
      state.selectedChatId = action.payload;
      
      // Reset unread count for the selected chat
      if (action.payload) {
        const chatIndex = state.chats.findIndex(chat => chat.id === action.payload);
        if (chatIndex !== -1) {
          state.chats[chatIndex].unreadCount = 0;
        }
      }
    },
    receiveMessage: (state, action) => {
      const message = action.payload;
      if (state.messages[message.chat_room_id]) {
        state.messages[message.chat_room_id].push(message);
      } else {
        state.messages[message.chat_room_id] = [message];
      }
      
      // Update last message in chat list
      const chatIndex = state.chats.findIndex(chat => chat.id === message.chat_room_id);
      if (chatIndex !== -1) {
        state.chats[chatIndex].lastMessage = message;
      }
    },
    incrementUnreadCount: (state, action) => {
      const { chatId, senderId } = action.payload;
      const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
      
      // Only increment if we found the chat and it's not currently selected
      if (chatIndex !== -1 && state.selectedChatId !== chatId) {
        // Initialize to 0 if undefined
        if (state.chats[chatIndex].unreadCount === undefined) {
          state.chats[chatIndex].unreadCount = 0;
        }
        
        // Increment the unread count
        state.chats[chatIndex].unreadCount += 1;
        
        // Move this chat to the top of the list (most recent)
        const updatedChat = state.chats[chatIndex];
        state.chats.splice(chatIndex, 1); // Remove chat from current position
        state.chats.unshift(updatedChat); // Add to beginning of array
      }
    },
    clearChatErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch user chats
    builder
      .addCase(fetchUserChats.pending, (state) => {
        state.loadingChats = true;
        state.error = null;
      })
      .addCase(fetchUserChats.fulfilled, (state, action) => {
        state.loadingChats = false;
        state.chats = action.payload;
      })
      .addCase(fetchUserChats.rejected, (state, action) => {
        state.loadingChats = false;
        state.error = action.payload as string;
      })
      
    // Fetch chat messages
    builder
      .addCase(fetchChatMessages.pending, (state) => {
        state.loadingMessages = true;
        state.error = null;
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        state.loadingMessages = false;
        const { chatId, messages, resetUnread } = action.payload;
        state.messages[chatId] = messages;
        
        if (resetUnread) {
          const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
          if (chatIndex !== -1) {
            state.chats[chatIndex].unreadCount = 0;
          }
        }
      })
      .addCase(fetchChatMessages.rejected, (state, action) => {
        state.loadingMessages = false;
        state.error = action.payload as string;
      })
      
    // Send message
    builder
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        if (state.messages[message.chat_room_id]) {
          state.messages[message.chat_room_id].push(message);
        } else {
          state.messages[message.chat_room_id] = [message];
        }
        
        // Update last message in chat list
        const chatIndex = state.chats.findIndex(chat => chat.id === message.chat_room_id);
        if (chatIndex !== -1) {
          state.chats[chatIndex].lastMessage = message;
        }
      })
      
    // Fetch users for chat
    builder
      .addCase(fetchUsersForChat.pending, (state) => {
        state.loadingUsers = true;
      })
      .addCase(fetchUsersForChat.fulfilled, (state, action) => {
        state.loadingUsers = false;
        state.usersForChat = action.payload;
      })
      .addCase(fetchUsersForChat.rejected, (state, action) => {
        state.loadingUsers = false;
        state.error = action.payload as string;
      });
    
    // Edit message
    builder
      .addCase(editMessage.fulfilled, (state, action) => {
        const updatedMessage = action.payload;
        const chatId = updatedMessage.chat_room_id;
        
        if (state.messages[chatId]) {
          // Find and update the message
          const messageIndex = state.messages[chatId].findIndex(
            msg => msg.id === updatedMessage.id
          );
          
          if (messageIndex !== -1) {
            state.messages[chatId][messageIndex] = updatedMessage;
          }
          
          // If this was the last message, update it in the chats list too
          const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
          if (chatIndex !== -1 && 
              state.chats[chatIndex].lastMessage && 
              state.chats[chatIndex].lastMessage.id === updatedMessage.id) {
            state.chats[chatIndex].lastMessage = updatedMessage;
          }
        }
      })
      
    // Delete message
    builder
      .addCase(deleteMessage.fulfilled, (state, action) => {
        const { messageId, chatId } = action.payload;
        
        if (state.messages[chatId]) {
          // Option 1: Remove the message completely
          // state.messages[chatId] = state.messages[chatId].filter(msg => msg.id !== messageId);
          
          // Option 2: Update the message content to show it's been deleted
          const messageIndex = state.messages[chatId].findIndex(msg => msg.id === messageId);
          if (messageIndex !== -1) {
            state.messages[chatId][messageIndex] = {
              ...state.messages[chatId][messageIndex],
              content: '[This message has been deleted]',
              is_deleted: true
            };
          }
          
          // If this was the last message, update it in the chats list too
          const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
          if (chatIndex !== -1 && 
              state.chats[chatIndex].lastMessage && 
              state.chats[chatIndex].lastMessage.id === messageId) {
            if (messageIndex !== -1) {
              state.chats[chatIndex].lastMessage = state.messages[chatId][messageIndex];
            }
          }
        }
      });
    
    // Update user online status
    builder.addCase(updateUserOnlineStatus.fulfilled, (state, action) => {
      const { userId, isOnline } = action.payload;
      state.onlineUsers[userId] = isOnline;
      
      // Also update the is_active property on participants
      state.chats.forEach(chat => {
        if (chat.participants) {
          const participant = chat.participants.find(p => p.id === userId);
          if (participant) {
            participant.is_active = isOnline;
          }
        }
      });
    });
  },
});

export const { setSelectedChat, receiveMessage, incrementUnreadCount, clearChatErrors } = chatSlice.actions;
export default chatSlice.reducer; 