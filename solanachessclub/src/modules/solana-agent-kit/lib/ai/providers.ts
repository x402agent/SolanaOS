import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { OPENAI_API_KEY } from "@env";

// Check if API key exists and provide a helpful error message if not
if (!OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY is not set in environment variables. " +
    "Please add it to your .env file to enable AI functionality."
  );
}

// Create OpenAI provider with a fallback for missing API key
// This allows the app to load even without an API key
const openai = createOpenAI({
  apiKey: OPENAI_API_KEY || "dummy-key-placeholder",
});

export const myProvider = customProvider({
  languageModels: {
    "chat-model": openai("gpt-4o"),
    "chat-model-reasoning": wrapLanguageModel({
      model: openai("o3-mini"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": openai("gpt-3.5-turbo"),
    "artifact-model": openai("gpt-4"),
  },
  imageModels: {
    "small-model": openai.image("dall-e-3"),
  },
});
