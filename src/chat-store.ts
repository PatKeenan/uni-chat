import { create } from "zustand";
import type { Model, ModelName } from "./lib/client/types";

/**
 * Model capabilities derived from OpenRouter model metadata
 * These are extracted from the full Model for easy access
 */
export interface ModelCapabilities {
  supportsToolCalls: boolean;
  supportsImageOutput: boolean;
  supportsTextOutput: boolean;
  supportsEmbeddings: boolean;
  inputModalities: Array<"text" | "image" | "file" | "audio" | "video">;
  outputModalities: Array<"text" | "image" | "embeddings">;
}

/**
 * Extract capabilities from OpenRouter model metadata
 */
export function extractModelCapabilities(model: Model | null): ModelCapabilities {
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
  const supportsToolCalls = model.supportedParameters?.some(
    (param) => toolParams.includes(param.name?.toLowerCase() || "")
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
  capabilities: ModelCapabilities;
  isLoadingInitialMessages: boolean;
}

interface ChatStoreActions {
  setInput: (input: string) => void;
  setModel: (modelId: ModelName, metadata?: Model | null) => void;
  setIsLoadingInitialMessages: (isLoadingInitialMessages: boolean) => void;
}

const defaultCapabilities: ModelCapabilities = {
  supportsToolCalls: false,
  supportsImageOutput: false,
  supportsTextOutput: true,
  supportsEmbeddings: false,
  inputModalities: ["text"],
  outputModalities: ["text"],
};

export const useChatStore = create<ChatStoreState & ChatStoreActions>(
  (set) => ({
    input: "",
    isLoadingInitialMessages: true,
    modelMetadata: null,
    capabilities: defaultCapabilities,
    setInput: (input) => set({ input }),
    setModel: (model, metadata = null) => {
      const capabilities = extractModelCapabilities(metadata);
      return set({ model, modelMetadata: metadata, capabilities });
    },
    setIsLoadingInitialMessages: (isLoadingInitialMessages) =>
      set({ isLoadingInitialMessages }),
  })
);
