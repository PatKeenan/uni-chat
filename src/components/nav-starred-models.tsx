import { useSuspenseQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getStarredModels } from "@/lib/server/actions/model-actions";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

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
      <SidebarGroupLabel>Starred Models</SidebarGroupLabel>
      <SidebarMenu>
        {starredModels.slice(0, 5).map((model) => (
          <SidebarMenuItem key={model.modelId}>
            <SidebarMenuButton className="w-full">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
                <span className="truncate text-sm">{model.modelName}</span>
                {model.contextLength && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
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
