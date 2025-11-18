import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenRouterClient } from "@/lib/openrouter/client";
import { protectedMiddleware } from "@/lib/server/middleware/protected-middleware";

/**
 * POST /api/chat
 * Streams AI responses using Vercel AI SDK + OpenRouter
 *
 * LOCAL-FIRST: This endpoint does NOT persist any data.
 * The client is responsible for storing messages locally.
 *
 * Request body:
 * - chatId: string - ID of the chat conversation (not used server-side, just for client reference)
 * - messages: UIMessage[] - Previous messages in the conversation
 * - modelId: string - OpenRouter model ID (e.g., "anthropic/claude-3.5-sonnet")
 * - apiKey: string - User's OpenRouter API key (sent from client, stored client-side)
 */
export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        try {
          // Parse request body
          const body = await request.json();
          const { chatId, messages, modelId, apiKey } = body as {
            chatId: string;
            messages: UIMessage[];
            modelId: string;
            apiKey: string;
          };

          // Validate required fields
          if (!chatId || !modelId || !messages || !apiKey) {
            return new Response(
              JSON.stringify({
                error: "Missing required fields: chatId, modelId, messages, apiKey",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Check authentication
          if (!context.user?.id) {
            return new Response(
              JSON.stringify({ error: "Authentication required" }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Create OpenRouter client with provided API key
          const openrouter = createOpenRouterClient(apiKey);

          // Convert UIMessage to model messages using AI SDK utility
          const modelMessages = convertToModelMessages(messages);

          // Stream the response
          const result = streamText({
            model: openrouter(modelId),
            messages: modelMessages,
          });

          // Ensure stream completes even if client disconnects
          result.consumeStream();

          // Return streaming response using data stream protocol
          // NO PERSISTENCE - client handles saving messages
          return result.toUIMessageStreamResponse();
        } catch (error) {
          console.error("Chat API error:", error);
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "An error occurred while processing your request",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
