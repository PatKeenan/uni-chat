import { Link } from "@tanstack/react-router";
import { Bot, MessageSquarePlus, Settings2 } from "lucide-react";
import type * as React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { NavFolders } from "./nav-folders";
import { NavStarredModels } from "./nav-starred-models";
import { NavUser } from "./nav-user";

export function AppSidebar({
	user,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: {
		id: string;
		name: string;
		email: string;
		avatar: string;
	};
}) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild size="lg">
								<Link to="/dashboard/new">
									<MessageSquarePlus className="h-5 w-5" />
									<span className="font-semibold">New Chat</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarHeader>

			<SidebarContent>
				{/* Chats organized by folders */}
				<NavFolders userId={user.id} />

				{/* Starred models for quick access */}
				<NavStarredModels />

				{/* Navigation links */}
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild>
								<Link to="/dashboard/models">
									<Bot className="h-4 w-4" />
									<span>Browse Models</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton asChild>
								<Link to="/dashboard/settings">
									<Settings2 className="h-4 w-4" />
									<span>Settings</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
