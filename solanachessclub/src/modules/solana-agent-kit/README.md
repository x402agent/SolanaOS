# Solana Agent Kit Module

This module provides a comprehensive toolkit for integrating AI-powered chat functionalities with Solana blockchain interactions within a React Native application. It leverages the Vercel AI SDK (`ai` and `@ai-sdk/react`) and the `solana-agent-kit` library to enable AI agents to understand user queries and execute Solana-related actions.

## Core Functionalities

-   **AI Chat Interface**: Provides a `useChat` hook to manage chat state, send messages to an AI model, and stream responses.
-   **Solana Integration**: Seamlessly integrates with `solana-agent-kit` to equip the AI with tools (actions) for interacting with the Solana blockchain. This includes:
    -   Signing transactions (`signTransaction`)
    -   Signing messages (`signMessage`)
    -   Sending transactions (`sendTransaction`)
    -   Signing and sending transactions in one step (`signAndSendTransaction`)
    -   Signing multiple transactions (`signAllTransactions`)
-   **Plugin Support**: Utilizes `solana-agent-kit` plugins, demonstrated with `@solana-agent-kit/plugin-token` for token-related operations.
-   **AI Model Configuration**: Uses custom AI providers (`myProvider`) to define and manage different language and image models (e.g., GPT-4o, GPT-3.5 Turbo, DALL-E 3) via `@ai-sdk/openai`.
-   **Chat Persistence**: Includes utility functions to fetch, save, and delete chat history and messages from a backend server.
-   **Wallet Integration**: Relies on `@/modules/wallet-providers` (specifically `useWallet`) for wallet connection status, public key retrieval, and transaction/message signing capabilities.
-   **Polyfills**: Ensures necessary polyfills like `Buffer` and `ReadableStream` are available for the AI SDK to function correctly in a React Native environment.

## Module Structure

```
src/modules/solana-agent-kit/
├── hooks/
│   └── useChat.ts         # React hook for managing chat state and interactions.
├── lib/
│   ├── ai/
│   │   └── providers.ts   # Configures AI language and image models.
│   └── utils.ts         # Utility functions for chat (UUID generation, API calls for persistence, data conversion).
├── index.ts               # Main export file for the module.
└── README.md              # This file.
```

## Key Components & Hooks

-   **`useChat` (in `hooks/useChat.ts`)**: The central hook for implementing chat functionality.
    -   Manages message state, loading indicators, and error handling.
    -   Handles sending user messages to the AI model and receiving streamed responses.
    -   Dynamically creates Solana tools using `SolanaAgentKit` and `createVercelAITools` based on wallet connection status.
    -   Integrates with `useWallet` to perform Solana actions requested by the AI.
    -   Includes logic for generating chat titles (`generateTitleFromUserMessage`) and managing message context for the AI.
    -   Provides `append`, `reload`, and `stop` functions similar to Vercel AI SDK's `useChat`.
    -   Features retry logic for transaction-related operations.
    -   Includes `safeDeepClone` for message object manipulation.

-   **`myProvider` (in `lib/ai/providers.ts`)**: A custom AI provider instance.
    -   Configures various OpenAI models for different tasks (chat, title generation, reasoning, image generation).
    -   Uses `customProvider`, `wrapLanguageModel`, and `extractReasoningMiddleware` from the `ai` package.
    -   Checks for `OPENAI_API_KEY` and provides a fallback to allow app functionality even if the key is missing.

## Utility Functions (`lib/utils.ts`)

-   **`cn`**: Merges Tailwind CSS classes.
-   **`generateUUID`**: Generates unique identifiers.
-   **`convertToUIMessages`**: Converts messages to the format expected by `@ai-sdk/react`.
-   **`getAuthHeaders`**: Creates HTTP headers, including an `x-wallet-address` for authenticated backend requests.
-   **Chat Persistence API Wrappers**:
    -   `fetchChat`, `fetchMessages`, `fetchChats`: Retrieve chat data from the server.
    -   `saveChat`, `saveMessages`: Persist chat data to the server.
    -   `deleteChat`, `bulkDeleteChats`, `deleteAllChats`: Delete chat data from the server.
