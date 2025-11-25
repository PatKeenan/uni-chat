import { ArrowDown, Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/chat-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CustomUIMessage } from "@/lib/client/types";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessage } from "./chat-message";

interface ChatMessageListProps {
	messages: CustomUIMessage[];
	isLoading?: boolean;
	onSuggestionClick?: (text: string) => void;
}

function ChatMessageListComponent({
	messages,
	isLoading,
	onSuggestionClick,
}: ChatMessageListProps) {
	const isLoadingInitialMessages = useChatStore(
		(state) => state.isLoadingInitialMessages,
	);
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [showScrollButton, setShowScrollButton] = useState(false);
	const isUserScrollingRef = useRef(false);
	const lastMessageCountRef = useRef(messages.length);

	// Check if the last message has only reasoning parts (no text yet)
	const lastMessage = messages[messages.length - 1];
	const lastMessageIsReasoning =
		lastMessage?.role === "assistant" &&
		lastMessage.parts.some((p) => p.type === "reasoning") &&
		!lastMessage.parts.some((p) => p.type === "text" && "text" in p && p.text);

	// Get scroll viewport element
	const getScrollViewport = useCallback(() => {
		return scrollAreaRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]",
		) as HTMLElement | null;
	}, []);

	// Check if at bottom of scroll
	const checkIfAtBottom = useCallback((element: HTMLElement) => {
		const { scrollTop, scrollHeight, clientHeight } = element;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
		return distanceFromBottom < 50; // 50px threshold
	}, []);

	// Scroll to bottom
	const scrollToBottom = useCallback(() => {
		const scrollArea = getScrollViewport();
		if (scrollArea) {
			scrollArea.scrollTo({
				top: scrollArea.scrollHeight,
				behavior: "smooth", //smooth" : "instant" */,
			});
			setShowScrollButton(false);
			setIsAtBottom(true);
		}
	}, [getScrollViewport]);

	// Track scroll position
	useEffect(() => {
		const scrollArea = getScrollViewport();
		if (!scrollArea) return;

		const handleScroll = () => {
			const atBottom = checkIfAtBottom(scrollArea);
			setIsAtBottom(atBottom);
			setShowScrollButton(!atBottom);

			// Mark that user is actively scrolling
			isUserScrollingRef.current = true;

			// Reset after a short delay
			setTimeout(() => {
				isUserScrollingRef.current = false;
			}, 150);
		};

		scrollArea.addEventListener("scroll", handleScroll);
		return () => scrollArea.removeEventListener("scroll", handleScroll);
	}, [getScrollViewport, checkIfAtBottom]);

	// Auto-scroll only when at bottom or when user sends a new message
	useEffect(() => {
		const isNewUserMessage =
			messages.length > lastMessageCountRef.current &&
			lastMessage?.role === "user";

		// Always scroll when user sends a message
		if (isNewUserMessage) {
			scrollToBottom(); // Instant scroll for user message
			lastMessageCountRef.current = messages.length;
			return;
		}

		// Only auto-scroll if already at bottom and not user scrolling
		if (isAtBottom && !isUserScrollingRef.current) {
			scrollToBottom(); // Instant to prevent choppy scroll during streaming
		}

		lastMessageCountRef.current = messages.length;
	}, [messages, lastMessage, isAtBottom, scrollToBottom]);

	if (messages.length === 0 && !isLoadingInitialMessages) {
		return (
			<div className="flex h-full items-center justify-center">
				<ChatEmptyState
					onSuggestionClick={(text) => {
						if (onSuggestionClick) {
							onSuggestionClick(text);
						}
					}}
				/>
			</div>
		);
	}

	if (isLoadingInitialMessages) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center flex items-center gap-2 justify-center">
					<Loader2 className="h-8 w-8 animate-spin" />
					<p className="text-sm text-muted-foreground">Loading messages...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-full">
			<ScrollArea ref={scrollAreaRef} className="h-full">
				<div ref={scrollRef} className="flex flex-col">
					{messages.map((message) => (
						<ChatMessage key={message.id} message={message} />
					))}
					{/* Only show loading indicator if there's no assistant message streaming yet */}
					{isLoading && !lastMessageIsReasoning && (
						<div className="flex gap-3 p-4 bg-muted/50">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
								<div className="h-4 w-4 animate-pulse rounded-full bg-muted-foreground" />
							</div>
							<div className="flex-1">
								<div className="text-sm font-semibold mb-2">Assistant</div>
								<div className="flex gap-1">
									<div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
									<div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
									<div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
								</div>
							</div>
						</div>
					)}
					<div ref={bottomRef} className="min-h-[2px] mt-8" />
				</div>
			</ScrollArea>

			{/* Scroll to bottom button */}
			{showScrollButton && (
				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
					<Button
						variant="secondary"
						size="sm"
						onClick={scrollToBottom}
						className="rounded-full shadow-lg"
					>
						<ArrowDown className="h-4 w-4 mr-1" />
						Scroll to bottom
					</Button>
				</div>
			)}
		</div>
	);
}

export const ChatMessageList = memo(ChatMessageListComponent);
