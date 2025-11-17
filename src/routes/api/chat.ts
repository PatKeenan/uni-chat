import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { createOpenRouterClient } from "@/lib/openrouter/client";
import {
  type ChatMessage,
  saveMessages,
} from "@/lib/server/actions/message-actions";
import { apiKey as apiKeyTable, chat } from "@/lib/server/db/schema";
import { protectedMiddleware } from "@/lib/server/middleware/protected-middleware";
import { decryptApiKey } from "@/lib/server/utils/encryption";

/**
 * POST /api/chat
 * Streams AI responses using Vercel AI SDK + OpenRouter
 *
 * Request body:
 * - chatId: string - ID of the chat conversation
 * - messages: UIMessage[] - Previous messages in the conversation
 * - modelId: string - OpenRouter model ID (e.g., "anthropic/claude-3.5-sonnet")
 */
export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        try {
          // Parse request body
          const body = await request.json();
          const { chatId, messages, modelId } = body as {
            chatId: string;
            messages: UIMessage[];
            modelId: string;
          };

          // Validate required fields
          if (!chatId || !modelId || !messages) {
            return new Response(
              JSON.stringify({
                error: "Missing required fields: chatId, modelId, messages",
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

          const { db } = context.config;

          // Get user's API key from database
          const keyRecord = await db
            .select()
            .from(apiKeyTable)
            .where(eq(apiKeyTable.userId, context.user.id))
            .limit(1);

          if (!keyRecord || keyRecord.length === 0) {
            return new Response(
              JSON.stringify({
                error:
                  "No API key found. Please add your OpenRouter API key in settings.",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Decrypt the API key
          const apiKey = await decryptApiKey(keyRecord[0].encryptedKey);

          // Create OpenRouter client
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
          return result.toUIMessageStreamResponse({
            // Save messages after AI completes response
            onFinish: async ({ responseMessage }) => {
              try {
                // Convert UIMessage to ChatMessage (filter to only text parts)
                const convertToChat = (msg: UIMessage): ChatMessage => ({
                  id: msg.id,
                  role: msg.role,
                  parts: msg.parts
                    .filter((p) => p.type === "text")
                    .map((p) => ({
                      type: "text" as const,
                      text: "text" in p ? (p.text as string) : "",
                    })),
                });

                const allMessages: ChatMessage[] = [
                  ...messages.map(convertToChat),
                  convertToChat(responseMessage),
                ];
                await saveMessages({ data: { chatId, messages: allMessages } });

                // Update chat timestamp
                await db
                  .update(chat)
                  .set({ updatedAt: new Date() })
                  .where(eq(chat.id, chatId));
              } catch (error) {
                console.error("Error saving messages:", error);
              }
            },
          });
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
