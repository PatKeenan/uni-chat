import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  FolderOpen,
  MessageSquare,
  Pin,
  ChevronRight,
} from "lucide-react";
import { getUserChats } from "@/lib/server/actions/chat-actions";
import { getUserFolders } from "@/lib/server/actions/folder-actions";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function NavFolders() {
  const { chatId } = useParams({ strict: false }) as { chatId?: string };

  const { data: chatResults } = useSuspenseQuery({
    queryKey: ["user-chats"],
    queryFn: async () => {
      const result = await getUserChats();
      return result;
    },
  });

  const { data: folders } = useSuspenseQuery({
    queryKey: ["user-folders"],
    queryFn: async () => {
      const result = await getUserFolders();
      return result;
    },
  });

  // Extract chats from the {chat, folder} structure
  const chats = chatResults?.map((r) => r.chat) || [];

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
                  {pinnedChats.map((chat) => (
                    <SidebarMenuSubItem key={chat.id}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={chatId === chat.id}
                      >
                        <Link to="/dashboard/c/$chatId" params={{ chatId: chat.id }}>
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
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
                    {folderChats.map((chat) => (
                      <SidebarMenuSubItem key={chat.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={chatId === chat.id}
                        >
                          <Link to="/dashboard/c/$chatId" params={{ chatId: chat.id }}>
                            <MessageSquare className="h-4 w-4" />
                            <span className="truncate">{chat.title}</span>
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
        {chatsByFolder?.uncategorized && chatsByFolder.uncategorized.length > 0 && (
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
                  {chatsByFolder.uncategorized.map((chat) => (
                    <SidebarMenuSubItem key={chat.id}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={chatId === chat.id}
                      >
                        <Link to="/dashboard/c/$chatId" params={{ chatId: chat.id }}>
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
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
