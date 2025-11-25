import { useSuspenseQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getStarredModels } from "@/lib/server/actions/model-actions";

export function NavStarredModels() {
  const { data: starredModels } = useSuspenseQuery({
    queryKey: ["starred-models"],
    queryFn: async () => {
      const result = await getStarredModels();
      return result;
    },
  });

  if (!starredModels || starredModels.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.6875rem] font-semibold uppercase tracking-widest text-sidebar-foreground/50 pl-2 mb-4">
        Starred Models
      </SidebarGroupLabel>
      <SidebarMenu>
        {starredModels.slice(0, 5).map((model) => (
          <SidebarMenuItem key={model.modelId}>
            <SidebarMenuButton className="w-full bg-[rgba(250,248,245,0.04)] hover:bg-[rgba(250,248,245,0.08)] transition-all duration-200 rounded-[10px] opacity-100 p-4">
              <Star className="h-4 w-4 fill-warm-200 text-warm-200" />
              <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
                <span className="truncate text-[0.9375rem] font-medium">
                  {model.modelName}
                </span>
                {model.contextLength && (
                  <Badge
                    variant="secondary"
                    className="text-[0.6875rem] font-semibold text-warm-200 bg-[rgba(196,112,75,0.15)] px-2 py-0.5 rounded-[20px] shrink-0"
                  >
                    {(model.contextLength / 1000).toFixed(0)}k
                  </Badge>
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
