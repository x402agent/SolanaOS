# Chat Module

The Chat Module provides messaging and communication capabilities for applications. It includes components for rendering chat interfaces, services for managing message data, and utilities for formatting and processing chat-related content.

## Structure

- **components**: UI components for chat functionality

  - **agentic-chat**: AI-assisted chat components
    - `AgenticChatContainer`: Container component for AI chat experience
    - `AgenticChatMessage`: Specialized message component for AI interactions
  
  - **chat-composer**: Message input and composition components
    - `ChatComposer`: Rich text input component for composing messages
  
  - **message**: Message display and rendering components
    - `MessageBubble`: Primary component for displaying chat messages
    - `ChatMessage`: Component for rendering different message types
    - `MessageHeader`: Header component for message bubbles
    - `MessageNFT`: Component for displaying NFT-related messages
    - `MessageTradeCard`: Component for displaying trade-related messages
  
  - `ChatListItemSkeleton`: Loading placeholder for chat list items

- **services**: Backend services for chat functionality
  - `chatImageService`: Service for uploading chat images to IPFS

- **utils**: Helper functions for chat-related operations
  - `mergeStyles`: Utility for merging style objects with different priorities

## Usage

Import components and utilities from the chat module:

```typescript
import { MessageBubble, ChatComposer, AgenticChatContainer } from '@core/chat';
import { uploadChatImage } from '@core/chat';
import { mergeStyles } from '@core/chat';
```

## Integration with other modules

The Chat module integrates with the Profile module for user information and with authentication services for secure messaging.
