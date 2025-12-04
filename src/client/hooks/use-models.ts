import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  getStarredModels,
  isModelStarred,
  type StarModelInput,
  starModel,
  unstarModel,
} from "@/client/actions/model-actions";
import { getApiKey } from "@/client/storage/api-key";
import { getOpenRouterModels } from "@/server/actions/model-actions";

/**
 * Query keys for model operations
 * Note: openrouter-models is global (not user-specific) since the model catalog
 * is the same for all users. User-specific starred models include userId.
 */
export const modelKeys = {
  // Global model list (same for all users)
  openrouter: () => ["openrouter-models"] as const,
  // User-specific starred models
  starred: (userId: string) => ["starred-models", userId] as const,
  isStarred: (userId: string, modelId: string) =>
    ["is-model-starred", userId, modelId] as const,
};

/**
 * Hook to fetch all available OpenRouter models
 * Note: This fetches the global OpenRouter model catalog, not user-specific data.
 * The API key is used for authentication but returns the same models for all users.
 */
export function useOpenRouterModels() {
  const apiKey = getApiKey();

  return useQuery({
    queryKey: modelKeys.openrouter(),
    queryFn: async () => {
      const result = await getOpenRouterModels({
        data: { localApiKey: apiKey || "" },
      });
      return result;
    },
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 60, // 1 hour - models don't change often
  });
}

/**
 * Hook to fetch user's starred models
 */
export function useStarredModels(userId: string) {
  return useQuery({
    queryKey: modelKeys.starred(userId),
    queryFn: async () => {
      const result = await getStarredModels({ userId });
      return result;
    },
    enabled: !!userId,
  });
}

/**
 * Hook to check if a model is starred
 */
export function useIsModelStarred(modelId: string, userId: string) {
  return useSuspenseQuery({
    queryKey: modelKeys.isStarred(userId, modelId),
    queryFn: async () => {
      const result = await isModelStarred({ userId, modelId });
      return result;
    },
  });
}

/**
 * Hook to star/unstar models
 */
export function useToggleModelStar(userId: string) {
  const queryClient = useQueryClient();

  const starMutation = useMutation({
    mutationFn: async (modelData: Omit<StarModelInput, "userId">) => {
      // Inject userId from hook parameter
      return await starModel({ ...modelData, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelKeys.starred(userId) });
    },
  });

  const unstarMutation = useMutation({
    mutationFn: async (modelId: string) => {
      await unstarModel({ userId, modelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelKeys.starred(userId) });
    },
  });

  return {
    star: starMutation.mutate,
    unstar: unstarMutation.mutate,
    isStarring: starMutation.isPending,
    isUnstarring: unstarMutation.isPending,
  };
}
