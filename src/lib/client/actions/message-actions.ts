/**
 * Client-Side Message Actions
 *
 * These functions interact with the local PGlite database to manage messages.
 * All operations are purely client-side - no server communication.
 *
 * Message Structure:
 * - Messages follow AI SDK's UIMessage format with parts-based content
 * - Each message can have multiple parts (text, tool-call, tool-result)
 * - Parts are stored in a separate table for flexibility
 */

import type { UIMessage } from "ai";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getClientDb } from "@/lib/client/db";
import { message, messagePart } from "@/lib/client/db/schema";

/**
 * Internal message type from database
 */
type DbMessage = typeof message.$inferSelect;
type DbMessagePart = typeof messagePart.$inferSelect;

/**
 * Message with parts joined
 */
export type LocalMessage = DbMessage & {
  parts: DbMessagePart[];
};

/**
 * Save messages to local database
 *
 * This converts AI SDK UIMessage format to our database structure.
 * Each message can have multiple parts (text, tool-call, tool-result).
 *
 * @param chatId - Chat ID to save messages to
 * @param userId - User ID (for security check)
 * @param messages - Array of AI SDK messages
 */
export async function saveLocalMessages(
  chatId: string,
  userId: string,
  messages: UIMessage[]
): Promise<void> {
  const db = await getClientDb();

  // Start from existing message count to maintain order
  const existingMessages = await getLocalMessages(chatId, userId);
  let orderCounter = existingMessages.length;

  // Process each message
  for (const msg of messages) {
    const messageId = nanoid();

    // Insert message record
    await db.insert(message).values({
      id: messageId,
      chatId,
      role: msg.role,
      order: orderCounter++,
    });

    // Process message parts
    const parts: Array<typeof messagePart.$inferInsert> = [];

    // Handle parts array (AI SDK format)
    if (Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        const partId = nanoid();

        if (part.type === "text" && "text" in part) {
          parts.push({
            id: partId,
            messageId,
            type: "text",
            textContent: part.text as string,
          });
        } else if (part.type.startsWith("tool-") && "toolCallId" in part) {
          // Tool-call part
          if ("input" in part || "output" in part || "state" in part) {
            parts.push({
              id: partId,
              messageId,
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolCallName: part.type.replace("tool-", ""),
              toolCallArgs:
                "input" in part ? (part.input as Record<string, unknown>) : {},
            });

            // If there's an output, also save it as a tool result
            if ("output" in part && part.output !== undefined) {
              parts.push({
                id: nanoid(),
                messageId,
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolResultContent: part.output,
              });
            }
          }
        }
      }
    }

    // Insert all parts
    if (parts.length > 0) {
      await db.insert(messagePart).values(parts);
    }
  }

  // Update chat timestamp
  const { touchLocalChat } = await import("./chat-actions");
  await touchLocalChat(chatId, userId);
}

/**
 * Get all messages for a chat
 *
 * Returns messages in order with their parts joined.
 *
 * @param chatId - Chat ID
 * @param userId - User ID (for security check)
 * @returns Array of messages with parts
 */
export async function getLocalMessages(
  chatId: string,
  userId: string
): Promise<LocalMessage[]> {
  const db = await getClientDb();

  // First verify the chat belongs to the user
  const { getLocalChatById } = await import("./chat-actions");
  const chat = await getLocalChatById(chatId, userId);
  if (!chat) {
    throw new Error("Chat not found or access denied");
  }

  // Get all messages for this chat
  const messages = await db.query.message.findMany({
    where: eq(message.chatId, chatId),
    orderBy: asc(message.order),
    with: {
      parts: {
        orderBy: asc(messagePart.id),
      },
    },
  });

  return messages;
}

/**
 * Convert database message to AI SDK UIMessage format
 *
 * This is useful for feeding messages back into AI SDK chat functions.
 *
 * @param dbMessage - Message from database with parts
 * @returns AI SDK formatted message
 */
export function toUIMessage(dbMessage: LocalMessage): UIMessage {
  const parts = dbMessage.parts.map((part) => {
    if (part.type === "text") {
      return {
        type: "text" as const,
        text: part.textContent || "",
      };
    }
    if (part.type === "tool-call") {
      return {
        type: "tool-call" as const,
        toolCallId: part.toolCallId || "",
        toolName: part.toolCallName || "",
        args: part.toolCallArgs || {},
      };
    }
    if (part.type === "tool-result") {
      return {
        type: "tool-result" as const,
        toolCallId: part.toolCallId || "",
        result: part.toolResultContent,
      };
    }

    // Fallback for unknown types
    return {
      type: "text" as const,
      text: "",
    };
  });

  return {
    id: dbMessage.id,
    role: dbMessage.role as "user" | "assistant" | "system",
    parts: parts as UIMessage["parts"],
  };
}

/**
 * Get messages in AI SDK format
 *
 * Convenience function that combines getLocalMessages + toUIMessage.
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @returns Array of AI SDK formatted messages
 */
export async function getUIMessages(
  chatId: string,
  userId: string
): Promise<UIMessage[]> {
  const messages = await getLocalMessages(chatId, userId);
  return messages.map(toUIMessage);
}

/**
 * Delete all messages for a chat
 *
 * Used when clearing chat history.
 * Message parts are automatically deleted via CASCADE.
 *
 * @param chatId - Chat ID
 * @param userId - User ID (for security check)
 */
export async function deleteLocalMessages(
  chatId: string,
  userId: string
): Promise<void> {
  const db = await getClientDb();

  // Verify chat ownership
  const { getLocalChatById } = await import("./chat-actions");
  const chat = await getLocalChatById(chatId, userId);
  if (!chat) {
    throw new Error("Chat not found or access denied");
  }

  // Delete all messages (parts cascade automatically)
  await db.delete(message).where(eq(message.chatId, chatId));
}

/**
 * Delete a single message
 *
 * @param messageId - Message ID
 * @param userId - User ID (for security check)
 */
export async function deleteLocalMessage(
  messageId: string,
  userId: string
): Promise<void> {
  const db = await getClientDb();

  // Get message to verify ownership through chat
  const msg = await db.query.message.findFirst({
    where: eq(message.id, messageId),
    with: {
      chat: true,
    },
  });

  if (!msg || msg.chat.userId !== userId) {
    throw new Error("Message not found or access denied");
  }

  // Delete message (parts cascade automatically)
  await db.delete(message).where(eq(message.id, messageId));
}

/**
 * Get message count for a chat
 *
 * Useful for showing message statistics.
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @returns Number of messages in chat
 */
export async function getLocalMessageCount(
  chatId: string,
  userId: string
): Promise<number> {
  const messages = await getLocalMessages(chatId, userId);
  return messages.length;
}

/**
 * Clear all messages for a user
 * WARNING: This deletes ALL messages across ALL chats!
 *
 * @param userId - User ID
 */
export async function deleteAllLocalMessages(userId: string): Promise<void> {
  const db = await getClientDb();

  // Get all chats for user
  const { getLocalChats } = await import("./chat-actions");
  const chats = await getLocalChats(userId);

  // Delete messages for each chat
  for (const chat of chats) {
    await db.delete(message).where(eq(message.chatId, chat.id));
  }
}
