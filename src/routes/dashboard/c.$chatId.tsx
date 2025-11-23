import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { getLocalChatById } from "@/lib/client/actions/chat-actions";
import { getUIMessages } from "@/lib/client/actions/message-actions";

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

    return { chat, userId: context.user?.id ?? "", chatId: params.chatId };
  },
});

import { useChatStore } from "@/chat-store";
import { ChatViewContent } from "@/components/chat-view-content";

function ChatView() {
  const { chat, userId } = Route.useLoaderData();
  const setIsLoadingInitialMessages = useChatStore(
    (state) => state.setIsLoadingInitialMessages
  );
  const setStateModel = useChatStore((s) => s.setModel);

  const { data: initialMessages, isLoading: isLoadingInitialMessagesQuery } =
    useQuery({
      queryKey: ["messages", chat.id],
      queryFn: () => getUIMessages(chat.id, userId),
    });

  useEffect(() => {
    setIsLoadingInitialMessages(isLoadingInitialMessagesQuery);
  }, [isLoadingInitialMessagesQuery, setIsLoadingInitialMessages]);

  useEffect(() => {
    let chatModel = chat.selectedModel;

    if (initialMessages && initialMessages.length > 0) {
      const lastMessage = initialMessages[initialMessages.length - 1];
      const messageModel = lastMessage.metadata?.modelName;

      if (messageModel && messageModel !== chatModel) {
        chatModel = messageModel;
      }
    }
    setStateModel(chatModel);
  }, [initialMessages, setStateModel, chat.selectedModel]);

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
      initialMessages={initialMessages || []}
      isLoadingInitialMessages={isLoadingInitialMessagesQuery}
      userId={userId}
    />
  );
}
