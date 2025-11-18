/**
 * Client-Side Chat Actions
 *
 * These functions interact with the local PGlite database to manage chats.
 * All operations are purely client-side - no server communication.
 */

import { and, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getClientDb } from "@/lib/client/db";
import { chat } from "@/lib/client/db/schema";

/**
 * Create a new chat in local database
 *
 * @param data - Chat creation data
 * @returns Created chat
 */
export async function createLocalChat(data: {
  userId: string;
  title?: string;
  selectedModel: string;
  folderId?: string | null;
}): Promise<typeof chat.$inferSelect> {
  const db = await getClientDb();

  const newChat = {
    id: nanoid(),
    userId: data.userId,
    title: data.title || null,
    selectedModel: data.selectedModel,
    folderId: data.folderId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pinned: false,
  };

  const [created] = await db.insert(chat).values(newChat).returning();

  return created;
}

/**
 * Get a single chat by ID
 *
 * @param chatId - Chat ID
 * @param userId - User ID (for security check)
 * @returns Chat or null if not found
 */
export async function getLocalChatById(
  chatId: string,
  userId: string
): Promise<typeof chat.$inferSelect | null> {
  const db = await getClientDb();

  const result = await db.query.chat.findFirst({
    where: (chat, { eq, and }) =>
      and(eq(chat.id, chatId), eq(chat.userId, userId)),
  });

  return result || null;
}

/**
 * Get all chats for a user
 *
 * @param userId - User ID
 * @param options - Optional filters
 * @returns Array of chats
 */
export async function getLocalChats(
  userId: string,
  options?: {
    folderId?: string | null;
    pinnedOnly?: boolean;
  }
): Promise<Array<typeof chat.$inferSelect>> {
  const db = await getClientDb();

  const conditions = [eq(chat.userId, userId)];

  if (options?.folderId !== undefined) {
    if (options.folderId === null) {
      conditions.push(isNull(chat.folderId));
    } else {
      conditions.push(eq(chat.folderId, options.folderId));
    }
  }

  if (options?.pinnedOnly) {
    conditions.push(eq(chat.pinned, true));
  }

  const chats = await db.query.chat.findMany({
    where: and(...conditions),
    orderBy: [desc(chat.pinned), desc(chat.updatedAt)],
  });

  return chats;
}

/**
 * Get the most recently updated chat for a user
 *
 * @param userId - User ID
 * @returns Most recent chat or null
 */
export async function getMostRecentLocalChat(
  userId: string
): Promise<typeof chat.$inferSelect | null> {
  const db = await getClientDb();

  const result = await db.query.chat.findFirst({
    where: eq(chat.userId, userId),
    orderBy: desc(chat.updatedAt),
  });

  return result || null;
}

/**
 * Update a chat
 *
 * @param chatId - Chat ID
 * @param userId - User ID (for security check)
 * @param data - Fields to update
 */
export async function updateLocalChat(
  chatId: string,
  userId: string,
  data: Partial<{
    title: string | null;
    selectedModel: string;
    folderId: string | null;
    pinned: boolean;
  }>
): Promise<void> {
  const db = await getClientDb();

  await db
    .update(chat)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

/**
 * Update chat title
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param title - New title
 */
export async function updateLocalChatTitle(
  chatId: string,
  userId: string,
  title: string
): Promise<void> {
  await updateLocalChat(chatId, userId, { title });
}

/**
 * Update chat's selected model
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param modelId - New model ID
 */
export async function updateLocalChatModel(
  chatId: string,
  userId: string,
  modelId: string
): Promise<void> {
  await updateLocalChat(chatId, userId, { selectedModel: modelId });
}

/**
 * Move chat to a different folder
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 */
export async function moveLocalChatToFolder(
  chatId: string,
  userId: string,
  folderId: string | null
): Promise<void> {
  await updateLocalChat(chatId, userId, { folderId });
}

/**
 * Toggle chat pinned status
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param pinned - New pinned status
 */
export async function toggleLocalChatPin(
  chatId: string,
  userId: string,
  pinned: boolean
): Promise<void> {
  await updateLocalChat(chatId, userId, { pinned });
}

/**
 * Update chat timestamp (called after new messages)
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 */
export async function touchLocalChat(
  chatId: string,
  userId: string
): Promise<void> {
  const db = await getClientDb();

  await db
    .update(chat)
    .set({ updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

/**
 * Delete a chat and all its messages (cascade)
 *
 * @param chatId - Chat ID
 * @param userId - User ID (for security check)
 */
export async function deleteLocalChat(
  chatId: string,
  userId: string
): Promise<void> {
  const db = await getClientDb();

  await db
    .delete(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

/**
 * Delete all chats for a user
 * WARNING: This deletes ALL chats and messages!
 *
 * @param userId - User ID
 */
export async function deleteAllLocalChats(userId: string): Promise<void> {
  const db = await getClientDb();

  await db.delete(chat).where(eq(chat.userId, userId));
}
