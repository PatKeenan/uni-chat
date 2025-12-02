/**
 * React hooks for local chat management
 *
 * These hooks use TanStack Query to provide optimistic updates,
 * caching, and automatic refetching for local PGlite database operations.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createLocalChat,
	deleteAllLocalChats,
	deleteLocalChat,
	getLocalChatById,
	getLocalChats,
	getMostRecentLocalChat,
	moveLocalChatToFolder,
	toggleLocalChatPin,
	updateLocalChat,
	updateLocalChatModel,
	updateLocalChatTitle,
} from "@/client/actions/chat-actions";
import type { chat } from "@/client/db/schema";

/**
 * Query keys for chat operations
 */
export const chatKeys = {
	all: (userId: string) => ["local-chats", userId] as const,
	lists: (userId: string) => [...chatKeys.all(userId), "list"] as const,
	list: (
		userId: string,
		filters?: { folderId?: string | null; pinnedOnly?: boolean },
	) => [...chatKeys.lists(userId), filters] as const,
	details: (userId: string) => [...chatKeys.all(userId), "detail"] as const,
	detail: (userId: string, chatId: string) =>
		[...chatKeys.details(userId), chatId] as const,
};

/**
 * Get all chats for a user
 *
 * @param userId - User ID
 * @param options - Optional filters
 */
export function useLocalChats(
	userId: string,
	options?: {
		folderId?: string | null;
		pinnedOnly?: boolean;
	},
) {
	return useQuery({
		queryKey: chatKeys.list(userId, options),
		queryFn: () => getLocalChats(userId, options),
		enabled: !!userId,
	});
}

/**
 * Get a single chat by ID
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 */
export function useLocalChat(chatId: string, userId: string) {
	return useQuery({
		queryKey: chatKeys.detail(userId, chatId),
		queryFn: () => getLocalChatById(chatId, userId),
		enabled: !!userId && !!chatId,
	});
}

/**
 * Get the most recent chat for a user
 *
 * @param userId - User ID
 */
export function useMostRecentLocalChat(userId: string) {
	return useQuery({
		queryKey: [...chatKeys.all(userId), "most-recent"],
		queryFn: () => getMostRecentLocalChat(userId),
		enabled: !!userId,
	});
}

/**
 * Create a new chat
 *
 * Optimistically updates the cache with the new chat.
 */
export function useCreateLocalChat(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: {
			title?: string;
			selectedModel: string;
			folderId?: string | null;
		}) =>
			createLocalChat({
				userId,
				...data,
			}),
		onSuccess: (newChat) => {
			// Invalidate all chat lists to refetch
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });

			// Add to detail cache
			queryClient.setQueryData(chatKeys.detail(userId, newChat.id), newChat);
		},
	});
}

/**
 * Update a chat
 *
 * Optimistically updates the cache.
 */
export function useUpdateLocalChat(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			chatId,
			data,
		}: {
			chatId: string;
			data: Partial<{
				title: string | null;
				selectedModel: string;
				folderId: string | null;
				pinned: boolean;
			}>;
		}) => updateLocalChat(chatId, userId, data),
		onMutate: async ({ chatId, data }) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({
				queryKey: chatKeys.detail(userId, chatId),
			});

			// Snapshot previous value
			const previousChat = queryClient.getQueryData<typeof chat.$inferSelect>(
				chatKeys.detail(userId, chatId),
			);

			// Optimistically update
			if (previousChat) {
				queryClient.setQueryData(chatKeys.detail(userId, chatId), {
					...previousChat,
					...data,
					updatedAt: new Date(),
				});
			}

			return { previousChat };
		},
		onError: (_err, { chatId }, context) => {
			// Rollback on error
			if (context?.previousChat) {
				queryClient.setQueryData(
					chatKeys.detail(userId, chatId),
					context.previousChat,
				);
			}
		},
		onSettled: (_data, _error, { chatId }) => {
			// Refetch to ensure consistency
			queryClient.invalidateQueries({
				queryKey: chatKeys.detail(userId, chatId),
			});
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}

/**
 * Update chat title
 */
export function useUpdateLocalChatTitle(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ chatId, title }: { chatId: string; title: string }) =>
			updateLocalChatTitle(chatId, userId, title),
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({
				queryKey: chatKeys.detail(userId, chatId),
			});
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}

/**
 * Update chat model
 */
export function useUpdateLocalChatModel(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ chatId, modelId }: { chatId: string; modelId: string }) =>
			updateLocalChatModel(chatId, userId, modelId),
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({
				queryKey: chatKeys.detail(userId, chatId),
			});
		},
	});
}

/**
 * Move chat to folder
 */
export function useMoveLocalChatToFolder(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			chatId,
			folderId,
		}: {
			chatId: string;
			folderId: string | null;
		}) => moveLocalChatToFolder(chatId, userId, folderId),
		onSuccess: () => {
			// Invalidate all lists since folder filter affects results
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}

/**
 * Toggle chat pin status
 */
export function useToggleLocalChatPin(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ chatId, pinned }: { chatId: string; pinned: boolean }) =>
			toggleLocalChatPin(chatId, userId, pinned),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}

/**
 * Delete a chat
 */
export function useDeleteLocalChat(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (chatId: string) => deleteLocalChat(chatId, userId),
		onSuccess: (_, chatId) => {
			// Remove from cache
			queryClient.removeQueries({ queryKey: chatKeys.detail(userId, chatId) });

			// Invalidate lists
			queryClient.invalidateQueries({ queryKey: chatKeys.lists(userId) });
		},
	});
}

/**
 * Delete all chats
 * WARNING: This deletes ALL chats!
 */
export function useDeleteAllLocalChats(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => deleteAllLocalChats(userId),
		onSuccess: () => {
			// Clear all chat queries
			queryClient.removeQueries({ queryKey: chatKeys.all(userId) });
		},
	});
}
