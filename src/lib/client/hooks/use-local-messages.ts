/**
 * React hooks for local message management
 *
 * These hooks use TanStack Query to manage messages in local PGlite database.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import {
  deleteLocalMessage,
  deleteLocalMessages,
  getLocalMessageCount,
  getLocalMessages,
  getUIMessages,
  saveLocalMessages,
} from "@/lib/client/actions/message-actions";
import type { CustomUIMessage } from "../types";
import { chatKeys } from "./use-local-chats";

/**
 * Query keys for message operations
 */
export const messageKeys = {
  all: (chatId: string) => ["local-messages", chatId] as const,
  list: (chatId: string) => [...messageKeys.all(chatId), "list"] as const,
  uiList: (chatId: string) => [...messageKeys.all(chatId), "ui-list"] as const,
  count: (chatId: string) => [...messageKeys.all(chatId), "count"] as const,
};

/**
 * Get all messages for a chat (database format with parts)
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 */
export function useLocalMessages(chatId: string, userId: string) {
  return useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => getLocalMessages({ chatId, userId }),
    enabled: !!chatId && !!userId,
  });
}

/**
 * Get all messages for a chat (AI SDK format)
 *
 * This is the format you'll need for feeding into AI SDK's useChat hook.
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 */
export function useUIMessages(chatId: string, userId: string) {
  return useQuery({
    queryKey: messageKeys.uiList(chatId),
    queryFn: () => getUIMessages({ chatId, userId }),
    enabled: !!chatId && !!userId,
  });
}

/**
 * Get message count for a chat
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 */
export function useLocalMessageCount(chatId: string, userId: string) {
  return useQuery({
    queryKey: messageKeys.count(chatId),
    queryFn: () => getLocalMessageCount({ chatId, userId }),
    enabled: !!chatId && !!userId,
  });
}

/**
 * Save messages to local database
 *
 * Use this after receiving AI responses to persist them locally.
 */
export function useSaveLocalMessages(chatId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messages: UIMessage[]) =>
      saveLocalMessages({
        chatId,
        userId,
        messages: messages as CustomUIMessage[],
      }),
    onSuccess: () => {
      // Invalidate message queries to refetch
      queryClient.invalidateQueries({ queryKey: messageKeys.all(chatId) });

      // Update chat timestamp in cache
      queryClient.invalidateQueries({
        queryKey: chatKeys.detail(userId, chatId),
      });
    },
  });
}

/**
 * Delete all messages for a chat (clear history)
 */
export function useDeleteLocalMessages(chatId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteLocalMessages({ chatId, userId }),
    onSuccess: () => {
      // Clear message cache
      queryClient.removeQueries({ queryKey: messageKeys.all(chatId) });

      // Set empty array in cache to avoid flicker
      queryClient.setQueryData(messageKeys.list(chatId), []);
      queryClient.setQueryData(messageKeys.uiList(chatId), []);
      queryClient.setQueryData(messageKeys.count(chatId), 0);
    },
  });
}

/**
 * Delete a single message
 */
export function useDeleteLocalMessage(chatId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      deleteLocalMessage({ messageId, userId }),
    onSuccess: () => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: messageKeys.all(chatId) });
    },
  });
}

/**
 * Optimistically add a message to the cache
 *
 * Use this to show user messages immediately before they're saved.
 */
export function useOptimisticMessage(chatId: string) {
  const queryClient = useQueryClient();

  const addOptimisticMessage = (message: UIMessage) => {
    queryClient.setQueryData<UIMessage[]>(
      messageKeys.uiList(chatId),
      (old = []) => [...old, message]
    );
  };

  const removeOptimisticMessage = (messageId: string) => {
    queryClient.setQueryData<UIMessage[]>(
      messageKeys.uiList(chatId),
      (old = []) => old.filter((msg) => msg.id !== messageId)
    );
  };

  const updateOptimisticMessage = (
    messageId: string,
    updates: Partial<UIMessage>
  ) => {
    queryClient.setQueryData<UIMessage[]>(
      messageKeys.uiList(chatId),
      (old = []) =>
        old.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  };

  return {
    addOptimisticMessage,
    removeOptimisticMessage,
    updateOptimisticMessage,
  };
}
