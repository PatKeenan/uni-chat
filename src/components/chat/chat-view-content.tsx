import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "@/client/stores/chat-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteLocalChat,
  moveLocalChatToFolder,
  toggleLocalChatPin,
  updateLocalChatTitle,
} from "@/client/actions/chat-actions";
import { getSession } from "@/client/auth";
import { useChatStream } from "@/client/hooks/use-chat-stream";
import {
  useCreateLocalFolder,
  useLocalFolders,
} from "@/client/hooks/use-local-folders";
import type { DB_Chat, DB_Message } from "@/types/models";

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
  const setInput = useChatStore((state) => state.setInput);

  // Dialog states
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState(chat.title || "");
  const [newFolderName, setNewFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Folder data
  const { data: folders = [] } = useLocalFolders(userId);
  const createFolder = useCreateLocalFolder(userId);

  // The messages from the loader are already in AI SDK UIMessage format
  const { messages, handleSubmit, isLoading } = useChatStream({
    initialModel: chat.selectedModel,
    chatId: chat.id,
    userId,
    initialMessages: initialMessages || [],
    isLoadingInitialMessages,
  });

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
    queryClient.invalidateQueries({ queryKey: ["local-chats"] });
  };

  const handleRename = () => {
    setNewChatTitle(chat.title || "");
    setIsRenameOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!newChatTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const session = await getSession();
      if (!session.data?.user?.id) return;

      await updateLocalChatTitle(
        chat.id,
        session.data.user.id,
        newChatTitle.trim()
      );
      queryClient.invalidateQueries({ queryKey: ["local-chats"] });
      queryClient.invalidateQueries({ queryKey: ["local-chat", chat.id] });
      setIsRenameOpen(false);
    } catch (error) {
      console.error("Failed to rename chat:", error);
      alert("Failed to rename chat. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveToFolder = () => {
    setIsMoveToFolderOpen(true);
  };

  const handleSelectFolder = async (folderId: string | null) => {
    setIsSubmitting(true);
    try {
      const session = await getSession();
      if (!session.data?.user?.id) return;

      await moveLocalChatToFolder(chat.id, session.data.user.id, folderId);
      queryClient.invalidateQueries({ queryKey: ["local-chats"] });
      queryClient.invalidateQueries({ queryKey: ["local-chat", chat.id] });
      setIsMoveToFolderOpen(false);
    } catch (error) {
      console.error("Failed to move chat:", error);
      alert("Failed to move chat to folder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFolderAndMove = async () => {
    if (!newFolderName.trim()) return;

    setIsSubmitting(true);
    try {
      const session = await getSession();
      if (!session.data?.user?.id) return;

      // Create the folder
      const newFolder = await createFolder.mutateAsync({
        name: newFolderName.trim(),
      });

      // Move the chat to the new folder
      await moveLocalChatToFolder(chat.id, session.data.user.id, newFolder.id);

      queryClient.invalidateQueries({ queryKey: ["local-chats"] });
      queryClient.invalidateQueries({ queryKey: ["local-chat", chat.id] });
      setIsCreateFolderOpen(false);
      setIsMoveToFolderOpen(false);
      setNewFolderName("");
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert("Failed to create folder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find current folder name
  const currentFolder = folders.find((f) => f.id === chat.folderId);

  return (
    <div className="h-screen overflow-hidden flex-1 flex flex-col">
      <ChatHeader
        chatId={chat.id}
        title={chat.title || "New Chat"}
        folderName={currentFolder?.name}
        folderId={chat.folderId}
        isPinned={chat.pinned}
        onDelete={handleDelete}
        onRename={handleRename}
        onMoveToFolder={handleMoveToFolder}
        onTogglePin={handleTogglePin}
      />

      <div className="flex h-[calc(100%-85px)] flex-col grow w-full max-w-[900px] mx-auto">
        <div className="flex-1 overflow-hidden">
          <ChatMessageList
            messages={messages}
            isLoading={isLoading || isLoadingInitialMessages}
            onSuggestionClick={(text) => setInput(text)}
          />
        </div>

        <ChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading || isLoadingInitialMessages}
        />
      </div>

      {/* Rename Chat Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="chat-title">Chat title</Label>
              <Input
                id="chat-title"
                value={newChatTitle}
                onChange={(e) => setNewChatTitle(e.target.value)}
                placeholder="My Conversation"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirmRename();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!newChatTitle.trim() || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Dialog */}
      <Dialog open={isMoveToFolderOpen} onOpenChange={setIsMoveToFolderOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Select a folder to organize this chat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4 max-h-[300px] overflow-auto">
            {/* Option to remove from folder */}
            {chat.folderId && (
              <Button
                variant="ghost"
                className="justify-start h-auto py-3 px-3"
                onClick={() => handleSelectFolder(null)}
                disabled={isSubmitting}
              >
                <FolderOpen className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>Remove from folder</span>
              </Button>
            )}

            {/* Existing folders */}
            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant={chat.folderId === folder.id ? "secondary" : "ghost"}
                className="justify-start h-auto py-3 px-3"
                onClick={() => handleSelectFolder(folder.id)}
                disabled={isSubmitting || chat.folderId === folder.id}
              >
                <FolderOpen className="mr-3 h-4 w-4" />
                <span>{folder.name}</span>
                {chat.folderId === folder.id && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    (current)
                  </span>
                )}
              </Button>
            ))}

            {/* Create new folder option */}
            <Button
              variant="ghost"
              className="justify-start h-auto py-3 px-3 border-t mt-2 pt-4"
              onClick={() => {
                setNewFolderName("");
                setIsCreateFolderOpen(true);
              }}
            >
              <Plus className="mr-3 h-4 w-4" />
              <span>Create new folder</span>
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMoveToFolderOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Folder Dialog (nested from Move to Folder) */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder and move this chat into it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-folder-name">Folder name</Label>
              <Input
                id="new-folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="My Folder"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolderAndMove();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolderAndMove}
              disabled={!newFolderName.trim() || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create & Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
