import { useChat } from "@ai-sdk/react";
import { useRef } from "react";
import { useChatStore } from "@/client/stores/chat-store";
import { updateLocalChatTitle } from "@/client/actions/chat-actions";
import { saveLocalMessages } from "@/client/actions/message-actions";
import { useSession } from "@/client/auth";
import { getApiKey, getTavilyApiKey } from "@/client/storage/api-key";
import type { Model } from "@/types/models";
import { generateChatTitle } from "@/client/utils/generate-chat-title";
import type { CustomUIMessage, DB_Message } from "@/types/models";
import { toUiMessages } from "@/client/utils/to-ui-message";

export interface UseChatStreamProps {
  initialModel?: string;
  chatId: string;
  userId: string;
  initialMessages?: DB_Message[];
  isLoadingInitialMessages?: boolean;
}

/**
 * Custom hook that wraps AI SDK's useChat (v3)
 * Handles streaming, model switching, and persistence
 * Note: AI SDK v3 no longer manages input state internally
 * 

 */

export function useChatStream({
  initialModel,
  chatId,
  userId,
  initialMessages,
  isLoadingInitialMessages = true,
}: UseChatStreamProps) {
  // AI SDK v3 requires manual input state management

  // Managed via Zustand now to prevent re-renders
  // const [input, setInput] = useState("");

  const currentModel = useChatStore((state) => state.model);
  const capabilities = useChatStore((state) => state.capabilities);
  const modelMetadata = useChatStore((state) => state.modelMetadata);
  const setModel = useChatStore((state) => state.setModel);

  // Track if we've generated a title for this chat
  const hasGeneratedTitle = useRef(false);

  // Create OpenRouter transport - stable instance that we update via setModelId
  // We create it once with initialModel, then update it via useEffect when currentModel changes

  const handleSetModel = (modelId: string, metadata?: Model | null) => {
    setModel(modelId, metadata);
  };

  const {
    messages,
    status,
    error,
    setMessages,
    sendMessage,
    regenerate,
    stop,
  } = useChat({
    id: chatId,
    messages: toUiMessages(initialMessages || []),
    onError: (error) => {
      console.error("Chat error:", error);
    },
    // Save messages to local PGlite after streaming completes
    onFinish: async ({ message: newMessage }) => {
      try {
        const newMessageWithModelName: CustomUIMessage = {
          ...newMessage,
          metadata: { modelName: currentModel },
        };

        // Save the new assistant message to local database
        await saveLocalMessages({
          chatId,
          userId,
          messages: [newMessageWithModelName],
        });
      } catch (error) {
        console.error("Error saving message to local DB:", error);
      }
    },
  });

  /**
   * Handle form submission
   */
  const { data: session } = useSession();
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const input = useChatStore.getState().input;

    if (!input.trim()) return;

    const userMessageText = input;

    // Clear input immediately for better UX
    useChatStore.getState().setInput("");

    // Create user message
    const userMessage: CustomUIMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: userMessageText }],
    };

    // Save user message to local database
    // const session = await getSession();
    if (session?.user?.id) {
      await saveLocalMessages({
        chatId,
        userId: session.user.id,
        messages: [userMessage],
      });

      // Generate title from first message if we haven't already
      if (!hasGeneratedTitle.current && messages.length === 0) {
        hasGeneratedTitle.current = true;
        const title = generateChatTitle(userMessageText);
        await updateLocalChatTitle(chatId, session.user.id, title);
      }
    }

    // Send message using AI SDK v3 sendMessage
    // Pass full model capabilities for server-side routing decisions
    await sendMessage(
      {
        text: userMessageText,
      },
      {
        body: {
          chatId,
          modelId: currentModel || initialModel,
          capabilities,
          modelMetadata,
          apiKey: getApiKey() || "",
          tavilyApiKey: getTavilyApiKey() || "",
        },
      }
    );
  };

  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: messages as CustomUIMessage[],
    handleSubmit,
    isLoading,
    isLoadingInitialMessages,
    error,
    setMessages,
    reload: regenerate, // AI SDK v3 renamed reload to regenerate
    stop,
    switchModel: handleSetModel,
    status, // Expose status for more granular control
    currentModel,
    capabilities,
    modelMetadata,
  };
}
