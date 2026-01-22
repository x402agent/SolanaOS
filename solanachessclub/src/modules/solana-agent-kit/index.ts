export { useChat, getTrailingMessageId, generateTitleFromUserMessage, safeDeepClone } from './hooks/useChat';

export { myProvider } from './lib/ai/providers';

export {
  cn,
  generateUUID,
  convertToUIMessages,
  getAuthHeaders,
  fetchChat,
  fetchMessages,
  fetchChats,
  saveChat,
  standardizeMessageFormat,
  saveMessages,
  deleteChat,
  bulkDeleteChats,
  deleteAllChats,
  createOrUpdateUser,
} from './lib/utils'; 