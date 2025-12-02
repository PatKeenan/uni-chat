/**
 * Memory Actions
 *
 * Client-side actions for managing folder memories.
 * All operations interact with the local PGlite database.
 */

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getClientDb } from "@/lib/client/db";
import {
	folderMemory,
	type IncludedChatRef,
	type MemoryBlock,
} from "@/lib/client/db/schema";

// ==================== Read Operations ====================

/**
 * Get memory document for a specific folder
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 * @returns Memory document or null if not found
 */
export async function getMemoryByFolderId(
	userId: string,
	folderId: string | null,
): Promise<typeof folderMemory.$inferSelect | null> {
	const db = await getClientDb();

	const condition =
		folderId === null
			? and(eq(folderMemory.userId, userId), isNull(folderMemory.folderId))
			: and(
					eq(folderMemory.userId, userId),
					eq(folderMemory.folderId, folderId),
				);

	const result = await db.query.folderMemory.findFirst({
		where: condition,
	});

	return result ?? null;
}

/**
 * Get all memory documents for a user
 *
 * @param userId - User ID
 * @returns Array of memory documents
 */
export async function getAllMemories(
	userId: string,
): Promise<Array<typeof folderMemory.$inferSelect>> {
	const db = await getClientDb();
	return db.query.folderMemory.findMany({
		where: eq(folderMemory.userId, userId),
	});
}

// ==================== Write Operations ====================

/**
 * Create a new memory document
 *
 * @param data - Memory creation data
 * @returns Created memory document
 */
export async function createMemory(data: {
	userId: string;
	folderId: string | null;
	blocks?: MemoryBlock[];
	includedChats?: IncludedChatRef[];
}): Promise<typeof folderMemory.$inferSelect> {
	const db = await getClientDb();

	const newMemory = {
		id: nanoid(),
		userId: data.userId,
		folderId: data.folderId,
		blocks: data.blocks ?? [],
		includedChats: data.includedChats ?? [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const [created] = await db.insert(folderMemory).values(newMemory).returning();
	return created;
}

/**
 * Update memory blocks for a memory document
 *
 * @param memoryId - Memory document ID
 * @param userId - User ID (for security check)
 * @param blocks - New blocks array
 */
export async function updateMemoryBlocks(
	memoryId: string,
	userId: string,
	blocks: MemoryBlock[],
): Promise<void> {
	const db = await getClientDb();
	await db
		.update(folderMemory)
		.set({ blocks, updatedAt: new Date() })
		.where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

/**
 * Add a single memory block to an existing memory document
 *
 * @param memoryId - Memory document ID
 * @param userId - User ID (for security check)
 * @param block - Block to add
 */
export async function addMemoryBlock(
	memoryId: string,
	userId: string,
	block: MemoryBlock,
): Promise<void> {
	const db = await getClientDb();
	const existing = await db.query.folderMemory.findFirst({
		where: and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)),
	});

	if (!existing) return;

	const updatedBlocks = [...existing.blocks, block];
	await updateMemoryBlocks(memoryId, userId, updatedBlocks);
}

/**
 * Update included chats tracking
 *
 * @param memoryId - Memory document ID
 * @param userId - User ID (for security check)
 * @param includedChats - New included chats array
 */
export async function updateIncludedChats(
	memoryId: string,
	userId: string,
	includedChats: IncludedChatRef[],
): Promise<void> {
	const db = await getClientDb();
	await db
		.update(folderMemory)
		.set({ includedChats, updatedAt: new Date() })
		.where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

/**
 * Delete a memory document
 *
 * @param memoryId - Memory document ID
 * @param userId - User ID (for security check)
 */
export async function deleteMemory(
	memoryId: string,
	userId: string,
): Promise<void> {
	const db = await getClientDb();
	await db
		.delete(folderMemory)
		.where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

// ==================== Utility Operations ====================

/**
 * Get or create a memory document for a folder
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 * @returns Existing or newly created memory document
 */
export async function getOrCreateMemory(
	userId: string,
	folderId: string | null,
): Promise<typeof folderMemory.$inferSelect> {
	const existing = await getMemoryByFolderId(userId, folderId);
	if (existing) return existing;
	return createMemory({ userId, folderId });
}

/**
 * Check if there are new conversations that haven't been processed
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 * @param chats - Array of chats to check against
 * @returns true if there are unprocessed conversations
 */
export async function hasNewConversations(
	userId: string,
	folderId: string | null,
	chats: Array<{ id: string; updatedAt: Date }>,
): Promise<boolean> {
	const memory = await getMemoryByFolderId(userId, folderId);
	if (!memory) return chats.length > 0;

	const includedChatIds = new Set(memory.includedChats.map((c) => c.chatId));

	return chats.some((chat) => {
		if (!includedChatIds.has(chat.id)) return true;
		const included = memory.includedChats.find((c) => c.chatId === chat.id);
		if (!included) return true;
		return new Date(chat.updatedAt) > new Date(included.lastMessageDate);
	});
}
