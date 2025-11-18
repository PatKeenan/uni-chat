import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { streamText, convertToModelMessages } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Custom AI SDK transport that calls OpenRouter directly from the client
 * This eliminates the need for a backend /api/chat endpoint
 *
 * The transport:
 * 1. Receives messages from AI SDK's useChat hook
 * 2. Converts them to model messages
 * 3. Calls OpenRouter API directly with user's API key via AI SDK provider
 * 4. Streams the response back to the UI
 */
export class OpenRouterTransport implements ChatTransport {
  private apiKey: string;
  private modelId: string;
  private siteUrl?: string;
  private siteName?: string;

  constructor(config: {
    apiKey: string;
    modelId: string;
    siteUrl?: string;
    siteName?: string;
  }) {
    this.apiKey = config.apiKey;
    this.modelId = config.modelId;
    this.siteUrl = config.siteUrl;
    this.siteName = config.siteName;
  }

  /**
   * Update the model ID dynamically
   */
  setModelId(modelId: string) {
    this.modelId = modelId;
  }

  /**
   * AI SDK calls this method to send messages
   */
  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk>> {
    try {
      console.log("[OpenRouterTransport] Sending messages:", {
        chatId: options.chatId,
        trigger: options.trigger,
        messageCount: options.messages.length,
        model: this.modelId,
      });

      // Create OpenRouter provider with user's API key
      const openrouter = createOpenRouter({
        apiKey: this.apiKey,
        headers: {
          ...(this.siteUrl && { "HTTP-Referer": this.siteUrl }),
          ...(this.siteName && { "X-Title": this.siteName }),
        },
      });

      // Convert UI messages to model messages
      const modelMessages = convertToModelMessages(options.messages);

      // Use AI SDK's streamText to call OpenRouter
      const result = streamText({
        model: openrouter(this.modelId),
        messages: modelMessages,
        abortSignal: options.abortSignal,
      });

      // Return the UI message stream
      return result.toUIMessageStream();
    } catch (error) {
      console.error("[OpenRouterTransport] Error:", error);
      throw error;
    }
  }

  /**
   * AI SDK calls this method to reconnect to an existing stream
   * Not implemented for OpenRouter direct client-side calls
   */
  async reconnectToStream(options: {
    chatId: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk> | null> {
    console.log("[OpenRouterTransport] reconnectToStream not implemented", {
      chatId: options.chatId,
    });
    throw new Error("Stream reconnection is not supported for client-side OpenRouter transport");
  }
}
