import type { UIMessage } from "ai";
import { Bot, User } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/server/actions/message-actions";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3 p-4", isUser ? "bg-background" : "bg-muted/50")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {isUser ? "You" : "Assistant"}
          </span>
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div className="whitespace-pre-wrap">
            {message.parts
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("")}
          </div>
        </div>
      </div>
    </div>
  );
}
