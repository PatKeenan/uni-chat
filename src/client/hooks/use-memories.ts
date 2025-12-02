/**
 * React hooks for local memory management
 *
 * These hooks use TanStack Query to manage folder memories in local PGlite database.
 * Memories store context summaries at the folder level.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	addIncludedChat,
	addMemoryBlock,
	clearMemoryBlocks,
	createMemory,
	deleteAllMemories,
	deleteMemory,
	deleteMemoryBlock,
	deleteMemoryByFolderId,
	getAllMemories,
	getMemoriesWithFolders,
	getMemoryByFolderId,
	getMemoryById,
	getMemoryStats,
	getOrCreateMemory,
	updateMemoryBlock,
	updateMemoryBlocks,
} from "@/client/actions/memory-actions";
import type { folderMemory } from "@/client/db/schema";
import type { IncludedChatRef, MemoryBlock } from "@/types";
import { folderKeys } from "./use-local-folders";

/**
 * Query keys for memory operations
 */
export const memoryKeys = {
	all: (userId: string) => ["local-memories", userId] as const,
	lists: (userId: string) => [...memoryKeys.all(userId), "list"] as const,
	list: (userId: string) => [...memoryKeys.lists(userId)] as const,
	listWithFolders: (userId: string) =>
		[...memoryKeys.lists(userId), "with-folders"] as const,
	details: (userId: string) => [...memoryKeys.all(userId), "detail"] as const,
	detail: (userId: string, memoryId: string) =>
		[...memoryKeys.details(userId), memoryId] as const,
	byFolder: (userId: string, folderId: string | null) =>
		[...memoryKeys.all(userId), "by-folder", folderId] as const,
	stats: (userId: string) => [...memoryKeys.all(userId), "stats"] as const,
};

// ==================== Query Hooks ====================

/**
 * Get all memories for a user
 *
 * @param userId - User ID
 */
export function useMemories(userId: string) {
	return useQuery({
		queryKey: memoryKeys.list(userId),
		queryFn: () => getAllMemories(userId),
		enabled: !!userId,
	});
}

/**
 * Get all memories with folder information
 *
 * @param userId - User ID
 */
export function useMemoriesWithFolders(userId: string) {
	return useQuery({
		queryKey: memoryKeys.listWithFolders(userId),
		queryFn: () => getMemoriesWithFolders(userId),
		enabled: !!userId,
	});
}

/**
 * Get a memory by ID
 *
 * @param memoryId - Memory ID
 * @param userId - User ID
 */
export function useMemory(memoryId: string, userId: string) {
	return useQuery({
		queryKey: memoryKeys.detail(userId, memoryId),
		queryFn: () => getMemoryById(memoryId, userId),
		enabled: !!userId && !!memoryId,
	});
}

/**
 * Get memory for a specific folder
 *
 * @param userId - User ID
 * @param folderId - Folder ID (null for uncategorized)
 */
export function useMemoryByFolder(userId: string, folderId: string | null) {
	return useQuery({
		queryKey: memoryKeys.byFolder(userId, folderId),
		queryFn: () => getMemoryByFolderId(userId, folderId),
		enabled: !!userId,
	});
}

/**
 * Get memory statistics for a user
 *
 * @param userId - User ID
 */
export function useMemoryStats(userId: string) {
	return useQuery({
		queryKey: memoryKeys.stats(userId),
		queryFn: () => getMemoryStats(userId),
		enabled: !!userId,
	});
}

// ==================== Mutation Hooks ====================

/**
 * Create a new memory for a folder
 */
export function useCreateMemory(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: {
			folderId: string | null;
			blocks?: MemoryBlock[];
			includedChats?: IncludedChatRef[];
		}) =>
			createMemory({
				userId,
				...data,
			}),
		onSuccess: (newMemory) => {
			// Invalidate memory lists
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });

			// Add to detail cache
			queryClient.setQueryData(
				memoryKeys.detail(userId, newMemory.id),
				newMemory,
			);

			// Add to by-folder cache
			queryClient.setQueryData(
				memoryKeys.byFolder(userId, newMemory.folderId),
				newMemory,
			);

			// Invalidate stats
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
		},
	});
}

/**
 * Get or create memory for a folder
 *
 * Creates a new empty memory if one doesn't exist.
 */
export function useGetOrCreateMemory(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (folderId: string | null) =>
			getOrCreateMemory(userId, folderId),
		onSuccess: (memory) => {
			// Update caches
			queryClient.setQueryData(memoryKeys.detail(userId, memory.id), memory);
			queryClient.setQueryData(
				memoryKeys.byFolder(userId, memory.folderId),
				memory,
			);

			// Invalidate lists and stats
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
		},
	});
}

/**
 * Update memory blocks (replace all)
 */
