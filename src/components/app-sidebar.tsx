import { Link } from "@tanstack/react-router";
import { Bot, Plus, Settings2 } from "lucide-react";
import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavFolders } from "./nav-folders";
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
      {/* Logo/Branding */}
      <div className="flex items-center gap-4 mb-12 animate-fade-slide-down">
        <div className="w-10 h-10 bg-linear-to-br from-warm-500 to-warm-700 rounded-xl flex items-center justify-center shadow-warm-md">
          <Bot className="h-[22px] w-[22px] text-warm-foreground" />
        </div>
        <span className="font-serif text-2xl font-medium tracking-tight">
          Muse
        </span>
      </div>

      <SidebarHeader className="animate-fade-slide-down delay-100">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                className="bg-[rgba(250,248,245,0.10)] hover:bg-[rgba(250,248,245,0.12)] border border-[rgba(250,248,245,0.1)] hover:border-[rgba(250,248,245,0.2)] rounded-xl transition-all duration-250 hover:-translate-y-px opacity-100"
              >
                <Link
                  to="/dashboard/new"
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
                  <span className="font-medium text-[0.9375rem]">
                    New conversation
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Chats organized by folders */}
        <div className="animate-fade-slide-down delay-150">
          <NavFolders userId={user.id} />
        </div>

        {/* Starred models for quick access */}
        {/* <div className="animate-fade-slide-down delay-200">
          <NavStarredModels />
        </div> */}
      </SidebarContent>

      {/* Navigation links in footer with separator */}
      <SidebarFooter className="animate-fade-slide-up delay-300 mt-auto pt-6 border-t border-[rgba(250,248,245,0.08)] px-0">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="opacity-60 hover:opacity-100 hover:bg-sidebar-accent transition-all duration-200 rounded-lg text-[0.9375rem]"
            >
              <Link to="/dashboard/models">
                <Bot className="h-[18px] w-[18px]" strokeWidth={1.5} />
                <span>Browse Models</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="opacity-60 hover:opacity-100 hover:bg-sidebar-accent transition-all duration-200 rounded-lg text-[0.9375rem]"
            >
              <Link to="/dashboard/settings">
                <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-3">
          <NavUser user={user} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
