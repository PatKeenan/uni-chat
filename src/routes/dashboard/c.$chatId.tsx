import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { getLocalChatById } from "@/lib/client/actions/chat-actions";
import { getUIMessages } from "@/lib/client/actions/message-actions";
import type { CustomUIMessage, DB_Chat, DB_Message } from "@/lib/client/types";

// Type for loader data - needed because TanStack Router's type generation
// has issues with the AI SDK's complex generic UIMessagePart types
interface ChatLoaderData {
	chat: DB_Chat;
	initialMessages: DB_Message[];
	userId: string;
	chatId: string;
}

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
				queryFn: () => getUIMessages(params.chatId, userId),
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

import { useChatStore } from "@/chat-store";
import { ChatViewContent } from "@/components/chat-view-content";

function ChatView() {
	// Type assertion needed due to TanStack Router type generation issues with AI SDK types
	const { chat, initialMessages, userId } = Route.useLoaderData();
	const setIsLoadingInitialMessages = useChatStore(
		(state) => state.setIsLoadingInitialMessages,
	);
	const setStateModel = useChatStore((s) => s.setModel);

	// Messages are now prefetched in loader, so we're never in a loading state
	useEffect(() => {
		setIsLoadingInitialMessages(false);
	}, [setIsLoadingInitialMessages]);

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
			initialMessages={initialMessages}
			isLoadingInitialMessages={false}
			userId={userId}
		/>
	);
}
