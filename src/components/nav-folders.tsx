import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronDown,
  Edit2,
  Folder,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { deleteLocalChat } from "@/lib/client/actions/chat-actions";
import { useLocalChats } from "@/lib/client/hooks/use-local-chats";
import {
  useCreateLocalFolder,
  useDeleteLocalFolder,
  useLocalFolders,
  useUpdateLocalFolderName,
} from "@/lib/client/hooks/use-local-folders";

interface NavFoldersProps {
  userId: string;
}

interface FolderItemProps {
  folder: { id: string; name: string };
  chats: Array<{ id: string; title: string | null }>;
  currentChatId?: string;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  onRenameFolder: (folderId: string, currentName: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

function FolderItem({
  folder,
  chats,
  currentChatId,
  onDeleteChat,
  onRenameFolder,
  onDeleteFolder,
}: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="group/folder rounded-lg">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 opacity-80 hover:opacity-100 hover:bg-[#2A2820]">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="h-[18px] w-[18px] flex items-center justify-center opacity-50 transition-opacity duration-200 group-hover/folder:opacity-100"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-250 ${isOpen ? "rotate-0" : "-rotate-90"}`}
                style={{
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Folder className="h-4 w-4 text-warm-200 shrink-0 stroke-[1.5]" />
              <span className="flex-1 text-[0.9375rem] truncate">
                {folder.name}
              </span>
            </div>
          </CollapsibleTrigger>
          <Badge className="folder-badge text-[0.6875rem] font-medium shrink-0">
            {chats.length}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover/folder:opacity-100 transition-opacity p-1 hover:bg-[#3A3830] rounded-sm shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameFolder(folder.id, folder.name);
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rename folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent
          className="transition-all duration-300"
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <SidebarMenuSub className="ml-[26px] border-l-0 pl-0 space-y-0">
            {chats.length === 0 ? (
              <div className="relative pl-6">
                {/* Tree connector for empty state */}
                <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none">
                  <div className="absolute left-[11px] w-px bg-sidebar-foreground/20 top-0 h-[50%]" />
                  <div className="absolute left-[11px] top-1/2 w-[10px] h-px bg-sidebar-foreground/20" />
                </div>
                <div className="px-2 py-2 text-sm text-muted-foreground opacity-60">
                  No chats in this folder
                </div>
              </div>
            ) : (
              chats.map((chat, index) => (
                <ChatMenuItem
                  key={chat.id}
                  chat={chat}
                  isActive={currentChatId === chat.id}
                  isLast={index === chats.length - 1}
                  onDelete={onDeleteChat}
                />
              ))
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ChatMenuItemProps {
  chat: {
    id: string;
    title: string | null;
  };
  isActive: boolean;
  isLast: boolean;
  onDelete: (chatId: string, e: React.MouseEvent) => void;
}

function ChatMenuItem({ chat, isActive, isLast, onDelete }: ChatMenuItemProps) {
  return (
    <SidebarMenuSubItem key={chat.id} className="relative">
      {/* Tree connector lines */}
      <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none">
        {/* Vertical line - extends full height for non-last items, half for last */}
        <div
          className={`absolute left-[11px] w-px bg-sidebar-foreground/20 ${
            isLast ? "top-0 h-[50%]" : "top-0 bottom-0"
          }`}
        />
        {/* Horizontal branch line */}
        <div className="absolute left-[11px] top-1/2 w-[10px] h-px bg-sidebar-foreground/20" />
      </div>

      <div className="group/chat-item relative flex items-center w-full pl-6">
        <SidebarMenuSubButton
          asChild
          isActive={isActive}
          className="flex-1 pr-8 opacity-70 hover:opacity-100 hover:bg-[#2A2820] transition-all duration-200 rounded-lg text-[0.9375rem] data-[active=true]:opacity-100 data-[active=true]:bg-[#2A2820]"
        >
          <Link to="/dashboard/c/$chatId" params={{ chatId: chat.id }}>
            <MessageSquare className="h-4 w-4" />
            <span className="truncate">{chat.title || "New Chat"}</span>
          </Link>
        </SidebarMenuSubButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/chat-item:opacity-100 transition-opacity p-1 hover:bg-accent rounded-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => onDelete(chat.id, e)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarMenuSubItem>
  );
}

export function NavFolders({ userId }: NavFoldersProps) {
  const { chatId } = useParams({ strict: false }) as { chatId?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dialog states
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  const { data: chats = [], isLoading: isLoadingChats } = useLocalChats(userId);
  const { data: folders = [], isLoading: isLoadingFolders } =
    useLocalFolders(userId);

  // Folder mutations
  const createFolder = useCreateLocalFolder(userId);
  const updateFolderName = useUpdateLocalFolderName(userId);
  const deleteFolder = useDeleteLocalFolder(userId);

  const handleDeleteChat = async (
    chatIdToDelete: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmMessage =
      "Are you sure you want to delete this chat?\n\n" +
      "This will permanently delete the chat and all its messages.\n" +
      "This action cannot be undone.";

    if (confirm(confirmMessage)) {
      try {
        await deleteLocalChat(chatIdToDelete, userId);

        // Invalidate queries to update sidebar
        queryClient.invalidateQueries({ queryKey: ["local-chats"] });

        // If we're currently viewing the deleted chat, navigate to dashboard
        if (chatId === chatIdToDelete) {
          navigate({ to: "/dashboard" });
        }
      } catch (error) {
        console.error("Failed to delete chat:", error);
        alert("Failed to delete chat. Please try again.");
      }
    }
  };

  // Group chats by folder
  const chatsByFolder = chats?.reduce(
    (acc, chat) => {
      const folderId = chat.folderId || "uncategorized";
      if (!acc[folderId]) {
        acc[folderId] = [];
      }
      acc[folderId].push(chat);
      return acc;
    },
    {} as Record<string, typeof chats>
  );

  const hasChats = chats && chats.length > 0;

  if (isLoadingChats || isLoadingFolders) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[0.6875rem] font-semibold uppercase tracking-widest text-sidebar-foreground/50 pl-2">
          Recent
        </SidebarGroupLabel>
        <div className="px-2 py-4 text-sm text-muted-foreground">
          Loading chats...
        </div>
      </SidebarGroup>
    );
  }

  const handleCreateFolder = () => {
    setNewFolderName("");
    setIsCreateFolderOpen(true);
  };

  const handleConfirmCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder.mutateAsync({ name: newFolderName.trim() });
      setIsCreateFolderOpen(false);
      setNewFolderName("");
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert("Failed to create folder. Please try again.");
    }
  };

  const handleRenameFolder = (folderId: string, currentName: string) => {
    setRenameFolderId(folderId);
    setRenameFolderName(currentName);
    setIsRenameFolderOpen(true);
  };

  const handleConfirmRenameFolder = async () => {
    if (!renameFolderId || !renameFolderName.trim()) return;

    try {
      await updateFolderName.mutateAsync({
        folderId: renameFolderId,
        name: renameFolderName.trim(),
      });
      setIsRenameFolderOpen(false);
      setRenameFolderId(null);
      setRenameFolderName("");
    } catch (error) {
      console.error("Failed to rename folder:", error);
      alert("Failed to rename folder. Please try again.");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const confirmMessage =
      "Are you sure you want to delete this folder?\n\n" +
      "Chats in this folder will be moved to uncategorized.\n" +
      "This action cannot be undone.";

    if (confirm(confirmMessage)) {
      try {
        await deleteFolder.mutateAsync(folderId);
      } catch (error) {
        console.error("Failed to delete folder:", error);
        alert("Failed to delete folder. Please try again.");
      }
    }
  };

  // Show recent chats (up to 10 most recent)
  const recentChats = chats?.slice(0, 10) || [];

  return (
    <>
      {/* Recent Chats Section */}
      <SidebarGroup>
        <SidebarGroupLabel className="text-[0.6875rem] font-semibold uppercase tracking-widest text-sidebar-foreground/50 pl-2 mb-2">
          Recent
        </SidebarGroupLabel>
        {!hasChats ? (
          <div className="px-2 py-4 text-sm text-muted-foreground">
            No chats yet. Create your first chat!
          </div>
        ) : (
          <SidebarMenu className="gap-0 max-h-[200px] overflow-auto">
            {recentChats.map((chat) => (
              <SidebarMenuItem key={chat.id}>
                <SidebarMenuButton
                  asChild
                  isActive={chatId === chat.id}
                  className="opacity-70 hover:opacity-100 hover:bg-[#2A2820] transition-all duration-200 rounded-lg text-[0.9375rem] px-2 data-[active=true]:opacity-100 data-[active=true]:bg-[#2A2820]"
                >
                  <Link to="/dashboard/c/$chatId" params={{ chatId: chat.id }}>
                    <MessageSquare className="h-4 w-4" />
                    <span className="truncate">{chat.title || "New Chat"}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
      </SidebarGroup>

      {/* Folders Section */}
      <SidebarGroup>
        <div className="flex items-center justify-between mb-4 pl-2 pr-1">
          <SidebarGroupLabel className="text-[0.6875rem] font-semibold uppercase tracking-widest text-sidebar-foreground/50 p-0 m-0">
            Folders
          </SidebarGroupLabel>
          <Button
            variant="ghost"
            size="icon"
            className="h-[22px] w-[22px] bg-[rgba(250,248,245,0.08)] hover:bg-[rgba(250,248,245,0.15)] rounded-md p-0"
            onClick={handleCreateFolder}
            title="Create folder"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          {folders.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground opacity-60">
              No folders yet
            </div>
          ) : (
            folders.map((folder) => {
              const folderChats = chatsByFolder[folder.id] || [];
              return (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  chats={folderChats}
                  currentChatId={chatId}
                  onDeleteChat={handleDeleteChat}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                />
              );
            })
          )}
        </div>
      </SidebarGroup>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder to organize your chats.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="My Folder"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirmCreateFolder();
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
              onClick={handleConfirmCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
            >
              {createFolder.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={isRenameFolderOpen} onOpenChange={setIsRenameFolderOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-folder-name">Folder name</Label>
              <Input
                id="rename-folder-name"
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                placeholder="My Folder"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirmRenameFolder();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRenameFolder}
              disabled={!renameFolderName.trim() || updateFolderName.isPending}
            >
              {updateFolderName.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
