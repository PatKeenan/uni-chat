import { useNavigate } from "@tanstack/react-router";
import {
	BadgeCheck,
	Bell,
	ChevronsUpDown,
	CreditCard,
	LogOut,
	Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/client/auth-client";

export function NavUser({
	user,
}: {
	user: {
		name: string;
		email: string;
		avatar: string;
	};
}) {
	const { isMobile } = useSidebar();
	const navigate = useNavigate();
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="bg-[rgba(250,248,245,0.04)] hover:bg-[rgba(250,248,245,0.08)] data-[state=open]:bg-[rgba(250,248,245,0.08)] transition-all duration-200 rounded-xl"
						>
							<Avatar className="h-9 w-9 rounded-[10px]">
								<AvatarImage src={user.avatar ?? ""} alt={user.name ?? ""} />
								<AvatarFallback className="rounded-[10px] bg-linear-to-br from-warm-500 to-warm-700 text-warm-foreground font-semibold text-[0.875rem]">
									{user.name?.charAt(0) ?? ""}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium text-[0.875rem]">{user.name ?? ""}</span>
								<span className="truncate text-[0.75rem] opacity-50">{user.email ?? ""}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-[10px]">
									<AvatarImage src={user.avatar} alt={user.name} />
									<AvatarFallback className="rounded-[10px] bg-linear-to-br from-warm-500 to-warm-700 text-warm-foreground font-semibold text-[0.875rem]">
										{user.name?.charAt(0) ?? ""}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium text-[0.875rem]">{user.name}</span>
									<span className="truncate text-xs opacity-70">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<Sparkles />
								Upgrade to Pro
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<BadgeCheck />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CreditCard />
								Billing
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Bell />
								Notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() =>
								signOut({}, { onSuccess: () => navigate({ to: "/login" }) })
							}
						>
							<LogOut />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
