import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { getLocalChatById } from "@/client/actions/chat-actions";
import { getUIMessages } from "@/client/actions/message-actions";

// Note: The loader type assertion is needed due to TanStack Router's type generation
// having issues with the AI SDK's complex generic UIMessagePart types. The generated
// routeTree.gen.ts captures a different instantiation of these generic types than what
// the runtime code produces, causing "two different types with this name exist" errors.
// The runtime behavior is correct - this is purely a TypeScript compilation issue.
export const Route = createFileRoute("/dashboard/c/$chatId")({
  component: ChatView,

  loader: async ({ params, context }) => {
    const userId = context.user?.id ?? "";

    const [chat, initialMessages] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["chat", params.chatId],
        queryFn: () => getLocalChatById(params.chatId, userId),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["messages", params.chatId],
        queryFn: () => getUIMessages({ chatId: params.chatId, userId }),
      }),
    ]);

    if (!chat) {
      throw notFound();
    }

    const formattedInitialMessages = initialMessages.map((message) => ({
      ...message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any - we know this is safe because we're converting from the database type to the AI SDK type
      // biome-ignore lint/suspicious/noExplicitAny: we are going to convert it back in the Route, this has to do with Tanstack type inference issues in the loader
      parts: message.parts as any,
    }));

    return {
      chat,
      initialMessages: formattedInitialMessages,
      userId,
      chatId: params.chatId,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  },
});

import { useChatStore } from "@/client/stores/chat-store";
import { ChatViewContent } from "@/components/chat-view-content";
import { getStarredModelMetadata } from "@/client/actions/model-actions";

function ChatView() {
  // Type assertion needed due to TanStack Router type generation issues with AI SDK types
  const { chat, initialMessages, userId } = Route.useLoaderData();
  const setIsLoadingInitialMessages = useChatStore(
    (state) => state.setIsLoadingInitialMessages
  );
  const setStateModel = useChatStore((s) => s.setModel);

  // Messages are now prefetched in loader, so we're never in a loading state
  useEffect(() => {
    setIsLoadingInitialMessages(false);
  }, [setIsLoadingInitialMessages]);

  // Set the model and look up its full metadata from starred models
  useEffect(() => {
    let chatModel = chat.selectedModel;

    // Check if last message used a different model
    if (initialMessages && initialMessages.length > 0) {
      const lastMessage = initialMessages[initialMessages.length - 1];
      const messageModel = lastMessage.metadata?.modelName;

      if (messageModel && messageModel !== chatModel) {
        chatModel = messageModel;
      }
    }

    // Look up the model metadata from starred models for full capability info
    const loadModelMetadata = async () => {
      const starredModel = await getStarredModelMetadata({
        userId,
        modelId: chatModel,
      });
      // Pass the full metadata (or null if not found/not starred)
      // The chatStore will extract capabilities from metadata
      setStateModel(chatModel, starredModel?.metadata ?? null);
    };

    loadModelMetadata();
  }, [initialMessages, setStateModel, chat.selectedModel, userId]);

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
      initialMessages={initialMessages}
      isLoadingInitialMessages={false}
      userId={userId}
    />
  );
}
