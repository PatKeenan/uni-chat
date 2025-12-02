/**
 * React hooks for local folder management
 *
 * These hooks use TanStack Query to manage folders in local PGlite database.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createLocalFolder,
	deleteAllLocalFolders,
	deleteLocalFolder,
	folderNameExists,
	getLocalFolderById,
	getLocalFolderByName,
	getLocalFolders,
	getLocalFoldersWithCounts,
	updateLocalFolder,
	updateLocalFolderColor,
	updateLocalFolderName,
} from "@/client/actions/folder-actions";
import type { folder } from "@/client/db/schema";
import { chatKeys } from "./use-local-chats";

/**
 * Query keys for folder operations
 */
export const folderKeys = {
	all: (userId: string) => ["local-folders", userId] as const,
	lists: (userId: string) => [...folderKeys.all(userId), "list"] as const,
	list: (userId: string) => [...folderKeys.lists(userId)] as const,
	listWithCounts: (userId: string) =>
		[...folderKeys.lists(userId), "with-counts"] as const,
	details: (userId: string) => [...folderKeys.all(userId), "detail"] as const,
	detail: (userId: string, folderId: string) =>
		[...folderKeys.details(userId), folderId] as const,
};

/**
 * Get all folders for a user
 *
 * @param userId - User ID
 */
export function useLocalFolders(userId: string) {
	return useQuery({
		queryKey: folderKeys.list(userId),
		queryFn: () => getLocalFolders(userId),
		enabled: !!userId,
	});
}

/**
 * Get all folders with chat counts
 *
 * @param userId - User ID
 */
export function useLocalFoldersWithCounts(userId: string) {
	return useQuery({
		queryKey: folderKeys.listWithCounts(userId),
		queryFn: () => getLocalFoldersWithCounts(userId),
		enabled: !!userId,
	});
}

/**
 * Get a single folder by ID
 *
 * @param folderId - Folder ID
 * @param userId - User ID
 */
export function useLocalFolder(folderId: string, userId: string) {
	return useQuery({
		queryKey: folderKeys.detail(userId, folderId),
		queryFn: () => getLocalFolderById(folderId, userId),
		enabled: !!userId && !!folderId,
	});
}

/**
 * Get folder by name
 *
 * @param userId - User ID
 * @param name - Folder name
 */
export function useLocalFolderByName(userId: string, name: string) {
	return useQuery({
		queryKey: [...folderKeys.all(userId), "by-name", name],
		queryFn: () => getLocalFolderByName(userId, name),
		enabled: !!userId && !!name,
	});
}

/**
 * Check if folder name exists
 *
 * @param userId - User ID
 * @param name - Folder name
 * @param excludeFolderId - Optional folder ID to exclude
 */
export function useFolderNameExists(
	userId: string,
	name: string,
	excludeFolderId?: string,
) {
	return useQuery({
		queryKey: [...folderKeys.all(userId), "name-exists", name, excludeFolderId],
		queryFn: () => folderNameExists(userId, name, excludeFolderId),
		enabled: !!userId && !!name,
	});
}

/**
 * Create a new folder
 */
export function useCreateLocalFolder(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { name: string; color?: string | null }) =>
			createLocalFolder({
				userId,
				...data,
			}),
		onSuccess: (newFolder) => {
			// Invalidate folder lists
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });

			// Add to detail cache
			queryClient.setQueryData(
				folderKeys.detail(userId, newFolder.id),
				newFolder,
			);
		},
	});
}

/**
 * Update a folder
 */
export function useUpdateLocalFolder(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			folderId,
			data,
		}: {
			folderId: string;
			data: Partial<{
				name: string;
				color: string | null;
			}>;
		}) => updateLocalFolder(folderId, userId, data),
		onMutate: async ({ folderId, data }) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({
				queryKey: folderKeys.detail(userId, folderId),
			});

			// Snapshot previous value
			const previousFolder = queryClient.getQueryData<
				typeof folder.$inferSelect
			>(folderKeys.detail(userId, folderId));

			// Optimistically update
			if (previousFolder) {
				queryClient.setQueryData(folderKeys.detail(userId, folderId), {
					...previousFolder,
					...data,
					updatedAt: new Date(),
				});
			}

			return { previousFolder };
		},
		onError: (_err, { folderId }, context) => {
			// Rollback on error
			if (context?.previousFolder) {
				queryClient.setQueryData(
					folderKeys.detail(userId, folderId),
					context.previousFolder,
				);
			}
		},
		onSettled: (_data, _error, { folderId }) => {
			// Refetch to ensure consistency
			queryClient.invalidateQueries({
				queryKey: folderKeys.detail(userId, folderId),
			});
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });
		},
	});
}

/**
 * Update folder name
 */
export function useUpdateLocalFolderName(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
			updateLocalFolderName(folderId, userId, name),
		onSuccess: (_, { folderId }) => {
			queryClient.invalidateQueries({
				queryKey: folderKeys.detail(userId, folderId),
			});
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });
		},
	});
}

/**
 * Update folder color
 */
export function useUpdateLocalFolderColor(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			folderId,
			color,
		}: {
			folderId: string;
			color: string | null;
		}) => updateLocalFolderColor(folderId, userId, color),
		onSuccess: (_, { folderId }) => {
			queryClient.invalidateQueries({
				queryKey: folderKeys.detail(userId, folderId),
			});
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });
		},
	});
}

/**
 * Delete a folder
 */
export function useDeleteLocalFolder(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (folderId: string) => deleteLocalFolder(folderId, userId),
		onSuccess: (_, folderId) => {
			// Remove from cache
			queryClient.removeQueries({
				queryKey: folderKeys.detail(userId, folderId),
			});

			// Invalidate lists
			queryClient.invalidateQueries({ queryKey: folderKeys.lists(userId) });

			// Invalidate chat lists since chats moved to uncategorized
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}

/**
 * Delete all folders
 * WARNING: This deletes ALL folders!
 */
export function useDeleteAllLocalFolders(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => deleteAllLocalFolders(userId),
		onSuccess: () => {
			// Clear all folder queries
			queryClient.removeQueries({ queryKey: folderKeys.all(userId) });

			// Invalidate chat lists since all chats moved to uncategorized
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}
