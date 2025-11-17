import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMostRecentChat } from "@/lib/server/actions/chat-actions";

/**
 * Dashboard Index Route
 * Redirects to the most recent chat, or shows empty state if no chats exist
 */
export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    // Try to get the most recent chat
    const recentChat = await getMostRecentChat();

    if (recentChat) {
      // Redirect to the most recent chat
      throw redirect({
        to: `/dashboard/c/$chatId`,
        params: { chatId: recentChat.id },
      });
    }

    // No chats exist, show empty state
    return { hasChats: false };
  },
  component: DashboardIndex,
});

function DashboardIndex() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Welcome to Uni-Chat</h2>
        <p className="text-muted-foreground mb-6">
          Start a conversation with any AI model
        </p>
        <button
          type="button"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          New Chat
        </button>
      </div>
    </div>
  );
}
