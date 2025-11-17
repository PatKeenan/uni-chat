import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { updateChatModel } from "@/lib/server/actions/chat-actions";
import type { ChatMessage } from "@/lib/server/actions/message-actions";

export interface UseChatStreamProps {
  initialMessages?: ChatMessage[];
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

  const {
    messages,
    status,
    error,
    setMessages,
    sendMessage,
    regenerate,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        chatId,
        modelId: initialModel,
      },
    }),
    id: chatId,
    messages: initialMessages,
    onError: (error) => {
      console.error("Chat error:", error);
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
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Send message using AI SDK v3 sendMessage
    await sendMessage({ text: input });

    // Clear input after sending
    setInput("");
  };

  /**
   * Switch to a different model
   */
  const switchModel = async (newModelId: string) => {
    try {
      await updateChatModel({
        data: { chatId, modelId: newModelId },
      });
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
