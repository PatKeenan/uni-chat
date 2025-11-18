import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  getOpenRouterModels,
  getStarredModels,
  isModelStarred,
  starModel,
  unstarModel,
} from "@/lib/server/actions/model-actions";

/**
 * Hook to fetch all available OpenRouter models
 */
export function useOpenRouterModels() {
  return useQuery({
    queryKey: ["openrouter-models"],
    queryFn: async () => {
      const result = await getOpenRouterModels();
      return result;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - models don't change often
  });
}

/**
 * Hook to fetch user's starred models
 */
export function useStarredModels() {
  return useQuery({
    queryKey: ["starred-models"],
    queryFn: async () => {
      const result = await getStarredModels();
      return result;
    },
  });
}

/**
 * Hook to check if a model is starred
 */
export function useIsModelStarred(modelId: string) {
  return useSuspenseQuery({
    queryKey: ["is-model-starred", modelId],
    queryFn: async () => {
      const result = await isModelStarred({ data: { modelId } });
      return result;
    },
  });
}

/**
 * Hook to star/unstar models
 */
export function useToggleModelStar() {
  const queryClient = useQueryClient();

  const starMutation = useMutation({
    mutationFn: async (modelData: {
      modelId: string;
      modelName: string;
      provider: string;
      contextLength?: number;
      pricingPrompt?: number;
      pricingCompletion?: number;
    }) => {
      await starModel({ data: modelData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["starred-models"] });
    },
  });

  const unstarMutation = useMutation({
    mutationFn: async (modelId: string) => {
      await unstarModel({ data: { modelId } });
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
