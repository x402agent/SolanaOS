import { SERVER_URL } from "@env";
import type { Attachment, UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function convertToUIMessages(
  messages: Array<any>,
): Array<UIMessage> {
  return messages.map((message) => ({
    id: message.id,
    parts: message.parts as UIMessage["parts"],
    role: message.role as UIMessage["role"],
    // Note: content will soon be deprecated in @ai-sdk/react
    content: "",
    createdAt: message.createdAt,
    experimental_attachments: (message.attachments as Array<Attachment>) ?? [],
  }));
}

// Helper to get API headers with wallet address for authentication
export function getAuthHeaders(walletAddress?: string | null): HeadersInit {
  const headers: HeadersInit = { 
    'Content-Type': 'application/json' 
  };
  
  // Add wallet address header if available
  if (walletAddress) {
    headers['x-wallet-address'] = walletAddress;
  }
  
  return headers;
}

// API functions for fetching from server
export async function fetchChat(chatId: string, walletAddress?: string | null): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
      headers: getAuthHeaders(walletAddress)
    });
    
    if (!response.ok) {
      // For 404s, just log at debug level - these are expected for new chats
      if (response.status === 404) {
        console.log(`Chat not found: ${chatId} - this is normal for new chats`);
        return null;
      }
      
      // For other errors, log as error
      console.error('Failed to fetch chat:', response.status, response.statusText);
      throw new Error(`Failed to fetch chat: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    // Don't log 404-related errors as they're expected for new chats
    if (error instanceof Error && !error.message.includes('404')) {
      console.error('Error fetching chat:', error);
    }
    return null;
  }
}

export async function fetchMessages(chatId: string, walletAddress?: string | null): Promise<any[]> {
  try {
    const response = await fetch(`${SERVER_URL}/api/messages/${chatId}`, {
      headers: getAuthHeaders(walletAddress)
    });
    
    if (!response.ok) {
      console.error('Failed to fetch messages:', response.status, response.statusText);
      throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

export async function fetchChats(
  limit: number = 10, 
  startingAfter: string | null = null, 
  endingBefore: string | null = null,
  walletAddress?: string | null
): Promise<any[]> {
  try {
    let url = `${SERVER_URL}/api/chats?limit=${limit}`;
    
    if (startingAfter) {
      url += `&startingAfter=${startingAfter}`;
    } else if (endingBefore) {
      url += `&endingBefore=${endingBefore}`;
    }
    
    const response = await fetch(url, {
      headers: getAuthHeaders(walletAddress)
    });
    
    if (!response.ok) {
      console.error('Failed to fetch chats:', response.status, response.statusText);
      throw new Error(`Failed to fetch chats: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('Error fetching chats:', error);
    return [];
  }
}

export async function saveChat(chat: { id: string; title: string; }, walletAddress?: string | null): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: getAuthHeaders(walletAddress),
      body: JSON.stringify(chat),
    });
    
    if (!response.ok) {
      console.error('Failed to save chat:', response.status, response.statusText);
      throw new Error(`Failed to save chat: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error saving chat:', error);
    return null;
  }
}

// Standardize message format to ensure consistency between client and server
export function standardizeMessageFormat(message: any): any {
  // Get content from message - handle different formats
  const messageContent = typeof message.content === 'string' 
    ? message.content 
    : message.content instanceof Object
      ? JSON.stringify(message.content)
      : '';
  
  // Fallback content if everything is empty
  const fallbackText = 'Message content unavailable';
      
  // Process parts to ensure they have valid text property
  const processedParts = Array.isArray(message.parts) 
    ? message.parts.map((part: any) => {
        const partText = part.text || messageContent;
        return {
          type: part.type || 'text',
          text: partText.trim() !== '' ? partText : fallbackText
        };
      }) 
    : [{ 
        type: 'text', 
        text: messageContent.trim() !== '' ? messageContent : fallbackText
      }];
      
  // Ensure message has the exact format expected by the server
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    parts: processedParts,
    // Ensure attachments are properly formatted
    attachments: Array.isArray(message.attachments) ? 
      message.attachments : []
  };
}

export async function saveMessages(messages: any[], walletAddress?: string | null): Promise<string> {
  try {
    // Create properly formatted messages that will pass server validation
    const validMessages = messages.map(standardizeMessageFormat);

    // Log the exact payload for debugging (remove in production)
    console.log('Sending message payload:', JSON.stringify(validMessages));
    
    const response = await fetch(`${SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: getAuthHeaders(walletAddress),
      body: JSON.stringify({ messages: validMessages }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to save messages:', response.status, errorText);
      throw new Error(`Failed to save messages: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success ? "success" : "failed";
  } catch (error) {
    console.error('Error saving messages:', error);
    return "failed";
  }
}

export async function deleteChat(chatId: string, walletAddress?: string | null): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(walletAddress)
    });
    
    if (!response.ok) {
      console.error('Failed to delete chat:', response.status, response.statusText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

export async function bulkDeleteChats(chatIds: string[], walletAddress?: string | null): Promise<{
  success: boolean;
  deletedChats?: string[];
}> {
  try {
    const response = await fetch(`${SERVER_URL}/api/chats/bulk`, {
      method: 'DELETE',
      headers: getAuthHeaders(walletAddress),
      body: JSON.stringify({ chatIds }),
    });
    
    if (!response.ok) {
      console.error('Failed to bulk delete chats:', response.status, response.statusText);
      return { success: false };
    }
    
    const data = await response.json();
    return { 
      success: true, 
      deletedChats: data.deletedChats || [] 
    };
  } catch (error) {
    console.error('Error bulk deleting chats:', error);
    return { success: false };
  }
}

export async function deleteAllChats(walletAddress?: string | null): Promise<{
  success: boolean;
  count?: number;
}> {
  try {
    const response = await fetch(`${SERVER_URL}/api/chats/all`, {
      method: 'DELETE',
      headers: getAuthHeaders(walletAddress)
    });
    
    if (!response.ok) {
      console.error('Failed to delete all chats:', response.status, response.statusText);
      return { success: false };
    }
    
    const data = await response.json();
    return { 
      success: true, 
      count: data.deletedCount || 0 
    };
  } catch (error) {
    console.error('Error deleting all chats:', error);
    return { success: false };
  }
}

// User management
export async function createOrUpdateUser(userData: { 
  walletAddress: string; 
  username?: string; 
  profilePicUrl?: string;
}): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      console.error('Failed to create/update user:', response.status, response.statusText);
      throw new Error(`Failed to create/update user: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.success ? data.user : null;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return null;
  }
}
