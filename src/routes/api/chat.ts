import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
} from "ai";
import type { ModelCapabilities } from "@/chat-store";
import type { DB_Message } from "@/lib/client/db/schema";
import type { Model } from "@/lib/client/types";
import { toUiMessages } from "@/lib/client/utils/to-ui-message";
import { createOpenRouterClient } from "@/lib/openrouter/client";
import { initWebSearchTool } from "@/lib/server/ai-tools/web-search";
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
        const body = await request.json();
        console.log(body);
        try {
          // Parse request body
          const {
            chatId,
            messages,
            modelId,
            apiKey,
            tavilyApiKey,
            capabilities,
          } = body as {
            chatId: string;
            messages: DB_Message[];
            modelId: string;
            apiKey?: string;
            tavilyApiKey?: string;
            capabilities?: ModelCapabilities;
            modelMetadata?: Model | null;
          };

          // Extract capability flags (with fallbacks for backwards compatibility)
          const supportsToolCalls = capabilities?.supportsToolCalls ?? false;
          const supportsImageOutput =
            capabilities?.supportsImageOutput ?? false;
          const supportsTextOutput = capabilities?.supportsTextOutput ?? true;
          // Validate required fields
          if (!chatId || !modelId || !messages || !apiKey) {
            return new Response(
              JSON.stringify({
                error:
                  "Missing required fields: chatId, modelId, messages, apiKey",
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
          const uiMessages = toUiMessages(messages);

          // Convert UIMessage to model messages using AI SDK utility
          // @ts-expect-error - TODO: there seems to be a type issue here. AI sdk does not want to accept our custom type even though its valid.
          const modelMessages = convertToModelMessages(uiMessages);
          const prunedMessages = pruneMessages({
            messages: modelMessages,
            reasoning: "before-last-message",
            toolCalls: "before-last-message",
          });

          // Handle image generation models
          // These models output images, not text, and require different handling
          if (supportsImageOutput && !supportsTextOutput) {
            // TODO: Implement image generation using Vercel AI SDK's generateImage
            // For now, return an error explaining this model type isn't supported yet
            return new Response(
              JSON.stringify({
                error:
                  "Image generation models are not yet supported. Please select a text-based model.",
                modelCapabilities: {
                  supportsImageOutput,
                  supportsTextOutput,
                  supportsToolCalls,
                },
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          if (!supportsToolCalls) {
            const result = streamText({
              system: `You are a helpful assistant that can search the web for information using the webSearch tool.  Today is ${new Date().toLocaleDateString()} and the time is ${new Date().toLocaleTimeString()}. You are currently in the following timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`,
              model: openrouter(modelId),
              messages: prunedMessages,
              stopWhen: stepCountIs(5),
            });
            // Ensure stream completes even if client disconnects
            result.consumeStream();

            // Return streaming response with reasoning enabled
            // NO PERSISTENCE - client handles saving messages
            return result.toUIMessageStreamResponse({
              sendReasoning: true, // Enable reasoning token streaming
            });
          }

          if (tavilyApiKey) {
            const webSearchTool = initWebSearchTool(tavilyApiKey);
            const result = streamText({
              system: `You are a helpful assistant that can search the web for information using the webSearch tool.  Today is ${new Date().toLocaleDateString()} and the time is ${new Date().toLocaleTimeString()}. You are currently in the following timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`,
              model: openrouter(modelId),
              tools: {
                webSearch: webSearchTool,
              },
              messages: prunedMessages,
              stopWhen: stepCountIs(5),
            });
            // Ensure stream completes even if client disconnects
            result.consumeStream();

            // Return streaming response with reasoning enabled
            // NO PERSISTENCE - client handles saving messages
            return result.toUIMessageStreamResponse({
              sendReasoning: true, // Enable reasoning token streaming
            });
          }

          //filter out any message parts that dont have a type of text
          const messagesWithoutToolCalls = messages.map((i) => ({
            role: i.role as "user" | "system" | "assistant",
            parts: i.parts?.filter((p) => p.type === "text"),
          }));

          const filteredToolCall = convertToModelMessages(
            // @ts-expect-error - TODO: there seems to be a type issue here. AI sdk does not want to accept our custom type even though its valid.
            messagesWithoutToolCalls
          );

          // if we arn't using tavily, we need to strip any tool calls from the message history
          // Stream the response
          const result = streamText({
            model: openrouter(modelId),
            messages: filteredToolCall,
          });
          // Ensure stream completes even if client disconnects
          result.consumeStream();

          // Return streaming response with reasoning enabled
          // NO PERSISTENCE - client handles saving messages
          return result.toUIMessageStreamResponse({
            sendReasoning: true, // Enable reasoning token streaming
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
