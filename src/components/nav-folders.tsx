import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
	ChevronRight,
	FolderOpen,
	MessageSquare,
	MoreHorizontal,
	Pin,
	Trash2,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useLocalFolders } from "@/lib/client/hooks/use-local-folders";

interface NavFoldersProps {
	userId: string;
}

interface ChatMenuItemProps {
	chat: {
		id: string;
		title: string | null;
	};
	isActive: boolean;
	onDelete: (chatId: string, e: React.MouseEvent) => void;
}

function ChatMenuItem({ chat, isActive, onDelete }: ChatMenuItemProps) {
	return (
		<SidebarMenuSubItem key={chat.id}>
			<div className="group/chat-item relative flex items-center w-full">
				<SidebarMenuSubButton
					asChild
					isActive={isActive}
					className="flex-1 pr-8"
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

	const { data: chats = [], isLoading: isLoadingChats } = useLocalChats(userId);
	const { data: folders = [], isLoading: isLoadingFolders } =
		useLocalFolders(userId);

	const handleDeleteChat = async (
		chatIdToDelete: string,
		e: React.MouseEvent,
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
		{} as Record<string, typeof chats>,
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
									{pinnedChats.map((chat) => (
										<ChatMenuItem
											key={chat.id}
											chat={chat}
											isActive={chatId === chat.id}
											onDelete={handleDeleteChat}
										/>
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
											<ChatMenuItem
												key={chat.id}
												chat={chat}
												isActive={chatId === chat.id}
												onDelete={handleDeleteChat}
											/>
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
										{chatsByFolder.uncategorized.map((chat) => (
											<ChatMenuItem
												key={chat.id}
												chat={chat}
												isActive={chatId === chat.id}
												onDelete={handleDeleteChat}
											/>
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
