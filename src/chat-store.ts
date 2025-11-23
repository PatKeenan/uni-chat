import { create } from "zustand";
import type { ModelName } from "./lib/client/types";

interface ChatStoreState {
  input: string;
  model?: ModelName;
  isLoadingInitialMessages: boolean;

  // We can keep messages here if we want to fully move state,
  // but for now let's focus on input optimization as requested first.
  // messages: CustomUIMessage[];
}

interface ChatStoreActions {
  setInput: (input: string) => void;
  setModel: (model: ModelName) => void;
  setIsLoadingInitialMessages: (isLoadingInitialMessages: boolean) => void;
}

export const useChatStore = create<ChatStoreState & ChatStoreActions>(
  (set) => ({
    input: "",
    isLoadingInitialMessages: true,
    setInput: (input) => set({ input }),
    setModel: (model) => {
      console.log({ MODEL_BEING_SET: model });

      return set({ model });
    },
    setIsLoadingInitialMessages: (isLoadingInitialMessages) =>
      set({ isLoadingInitialMessages }),
  })
);
