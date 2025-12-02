/**
 * Client-Side Memory Actions
 *
 * These functions interact with the local PGlite database to manage folder memories.
 * Memories store context summaries at the folder level - all operations are client-side only.
 */

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getClientDb } from "@/client/db";
import { folderMemory } from "@/client/db/schema";
import type { IncludedChatRef, MemoryBlock } from "@/types";

// ==================== Read Operations ====================

/**
 * Get memory for a specific folder
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

	const result = await db.query.folderMemory.findFirst({
		where: (memory, { eq, and, isNull }) =>
			folderId === null
				? and(eq(memory.userId, userId), isNull(memory.folderId))
				: and(eq(memory.userId, userId), eq(memory.folderId, folderId)),
	});

	return result || null;
}

/**
 * Get memory by ID
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @returns Memory document or null if not found
 */
export async function getMemoryById(
	memoryId: string,
	userId: string,
): Promise<typeof folderMemory.$inferSelect | null> {
	const db = await getClientDb();

	const result = await db.query.folderMemory.findFirst({
		where: (memory, { eq, and }) =>
			and(eq(memory.id, memoryId), eq(memory.userId, userId)),
	});

	return result || null;
}

/**
 * Get all memories for a user
 *
 * @param userId - User ID
 * @returns Array of all memory documents
 */
export async function getAllMemories(
	userId: string,
): Promise<Array<typeof folderMemory.$inferSelect>> {
	const db = await getClientDb();

	const memories = await db.query.folderMemory.findMany({
		where: eq(folderMemory.userId, userId),
		orderBy: [folderMemory.updatedAt],
	});

	return memories;
}

/**
 * Get memories with folder information
 *
 * @param userId - User ID
 * @returns Array of memories with their folder data
 */
export async function getMemoriesWithFolders(userId: string): Promise<
	Array<
		typeof folderMemory.$inferSelect & {
			folder: { id: string; name: string } | null;
		}
	>
> {
	const db = await getClientDb();

	const memories = await db.query.folderMemory.findMany({
		where: eq(folderMemory.userId, userId),
		with: {
			folder: true,
		},
		orderBy: [folderMemory.updatedAt],
	});

	return memories.map((m) => ({
		...m,
		folder: m.folder ? { id: m.folder.id, name: m.folder.name } : null,
	}));
}

// ==================== Create Operations ====================

/**
 * Create a new memory for a folder
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
		blocks: data.blocks || [],
		includedChats: data.includedChats || [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const [created] = await db.insert(folderMemory).values(newMemory).returning();

	return created;
}

/**
 * Get or create memory for a folder
 *
 * Creates a new empty memory if one doesn't exist.
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 * @returns Existing or newly created memory
 */
export async function getOrCreateMemory(
	userId: string,
	folderId: string | null,
): Promise<typeof folderMemory.$inferSelect> {
	const existing = await getMemoryByFolderId(userId, folderId);
	if (existing) {
		return existing;
	}

	return createMemory({ userId, folderId });
}

// ==================== Update Operations ====================

/**
 * Update memory blocks
 *
 * Replaces all blocks in the memory document.
 *
 * @param memoryId - Memory ID
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
		.set({
			blocks,
			updatedAt: new Date(),
		})
		.where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

/**
 * Add a new block to memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param block - Block to add
 */
export async function addMemoryBlock(
	memoryId: string,
	userId: string,
	block: Omit<MemoryBlock, "id" | "createdAt">,
): Promise<MemoryBlock> {
	const memory = await getMemoryById(memoryId, userId);
	if (!memory) {
		throw new Error("Memory not found");
	}

	const newBlock: MemoryBlock = {
		id: nanoid(),
		...block,
		createdAt: new Date().toISOString(),
	};

	const updatedBlocks = [...memory.blocks, newBlock];
	await updateMemoryBlocks(memoryId, userId, updatedBlocks);

	return newBlock;
}

/**
 * Update a specific block in memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param blockId - Block ID to update
 * @param content - New content
 */
export async function updateMemoryBlock(
	memoryId: string,
	userId: string,
	blockId: string,
	content: string,
): Promise<void> {
	const memory = await getMemoryById(memoryId, userId);
	if (!memory) {
		throw new Error("Memory not found");
	}

	const updatedBlocks = memory.blocks.map((block) =>
		block.id === blockId
			? { ...block, content, updatedAt: new Date().toISOString() }
			: block,
	);

	await updateMemoryBlocks(memoryId, userId, updatedBlocks);
}

