/**
 * Memory Hooks
 *
 * TanStack Query hooks for memory operations.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	addMemoryBlock,
	createMemory,
	deleteMemory,
	getAllMemories,
	getMemoryByFolderId,
	getOrCreateMemory,
	hasNewConversations,
	updateMemoryBlocks,
} from "@/lib/client/actions/memory-actions";
import type { MemoryBlock } from "@/lib/client/db/schema";

/**
 * Query keys for memory operations
 */
export const memoryKeys = {
	all: (userId: string) => ["memories", userId] as const,
	byFolder: (userId: string, folderId: string | null) =>
		[...memoryKeys.all(userId), "folder", folderId ?? "uncategorized"] as const,
	hasNew: (userId: string, folderId: string | null) =>
		[...memoryKeys.byFolder(userId, folderId), "has-new"] as const,
};

// ==================== Query Hooks ====================

/**
 * Get memory for a specific folder
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 */
export function useMemory(userId: string, folderId: string | null) {
	return useQuery({
		queryKey: memoryKeys.byFolder(userId, folderId),
		queryFn: () => getMemoryByFolderId(userId, folderId),
		enabled: !!userId,
	});
}

/**
 * Get all memories for a user
 *
 * @param userId - User ID
 */
export function useAllMemories(userId: string) {
	return useQuery({
		queryKey: memoryKeys.all(userId),
		queryFn: () => getAllMemories(userId),
		enabled: !!userId,
	});
}

/**
 * Check if there are new conversations that haven't been processed
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 * @param chats - Array of chats to check against
 */
export function useHasNewConversations(
	userId: string,
	folderId: string | null,
	chats: Array<{ id: string; updatedAt: Date }>,
) {
	return useQuery({
		queryKey: memoryKeys.hasNew(userId, folderId),
		queryFn: () => hasNewConversations(userId, folderId, chats),
		enabled: !!userId && chats.length > 0,
	});
}

// ==================== Mutation Hooks ====================

/**
 * Create a new memory document
 */
export function useCreateMemory(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { folderId: string | null; blocks?: MemoryBlock[] }) =>
			createMemory({ userId, ...data }),
		onSuccess: (memory) => {
			queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
			queryClient.setQueryData(
				memoryKeys.byFolder(userId, memory.folderId),
				memory,
			);
		},
	});
}

/**
 * Update memory blocks
 */
export function useUpdateMemoryBlocks(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { memoryId: string; blocks: MemoryBlock[] }) =>
			updateMemoryBlocks(data.memoryId, userId, data.blocks),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
		},
	});
}

/**
 * Add a single memory block
 */
export function useAddMemoryBlock(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { memoryId: string; block: MemoryBlock }) =>
			addMemoryBlock(data.memoryId, userId, data.block),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
		},
	});
}

/**
 * Delete a memory document
 */
export function useDeleteMemory(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (memoryId: string) => deleteMemory(memoryId, userId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
		},
	});
}

/**
 * Get or create a memory document
 */
export function useGetOrCreateMemory(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (folderId: string | null) =>
			getOrCreateMemory(userId, folderId),
		onSuccess: (memory) => {
			queryClient.setQueryData(
				memoryKeys.byFolder(userId, memory.folderId),
				memory,
			);
		},
	});
}
