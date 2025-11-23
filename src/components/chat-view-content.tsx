import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChatHeader } from "@/components/chat-header";
import { ChatInput } from "@/components/chat-input";
import { ChatMessageList } from "@/components/chat-message-list";
import {
  deleteLocalChat,
  toggleLocalChatPin,
} from "@/lib/client/actions/chat-actions";
import { getSession } from "@/lib/client/auth-client";
import { useChatStream } from "@/lib/client/hooks/use-chat-stream";
import type { DB_Chat, DB_Message } from "@/lib/client/types";

type ChatViewContentProps = {
  chat: DB_Chat;
  userId: string;
  initialMessages: DB_Message[];
  isLoadingInitialMessages: boolean;
};

export function ChatViewContent({
  chat,
  userId,
  initialMessages,
  isLoadingInitialMessages = true,
}: ChatViewContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The messages from the loader are already in AI SDK UIMessage format
  const { messages, handleSubmit, isLoading } = useChatStream({
    initialModel: chat.selectedModel,
    chatId: chat.id,
    userId,
    initialMessages: initialMessages || [],
    isLoadingInitialMessages,
  });

  /*  const handleModelChange = async (modelId: string) => {
      //setSelectedModel(modelId);
      await switchModel(modelId);
    }; */

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
        await deleteLocalChat(chat.id, session.data.user.id);

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

    await toggleLocalChatPin(chat.id, session.data.user.id, !chat.pinned);
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
        chatId={chat.id}
        title={chat.title || "New Chat"}
        folderName={chat.folderId ? chat.folderId : undefined}
        folderId={chat.folderId}
        isPinned={chat.pinned}
        onDelete={handleDelete}
        onRename={handleRename}
        onMoveToFolder={handleMoveToFolder}
        onTogglePin={handleTogglePin}
      />

      <div className="flex-1 overflow-hidden">
        <ChatMessageList
          messages={messages}
          isLoading={isLoading || isLoadingInitialMessages}
        />
      </div>

      <ChatInput
        onSubmit={handleSubmit}
        isLoading={isLoading || isLoadingInitialMessages}
      />
    </div>
  );
}
