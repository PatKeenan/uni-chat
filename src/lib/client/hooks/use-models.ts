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
} from "@/lib/client/actions/model-actions";
import { getApiKey } from "@/lib/client/storage/api-key";
import { getOpenRouterModels } from "@/lib/server/actions/model-actions";
/**
 * Hook to fetch all available OpenRouter models
 */
export function useOpenRouterModels() {
  return useQuery({
    queryKey: ["openrouter-models"],
    queryFn: async () => {
      const result = await getOpenRouterModels({
        data: { localApiKey: getApiKey() || "" },
      });
      return result;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - models don't change often
  });
}

/**
 * Hook to fetch user's starred models
 */
export function useStarredModels(userId: string) {
  return useQuery({
    queryKey: ["starred-models"],
    queryFn: async () => {
      const result = await getStarredModels({ userId: userId });
      return result;
    },
  });
}

/**
 * Hook to check if a model is starred
 */
export function useIsModelStarred(modelId: string, userId: string) {
  return useSuspenseQuery({
    queryKey: ["is-model-starred", modelId],
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
      console.log("Invalidating starred models");
      queryClient.invalidateQueries({ queryKey: ["starred-models"] });
    },
  });

  const unstarMutation = useMutation({
    mutationFn: async (modelId: string) => {
      await unstarModel({ userId, modelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["starred-models"] });
    },
  });

  return {
    star: starMutation.mutate,
    unstar: unstarMutation.mutate,
    isStarring: starMutation.isPending,
    isUnstarring: unstarMutation.isPending,
  };
}
