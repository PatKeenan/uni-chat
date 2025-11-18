import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { updateLocalChatModel } from "@/lib/client/actions/chat-actions";
import { saveLocalMessages } from "@/lib/client/actions/message-actions";
import { getSession, useSession } from "@/lib/client/auth-client";
import { getApiKey } from "@/lib/client/storage/api-key";
import { OpenRouterTransport } from "@/lib/client/transports/openrouter-transport";

export interface UseChatStreamProps {
  initialMessages?: UIMessage[];
  initialModel?: string;
  chatId: string;
}

/**
 * Custom hook that wraps AI SDK's useChat (v3)
 * Handles streaming, model switching, and persistence
 * Note: AI SDK v3 no longer manages input state internally
 */
export function useChatStream({
  initialMessages = [],
  initialModel = "anthropic/claude-3.5-sonnet",
  chatId,
}: UseChatStreamProps) {
  // AI SDK v3 requires manual input state management
  const [input, setInput] = useState("");

  const [currentModel, setCurrentModel] = useState(initialModel);

  // Create OpenRouter transport with memoization
  // This transport calls OpenRouter API directly from the client (no backend needed)
  const transport = useMemo(() => {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn("No API key found - transport will fail until key is set");
      // Return a dummy transport that will error - user needs to set API key
      return new OpenRouterTransport({
        apiKey: "",
        modelId: currentModel,
        siteUrl: typeof window !== "undefined" ? window.location.origin : "",
        siteName: "UniChat",
      });
    }

    return new OpenRouterTransport({
      apiKey,
      modelId: currentModel,
      siteUrl: typeof window !== "undefined" ? window.location.origin : "",
      siteName: "UniChat",
    });
  }, [currentModel]);

  // Update transport model when it changes
  useEffect(() => {
    transport.setModelId(currentModel);
  }, [currentModel, transport]);

  const {
    messages,
    status,
    error,
    setMessages,
    sendMessage,
    regenerate,
    stop,
  } = useChat({
    // Use custom OpenRouter transport for client-side streaming
    transport,
    id: chatId,
    messages: initialMessages,
    onError: (error) => {
      console.error("Chat error:", error);
    },
    // Save messages to local PGlite after streaming completes
    onFinish: async ({ message: newMessage }) => {
      try {
        const session = await getSession();
        if (!session.data?.user?.id) {
          console.error("No user session found");
          return;
        }

        // Save the new assistant message to local database
        await saveLocalMessages(chatId, session.data.user.id, [newMessage]);
      } catch (error) {
        console.error("Error saving message to local DB:", error);
      }
    },
  });

  /**
   * Handle input change (manual state management for v3)
   */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  /**
   * Handle form submission
   */
  const { data: session } = useSession();
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim()) return;

    const userMessageText = input;

    // Clear input immediately for better UX
    setInput("");

    // Create user message
    const userMessage: UIMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: userMessageText }],
    };

    // Save user message to local database
    // const session = await getSession();
    if (session?.user?.id) {
      await saveLocalMessages(chatId, session.user.id, [userMessage]);
    }

    // Send message using AI SDK v3 sendMessage
    await sendMessage({ text: userMessageText });
  };

  /**
   * Switch to a different model
   */
  const switchModel = async (newModelId: string) => {
    try {
      // Update local state so next message uses new model
      setCurrentModel(newModelId);

      // Update chat model in local PGlite database
      const session = await getSession();
      if (session.data?.user?.id) {
        await updateLocalChatModel(chatId, session.data.user.id, newModelId);
      }
    } catch (error) {
      console.error("Failed to switch model:", error);
    }
  };

  // Map status to isLoading for backward compatibility
  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    reload: regenerate, // AI SDK v3 renamed reload to regenerate
    stop,
    switchModel,
    status, // Expose status for more granular control
  };
}