/**
 * Delete a specific block from memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param blockId - Block ID to delete
 */
export async function deleteMemoryBlock(
	memoryId: string,
	userId: string,
	blockId: string,
): Promise<void> {
	const memory = await getMemoryById(memoryId, userId);
	if (!memory) {
		throw new Error("Memory not found");
	}

	const updatedBlocks = memory.blocks.filter((block) => block.id !== blockId);
	await updateMemoryBlocks(memoryId, userId, updatedBlocks);
}

/**
 * Update included chats tracking
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param includedChats - Updated included chats array
 */
export async function updateIncludedChats(
	memoryId: string,
	userId: string,
	includedChats: IncludedChatRef[],
): Promise<void> {
	const db = await getClientDb();

	await db
		.update(folderMemory)
		.set({
			includedChats,
			updatedAt: new Date(),
		})
		.where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

/**
 * Add a chat reference to included chats
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param chatRef - Chat reference to add
 */
export async function addIncludedChat(
	memoryId: string,
	userId: string,
	chatRef: IncludedChatRef,
): Promise<void> {
	const memory = await getMemoryById(memoryId, userId);
	if (!memory) {
		throw new Error("Memory not found");
	}

	// Check if chat is already included, update if so
	const existingIndex = memory.includedChats.findIndex(
		(ref) => ref.chatId === chatRef.chatId,
	);

	let updatedChats: IncludedChatRef[];
	if (existingIndex >= 0) {
		updatedChats = [...memory.includedChats];
		updatedChats[existingIndex] = chatRef;
	} else {
		updatedChats = [...memory.includedChats, chatRef];
	}

	await updateIncludedChats(memoryId, userId, updatedChats);
}

// ==================== Delete Operations ====================

/**
 * Delete a memory document
 *
 * @param memoryId - Memory ID
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

/**
 * Delete memory for a specific folder
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 */
export async function deleteMemoryByFolderId(
	userId: string,
	folderId: string | null,
): Promise<void> {
	const db = await getClientDb();

	if (folderId === null) {
		await db
			.delete(folderMemory)
			.where(
				and(eq(folderMemory.userId, userId), isNull(folderMemory.folderId)),
			);
	} else {
		await db
			.delete(folderMemory)
			.where(
				and(
					eq(folderMemory.userId, userId),
					eq(folderMemory.folderId, folderId),
				),
			);
	}
}

/**
 * Delete all memories for a user
 * WARNING: This deletes ALL memories!
 *
 * @param userId - User ID
 */
export async function deleteAllMemories(userId: string): Promise<void> {
	const db = await getClientDb();

	await db.delete(folderMemory).where(eq(folderMemory.userId, userId));
}

/**
 * Clear all blocks from a memory (keep the memory document)
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 */
export async function clearMemoryBlocks(
	memoryId: string,
	userId: string,
): Promise<void> {
	await updateMemoryBlocks(memoryId, userId, []);
}

// ==================== Utility Operations ====================

/**
 * Check if a chat has been included in a memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param chatId - Chat ID to check
 * @returns Included chat reference or null
 */
export async function getChatInclusionStatus(
	memoryId: string,
	userId: string,
	chatId: string,
): Promise<IncludedChatRef | null> {
	const memory = await getMemoryById(memoryId, userId);
	if (!memory) {
		return null;
	}

	return memory.includedChats.find((ref) => ref.chatId === chatId) || null;
}

/**
 * Get total block count for a memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @returns Number of blocks, or 0 if memory not found
 */
export async function getMemoryBlockCount(
	memoryId: string,
	userId: string,
): Promise<number> {
	const memory = await getMemoryById(memoryId, userId);
	return memory?.blocks.length || 0;
}

/**
 * Get memory statistics for a user
 *
 * @param userId - User ID
 * @returns Statistics object
 */
export async function getMemoryStats(userId: string): Promise<{
	totalMemories: number;
	totalBlocks: number;
	totalIncludedChats: number;
}> {
	const memories = await getAllMemories(userId);

	return {
		totalMemories: memories.length,
		totalBlocks: memories.reduce((sum, m) => sum + m.blocks.length, 0),
		totalIncludedChats: memories.reduce(
			(sum, m) => sum + m.includedChats.length,
			0,
		),
	};
}
