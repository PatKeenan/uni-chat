import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";

interface ChatMessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Auto-scroll to bottom when new messages arrive

  // biome-ignore lint/correctness/useExhaustiveDependencies: I know the lint rule is wrong here
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Start a conversation</h2>
          <p className="text-sm text-muted-foreground">
            Send a message to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div ref={scrollRef} className="flex flex-col">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
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
  );
}
