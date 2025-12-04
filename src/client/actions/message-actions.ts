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

import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getClientDb } from "@/client/db";
import { message } from "@/client/db/schema";
import type { CustomUIMessage, DB_Message } from "@/types";

// ==================== Schemas ====================

export const SaveLocalMessagesSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  userId: z.string().min(1, "User ID is required"),
  messages: z.custom<CustomUIMessage[]>(
    (val) => Array.isArray(val),
    "Messages must be an array"
  ),
});

export const GetLocalMessagesSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

export const GetUIMessagesSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

export const DeleteLocalMessagesSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

export const DeleteLocalMessageSchema = z.object({
  messageId: z.string().min(1, "Message ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

export const GetLocalMessageCountSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

export const DeleteAllLocalMessagesSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// ==================== Types ====================

export type SaveLocalMessagesInput = z.infer<typeof SaveLocalMessagesSchema>;
export type GetLocalMessagesInput = z.infer<typeof GetLocalMessagesSchema>;
export type GetUIMessagesInput = z.infer<typeof GetUIMessagesSchema>;
export type DeleteLocalMessagesInput = z.infer<
  typeof DeleteLocalMessagesSchema
>;
export type DeleteLocalMessageInput = z.infer<typeof DeleteLocalMessageSchema>;
export type GetLocalMessageCountInput = z.infer<
  typeof GetLocalMessageCountSchema
>;
export type DeleteAllLocalMessagesInput = z.infer<
  typeof DeleteAllLocalMessagesSchema
>;

// ==================== Actions ====================

/**
 * Save messages to local database
 *
 * This converts AI SDK UIMessage format to our database structure.
 * Each message can have multiple parts (text, tool-call, tool-result).
 *
 * @param input - Contains chatId, userId, and messages array
 */
export async function saveLocalMessages(
  input: SaveLocalMessagesInput
): Promise<void> {
  const {
    chatId,
    userId,
    messages: msgs,
  } = SaveLocalMessagesSchema.parse(input);
  const db = await getClientDb();

  // Process each message
  for (const msg of msgs) {
    const messageId = nanoid();
    // Insert message record
    await db.insert(message).values({
      id: messageId,
      chatId,
      role: msg.role,
      order: 0,
      parts: msg.parts,
      metadata: msg.metadata,
    });
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
 * @param input - Contains chatId and userId
 * @returns Array of messages with parts
 */
export async function getLocalMessages(
  input: GetLocalMessagesInput
): Promise<DB_Message[]> {
  const { chatId, userId } = GetLocalMessagesSchema.parse(input);
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
  });

  return messages;
}

/**
 * Get messages in AI SDK format
 *
 * Convenience function that combines getLocalMessages + toUIMessage.
 *
 * @param input - Contains chatId and userId
 * @returns Array of AI SDK formatted messages
 */
export async function getUIMessages(input: GetUIMessagesInput) {
  const data = GetUIMessagesSchema.parse(input);
  return await getLocalMessages(data);
}

/**
 * Delete all messages for a chat
 *
 * Used when clearing chat history.
 * Message parts are automatically deleted via CASCADE.
 *
 * @param input - Contains chatId and userId
 */
export async function deleteLocalMessages(
  input: DeleteLocalMessagesInput
): Promise<void> {
  const { chatId, userId } = DeleteLocalMessagesSchema.parse(input);
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
 * @param input - Contains messageId and userId
 */
export async function deleteLocalMessage(
  input: DeleteLocalMessageInput
): Promise<void> {
  const { messageId, userId } = DeleteLocalMessageSchema.parse(input);
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
 * @param input - Contains chatId and userId
 * @returns Number of messages in chat
 */
export async function getLocalMessageCount(
  input: GetLocalMessageCountInput
): Promise<number> {
  const data = GetLocalMessageCountSchema.parse(input);
  const messages = await getLocalMessages(data);
  return messages.length;
}

/**
 * Clear all messages for a user
 * WARNING: This deletes ALL messages across ALL chats!
 *
 * @param input - Contains userId
 */
export async function deleteAllLocalMessages(
  input: DeleteAllLocalMessagesInput
): Promise<void> {
  const { userId } = DeleteAllLocalMessagesSchema.parse(input);
  const db = await getClientDb();

  // Get all chats for user
  const { getLocalChats } = await import("./chat-actions");
  const chats = await getLocalChats(userId);

  // Delete messages for each chat
  for (const chat of chats) {
    await db.delete(message).where(eq(message.chatId, chat.id));
  }
}
