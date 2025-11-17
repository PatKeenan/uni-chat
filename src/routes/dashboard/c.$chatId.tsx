import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useChatStream } from "@/lib/client/hooks/use-chat-stream";
import { hasApiKey } from "@/lib/server/actions/api-key-actions";
import {
  deleteChat,
  getChatById,
  togglePinChat,
} from "@/lib/server/actions/chat-actions";
import { getMessagesByChatId } from "@/lib/server/actions/message-actions";
import { ChatHeader } from "./-components/chat-header";
import { ChatInput } from "./-components/chat-input";
import { ChatMessageList } from "./-components/chat-message-list";

export const Route = createFileRoute("/dashboard/c/$chatId")({
  loader: async ({ params }) => {
    // Check if user has API key
    const hasKey = await hasApiKey();
    if (!hasKey) {
      throw redirect({ to: "/dashboard/settings" });
    }

    // Get chat data
    const chat = await getChatById({
      data: { chatId: params.chatId },
    });

    if (!chat) {
      throw redirect({ to: "/dashboard" });
    }

    // Get messages
    const messages = await getMessagesByChatId({
      data: { chatId: params.chatId },
    });

    return {
      chat,
      messages,
    };
  },
  component: ChatView,
});

function ChatView() {
  const navigate = useNavigate();
  const { chat, messages: initialMessages } = Route.useLoaderData();
  const { chatId } = Route.useParams();
  const [selectedModel, setSelectedModel] = useState(chat.selectedModel);

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
    initialModel: chat.selectedModel,
    chatId,
  });

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    await switchModel(modelId);
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this chat?")) {
      await deleteChat({ data: { chatId } });
      navigate({ to: "/dashboard" });
    }
  };

  const handleTogglePin = async () => {
    await togglePinChat({ data: { chatId, pinned: !chat.pinned } });
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
    <div className="flex h-full flex-col">
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
