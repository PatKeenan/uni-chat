import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import {
  deleteLocalChat,
  getLocalChatById,
  toggleLocalChatPin,
} from "@/lib/client/actions/chat-actions";
import { getUIMessages } from "@/lib/client/actions/message-actions";
import { getSession, useSession } from "@/lib/client/auth-client";
import { useChatStream } from "@/lib/client/hooks/use-chat-stream";
import { ChatHeader } from "./-components/chat-header";
import { ChatInput } from "./-components/chat-input";
import { ChatMessageList } from "./-components/chat-message-list";

/* const initChat = createClientOnlyFn(async ({ params, userId }) => {
  const chat = await getLocalChatById(params.chatId, userId);
  if (!chat) {
    throw redirect({ to: "/dashboard" });
  }
  const messages = await getUIMessages(chat?.id, userId);
  return {
    chat,
    messages,
  };
}); */

export const Route = createFileRoute("/dashboard/c/$chatId")({
  component: ChatView,

  loader: async ({ params, context }) => {
    const chat = await context.queryClient.ensureQueryData({
      queryKey: ["chat", params.chatId],
      queryFn: () => getLocalChatById(params.chatId, context.user?.id ?? ""),
    });

    if (!chat) {
      throw notFound();
    }

    const messages = await context.queryClient.ensureQueryData({
      queryKey: ["messages", params.chatId],
      queryFn: () => getUIMessages(params.chatId, context.user?.id ?? ""),
    });
    return { chat, messages, userId: context.user?.id ?? "" };
  },
});

function ChatView() {
  const { chat, messages, userId } = Route.useLoaderData();

  if (!chat || !chat.selectedModel) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  return (
    <ChatViewContent
      chat={chat}
      messages={messages}
      selectedModel={chat.selectedModel}
      chatId={chat.id}
      userId={userId}
    />
  );
}

type ChatViewContentProps = {
  chat: {
    id: string;
    title: string | null;
    selectedModel: string;
    pinned: boolean;
    folderId: string | null;
  };
  messages: UIMessage[];
  selectedModel: string;
  chatId: string;
  userId: string;
};
function ChatViewContent({
  chat,
  messages: initialMessages,
  selectedModel: initialSelectedModel,
  chatId,
  userId,
}: ChatViewContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState(initialSelectedModel);

  // The messages from the loader are already in AI SDK UIMessage format
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    switchModel,
  } = useChatStream({
    initialMessages,
    initialModel: selectedModel,
    chatId,
    userId,
  });

  console.log(messages);
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    await switchModel(modelId);
  };

  const handleDelete = async () => {
    const confirmMessage =
      "Are you sure you want to delete this chat?\n\n" +
      "This will permanently delete:\n" +
      "• The chat conversation\n" +
      "• All messages in this chat\n" +
      "• All message content and attachments\n\n" +
      "This action cannot be undone.";

    if (confirm(confirmMessage)) {
      try {
        // Get current user session
        const session = await getSession();
        if (!session.data?.user?.id) return;

        // Delete chat (cascade deletes messages and message parts)
        await deleteLocalChat(chatId, session.data.user.id);

        // Invalidate queries to update sidebar
        queryClient.invalidateQueries({ queryKey: ["local-chats"] });

        // Navigate back to dashboard
        navigate({ to: "/dashboard" });
      } catch (error) {
        console.error("Failed to delete chat:", error);
        alert("Failed to delete chat. Please try again.");
      }
    }
  };

  const handleTogglePin = async () => {
    // Get current user session
    const session = await getSession();
    if (!session.data?.user?.id) return;

    await toggleLocalChatPin(chatId, session.data.user.id, !chat.pinned);
  };

  const handleRename = () => {
    // TODO: Implement rename dialog
    console.log("Rename not implemented yet");
  };

  const handleMoveToFolder = () => {
    // TODO: Implement move to folder dialog
    console.log("Move to folder not implemented yet");
  };

  return (
    <div className="flex h-full flex-col grow">
      <ChatHeader
        chatId={chatId}
        title={chat.title || ""}
        folderName={chat.folderId ? chat.folderId : undefined}
        folderId={chat.folderId}
        isPinned={chat.pinned}
        onDelete={handleDelete}
        onRename={handleRename}
        onMoveToFolder={handleMoveToFolder}
        onTogglePin={handleTogglePin}
      />

      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages} isLoading={isLoading} />
      </div>

      <ChatInput
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