export function useUpdateMemoryBlocks(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			memoryId,
			blocks,
		}: {
			memoryId: string;
			blocks: MemoryBlock[];
		}) => updateMemoryBlocks(memoryId, userId, blocks),
		onMutate: async ({ memoryId, blocks }) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});

			// Snapshot previous value
			const previousMemory = queryClient.getQueryData<
				typeof folderMemory.$inferSelect
			>(memoryKeys.detail(userId, memoryId));

			// Optimistically update
			if (previousMemory) {
				queryClient.setQueryData(memoryKeys.detail(userId, memoryId), {
					...previousMemory,
					blocks,
					updatedAt: new Date(),
				});
			}

			return { previousMemory };
		},
		onError: (_err, { memoryId }, context) => {
			// Rollback on error
			if (context?.previousMemory) {
				queryClient.setQueryData(
					memoryKeys.detail(userId, memoryId),
					context.previousMemory,
				);
			}
		},
		onSettled: (_data, _error, { memoryId }) => {
			// Refetch to ensure consistency
			queryClient.invalidateQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
		},
	});
}

/**
 * Add a new block to memory
 */
export function useAddMemoryBlock(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			memoryId,
			block,
		}: {
			memoryId: string;
			block: Omit<MemoryBlock, "id" | "createdAt">;
		}) => addMemoryBlock(memoryId, userId, block),
		onSuccess: (_, { memoryId }) => {
			queryClient.invalidateQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
		},
	});
}

/**
 * Update a specific block in memory
 */
export function useUpdateMemoryBlock(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			memoryId,
			blockId,
			content,
		}: {
			memoryId: string;
			blockId: string;
			content: string;
		}) => updateMemoryBlock(memoryId, userId, blockId, content),
		onMutate: async ({ memoryId, blockId, content }) => {
			await queryClient.cancelQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});

			const previousMemory = queryClient.getQueryData<
				typeof folderMemory.$inferSelect
			>(memoryKeys.detail(userId, memoryId));

			if (previousMemory) {
				queryClient.setQueryData(memoryKeys.detail(userId, memoryId), {
					...previousMemory,
					blocks: previousMemory.blocks.map((block) =>
						block.id === blockId
							? { ...block, content, updatedAt: new Date().toISOString() }
							: block,
					),
					updatedAt: new Date(),
				});
			}

			return { previousMemory };
		},
		onError: (_err, { memoryId }, context) => {
			if (context?.previousMemory) {
				queryClient.setQueryData(
					memoryKeys.detail(userId, memoryId),
					context.previousMemory,
				);
			}
		},
		onSettled: (_data, _error, { memoryId }) => {
			queryClient.invalidateQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
		},
	});
}

/**
 * Delete a specific block from memory
 */
export function useDeleteMemoryBlock(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			memoryId,
			blockId,
		}: {
			memoryId: string;
			blockId: string;
		}) => deleteMemoryBlock(memoryId, userId, blockId),
		onMutate: async ({ memoryId, blockId }) => {
			await queryClient.cancelQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});

			const previousMemory = queryClient.getQueryData<
				typeof folderMemory.$inferSelect
			>(memoryKeys.detail(userId, memoryId));

			if (previousMemory) {
				queryClient.setQueryData(memoryKeys.detail(userId, memoryId), {
					...previousMemory,
					blocks: previousMemory.blocks.filter((block) => block.id !== blockId),
					updatedAt: new Date(),
				});
			}

			return { previousMemory };
		},
		onError: (_err, { memoryId }, context) => {
			if (context?.previousMemory) {
				queryClient.setQueryData(
					memoryKeys.detail(userId, memoryId),
					context.previousMemory,
				);
			}
		},
		onSettled: (_data, _error, { memoryId }) => {
			queryClient.invalidateQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
		},
	});
}

/**
 * Add a chat reference to included chats
 */
export function useAddIncludedChat(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			memoryId,
			chatRef,
		}: {
			memoryId: string;
			chatRef: IncludedChatRef;
		}) => addIncludedChat(memoryId, userId, chatRef),
		onSuccess: (_, { memoryId }) => {
			queryClient.invalidateQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
		},
	});
}

/**
 * Clear all blocks from a memory
 */
export function useClearMemoryBlocks(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (memoryId: string) => clearMemoryBlocks(memoryId, userId),
		onSuccess: (_, memoryId) => {
			queryClient.invalidateQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });
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
		onSuccess: (_, memoryId) => {
			// Remove from cache
			queryClient.removeQueries({
				queryKey: memoryKeys.detail(userId, memoryId),
			});

			// Invalidate lists and stats
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });

			// Invalidate folder queries since memory indicator may change
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });
		},
	});
}

/**
 * Delete memory for a specific folder
 */
export function useDeleteMemoryByFolder(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (folderId: string | null) =>
			deleteMemoryByFolderId(userId, folderId),
		onSuccess: (_, folderId) => {
			// Remove from by-folder cache
			queryClient.removeQueries({
				queryKey: memoryKeys.byFolder(userId, folderId),
			});

			// Invalidate lists and stats
			queryClient.invalidateQueries({ queryKey: memoryKeys.lists(userId) });
			queryClient.invalidateQueries({ queryKey: memoryKeys.stats(userId) });

			// Invalidate folder queries
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });
		},
	});
}

/**
 * Delete all memories
 * WARNING: This deletes ALL memories!
 */
export function useDeleteAllMemories(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => deleteAllMemories(userId),
		onSuccess: () => {
			// Clear all memory queries
			queryClient.removeQueries({ queryKey: memoryKeys.all(userId) });

			// Invalidate folder queries
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });
		},
	});
}