-   **`standardizeMessageFormat`**: Ensures messages conform to a consistent structure before saving.
-   **`createOrUpdateUser`**: A utility to create or update user information on the backend.

## Environment Variables

This module relies on environment variables, typically managed via an `.env` file:

-   `OPENAI_API_KEY`: Your OpenAI API key, required for AI model interactions.
-   `HELIUS_STAKED_URL`: The Helius RPC URL (or any Solana RPC URL) used by `SolanaAgentKit` for blockchain communication.
-   `SERVER_URL`: The base URL for your backend server that handles chat persistence (saving/loading messages and chats).
    -   Example endpoints: `${SERVER_URL}/api/chat/:chatId`, `${SERVER_URL}/api/messages`, etc.

## Usage Example

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, FlatList, Text } from 'react-native';
import { useChat } from '@/modules/solana-agent-kit'; // or specific path
import { useWallet } from '@/modules/wallet-providers'; // Ensure wallet is connected

function MyChatScreen({ chatId }: { chatId: string }) {
  const { connected } = useWallet();
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, currentOperation } = useChat({
    id: chatId, // A unique ID for the chat session
    // initialMessages: [], // Optionally load existing messages
  });

  if (!connected) {
    return <Text>Please connect your wallet to use the AI Agent.</Text>;
  }

  return (
    <View style={{ flex: 1, padding: 10 }}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginVertical: 5, alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Text style={{ fontWeight: 'bold' }}>{item.role === 'user' ? 'You' : 'Agent'}:</Text>
            <Text>{item.content}</Text>
          </View>
        )}
      />
      {currentOperation && <Text style={{ fontStyle: 'italic' }}>{currentOperation}</Text>}
      {error && <Text style={{ color: 'red' }}>Error: {error}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: 'gray', marginRight: 5, padding: 8 }}
          value={input}
          onChangeText={handleInputChange}
          placeholder="Ask the Solana agent..."
          editable={!isLoading}
        />
        <Button title={isLoading ? "Sending..." : "Send"} onPress={() => handleSubmit()} disabled={isLoading} />
      </View>
    </View>
  );
}

// Usage in your app (ensure chatId is unique per chat session)
// <MyChatScreen chatId={generateUUID()} />
```

## Important Considerations

-   **Backend Server**: A backend server is required for chat persistence (saving and loading chat history). The utility functions in `lib/utils.ts` are designed to interact with such a server.
-   **Wallet Connection**: The user must have their Solana wallet connected for the AI agent to perform any blockchain actions. The `useChat` hook checks for wallet connectivity.
-   **API Keys**: Ensure `OPENAI_API_KEY` is correctly set up in your environment variables. The module attempts to handle a missing key gracefully for basic app loading but AI features will be disabled.
-   **Solana Network**: The `HELIUS_STAKED_URL` should point to a reliable Solana RPC endpoint for the desired network (mainnet-beta, devnet, etc.).
-   **Error Handling**: The `useChat` hook provides `error` and `currentOperation` states for user feedback. Implement robust UI error display and handling.
-   **Tool Definition**: The power of `solana-agent-kit` comes from defining actions (tools) that the AI can use. The example uses `TokenPlugin`, but you can extend this with more custom actions relevant to your application.
-   **Polyfills**: The module includes calls to `ensureBuffer()` and checks for `ReadableStream`. These are crucial for the Vercel AI SDK to work in React Native. Ensure these are correctly set up in your project if you encounter related issues.
-   **Security**: When the AI requests to sign transactions or messages, always clearly present the details to the user for confirmation. The AI acts on behalf of the user, so user approval for sensitive operations is paramount.
``` 