import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight, FolderOpen, MessageSquare, Pin } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useLocalChats } from "@/lib/client/hooks/use-local-chats";
import { useLocalFolders } from "@/lib/client/hooks/use-local-folders";

interface NavFoldersProps {
  userId: string;
}

export function NavFolders({ userId }: NavFoldersProps) {
  const { chatId } = useParams({ strict: false }) as { chatId?: string };

  const { data: chats = [], isLoading: isLoadingChats } = useLocalChats(userId);
  const { data: folders = [], isLoading: isLoadingFolders } =
    useLocalFolders(userId);

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

  // Separate pinned chats
  const pinnedChats = chats?.filter((c) => c.pinned) || [];
  const hasChats = chats && chats.length > 0;

  if (isLoadingChats || isLoadingFolders) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Chats</SidebarGroupLabel>
        <div className="px-2 py-4 text-sm text-muted-foreground">
          Loading chats...
        </div>
      </SidebarGroup>
    );
  }

  if (!hasChats) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Chats</SidebarGroupLabel>
        <div className="px-2 py-4 text-sm text-muted-foreground">
          No chats yet. Create your first chat!
        </div>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarMenu>
        {/* Pinned chats */}
        {pinnedChats.length > 0 && (
          <Collapsible defaultOpen>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Pin className="h-4 w-4" />
                  <span>Pinned</span>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {pinnedChats.map((chat, _idx) => (
                    <SidebarMenuSubItem key={chat.id}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={chatId === chat.id}
                      >
                        <Link
                          to="/dashboard/c/$chatId"
                          params={{ chatId: chat.id }}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">
                            {chat.title} - {_idx}
                          </span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}

        {/* Folders with chats */}
        {folders?.map((folder) => {
          const folderChats = chatsByFolder?.[folder.id] || [];
          if (folderChats.length === 0) return null;

          return (
            <Collapsible key={folder.id} defaultOpen>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <FolderOpen className="h-4 w-4" />
                    <span>{folder.name}</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {folderChats.map((chat, _idx) => (
                      <SidebarMenuSubItem key={chat.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={chatId === chat.id}
                        >
                          <Link
                            to="/dashboard/c/$chatId"
                            params={{ chatId: chat.id }}
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="truncate">
                              {chat.title} - {_idx}
                            </span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}

        {/* Uncategorized chats */}
        {chatsByFolder?.uncategorized &&
          chatsByFolder.uncategorized.length > 0 && (
            <Collapsible defaultOpen>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <MessageSquare className="h-4 w-4" />
                    <span>Uncategorized</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {chatsByFolder.uncategorized.map((chat, _idx) => (
                      <SidebarMenuSubItem key={chat.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={chatId === chat.id}
                        >
                          <Link
                            to="/dashboard/c/$chatId"
                            params={{ chatId: chat.id }}
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="truncate">
                              {chat.title} - {_idx}
                            </span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
