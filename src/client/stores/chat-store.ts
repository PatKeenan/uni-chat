import { useMemo } from "react";
import { create } from "zustand";
import type { Model, ModelCapabilities, ModelName } from "@/types";

/**
 * Extract capabilities from OpenRouter model metadata
 */
export function extractModelCapabilities(
  model: Model | null
): ModelCapabilities {
  if (!model) {
    return {
      supportsToolCalls: false,
      supportsImageOutput: false,
      supportsTextOutput: true,
      supportsEmbeddings: false,
      inputModalities: ["text"],
      outputModalities: ["text"],
    };
  }

  const outputModalities = model.architecture?.outputModalities || ["text"];
  const inputModalities = model.architecture?.inputModalities || ["text"];

  // Check if model supports tool calls via supportedParameters
  // Common parameter names for tool support: "tools", "tool_choice", "functions"
  const toolParams = ["tools", "tool_choice", "functions"];
  const supportsToolCalls =
    model.supportedParameters?.some((param) =>
      toolParams.includes(param?.toLowerCase() || "")
    ) ?? false;

  return {
    supportsToolCalls,
    supportsImageOutput: outputModalities.includes("image"),
    supportsTextOutput: outputModalities.includes("text"),
    supportsEmbeddings: outputModalities.includes("embeddings"),
    inputModalities: inputModalities as ModelCapabilities["inputModalities"],
    outputModalities: outputModalities as ModelCapabilities["outputModalities"],
  };
}

interface ChatStoreState {
  input: string;
  model?: ModelName;
  modelMetadata: Model | null;
  isLoadingInitialMessages: boolean;
}

interface ChatStoreActions {
  setInput: (input: string) => void;
  setModel: (modelId: ModelName, metadata?: Model | null) => void;
  setIsLoadingInitialMessages: (isLoadingInitialMessages: boolean) => void;
}

export const useChatStore = create<ChatStoreState & ChatStoreActions>(
  (set) => ({
    input: "",
    isLoadingInitialMessages: true,
    modelMetadata: null,
    setInput: (input) => set({ input }),
    setModel: (model, metadata = null) => set({ model, modelMetadata: metadata }),
    setIsLoadingInitialMessages: (isLoadingInitialMessages) =>
      set({ isLoadingInitialMessages }),
  })
);

/**
 * Hook to get model capabilities derived from store's modelMetadata.
 * Computes capabilities on-demand rather than storing derived state.
 * Uses useMemo to prevent infinite re-renders from new object references.
 */
export function useModelCapabilities(): ModelCapabilities {
  const modelMetadata = useChatStore((state) => state.modelMetadata);
  return useMemo(
    () => extractModelCapabilities(modelMetadata),
    [modelMetadata]
  );
}
