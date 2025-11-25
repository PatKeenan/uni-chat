/**
 * Data Management Hook
 *
 * Provides React Query hooks for managing local PGlite data.
 * Includes statistics, storage usage, and cleanup operations.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDataStats,
  clearAttachments,
  clearAllMessages,
  clearAllChats,
  clearAllUserData,
  completeDataReset,
  type DataStats,
  type ClearDataResult,
} from "@/lib/client/actions/data-actions";

// ==================== Query Keys ====================

export const dataManagementKeys = {
  all: ["data-management"] as const,
  stats: (userId: string) => [...dataManagementKeys.all, "stats", userId] as const,
};

// ==================== Hooks ====================

/**
 * Hook to fetch data statistics
 *
 * Returns storage usage information including breakdown by data type.
 */
export function useDataStats(userId: string | undefined) {
  return useQuery<DataStats>({
    queryKey: dataManagementKeys.stats(userId ?? ""),
    queryFn: () => getDataStats(userId!),
    enabled: !!userId,
    // Refetch periodically to keep stats fresh
    refetchInterval: 30000,
    // Don't refetch on window focus to avoid excessive queries
    refetchOnWindowFocus: false,
    staleTime: 10000,
  });
}

/**
 * Hook to clear all attachments
 *
 * Removes file and image parts from messages while preserving text.
 */
export function useClearAttachments() {
  const queryClient = useQueryClient();

  return useMutation<ClearDataResult, Error, string>({
    mutationFn: (userId: string) => clearAttachments(userId),
    onSuccess: (result, userId) => {
      if (result.success) {
        // Invalidate data stats to reflect changes
        queryClient.invalidateQueries({
          queryKey: dataManagementKeys.stats(userId),
        });
        // Invalidate message-related queries
        queryClient.invalidateQueries({
          queryKey: ["messages"],
        });
      }
    },
  });
}

/**
 * Hook to clear all messages
 *
 * Deletes all messages but keeps chat shells.
 */
export function useClearAllMessages() {
  const queryClient = useQueryClient();

  return useMutation<ClearDataResult, Error, string>({
    mutationFn: (userId: string) => clearAllMessages(userId),
    onSuccess: (result, userId) => {
      if (result.success) {
        // Invalidate all relevant queries
        queryClient.invalidateQueries({
          queryKey: dataManagementKeys.stats(userId),
        });
        queryClient.invalidateQueries({
          queryKey: ["messages"],
        });
        queryClient.invalidateQueries({
          queryKey: ["chats"],
        });
      }
    },
  });
}

/**
 * Hook to clear all chats
 *
 * Deletes all chats and their messages.
 */
export function useClearAllChats() {
  const queryClient = useQueryClient();

  return useMutation<ClearDataResult, Error, string>({
    mutationFn: (userId: string) => clearAllChats(userId),
    onSuccess: (result, userId) => {
      if (result.success) {
        // Invalidate all relevant queries
        queryClient.invalidateQueries({
          queryKey: dataManagementKeys.stats(userId),
        });
        queryClient.invalidateQueries({
          queryKey: ["messages"],
        });
        queryClient.invalidateQueries({
          queryKey: ["chats"],
        });
        queryClient.invalidateQueries({
          queryKey: ["folders"],
        });
      }
    },
  });
}

/**
 * Hook to clear all user data
 *
 * Removes everything: chats, messages, folders, starred models.
 */
export function useClearAllUserData() {
  const queryClient = useQueryClient();

  return useMutation<ClearDataResult, Error, string>({
    mutationFn: (userId: string) => clearAllUserData(userId),
    onSuccess: (result, userId) => {
      if (result.success) {
        // Invalidate everything
        queryClient.invalidateQueries({
          queryKey: dataManagementKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: ["messages"],
        });
        queryClient.invalidateQueries({
          queryKey: ["chats"],
        });
        queryClient.invalidateQueries({
          queryKey: ["folders"],
        });
        queryClient.invalidateQueries({
          queryKey: ["starred-models"],
        });
      }
    },
  });
}

/**
 * Hook to completely reset the database
 *
 * Wipes the entire IndexedDB database. Use with extreme caution!
 */
export function useCompleteDataReset() {
  const queryClient = useQueryClient();

  return useMutation<ClearDataResult, Error, void>({
    mutationFn: () => completeDataReset(),
    onSuccess: (result) => {
      if (result.success) {
        // Clear all queries since DB is gone
        queryClient.clear();
      }
    },
  });
}

