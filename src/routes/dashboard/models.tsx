import { createFileRoute, redirect } from "@tanstack/react-router";
import { Search, Star } from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useStarredModels,
  useToggleModelStar,
} from "@/lib/client/hooks/use-models";
import { getApiKey } from "@/lib/client/storage/api-key";
import type { OpenRouterModel } from "@/lib/openrouter/client";
import { hasApiKey } from "@/lib/server/actions/api-key-actions";
import { getOpenRouterModels } from "@/lib/server/actions/model-actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/models")({
  loader: async () => {
    // Check if user has API key

    const hasKey = await hasApiKey();
    const localKey = getApiKey();
    if (!hasKey && !localKey) {
      throw redirect({ to: "/dashboard/settings" });
    }

    const models = await getOpenRouterModels({
      data: { localApiKey: localKey || "" },
    });
    return { models };
  },
  component: ModelsView,
});

function ModelsView() {
  const { models: allModels } = Route.useLoaderData();

  const { data: starredModels } = useStarredModels();
  const { star, unstar } = useToggleModelStar();
  const [searchQuery, setSearchQuery] = useState("");

  const starredModelIds = new Set(starredModels?.map((m) => m.modelId) || []);

  const filteredModels = React.useMemo(() => {
    return (
      allModels?.data?.filter((model) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          model.id.toLowerCase().includes(searchLower) ||
          model.name?.toLowerCase().includes(searchLower)
        );
      }) || []
    );
  }, [allModels, searchQuery]);

  const handleToggleStar = (model: OpenRouterModel) => {
    if (starredModelIds.has(model.id)) {
      unstar(model.id);
    } else {
      star({
        modelId: model.id,
        modelName: model.name || model.id,
        provider: model.id.split("/")[0] || "unknown",
        contextLength: model.contextLength || undefined,
        pricingPrompt: model.pricing?.prompt
          ? parseFloat(model.pricing.prompt)
          : undefined,
        pricingCompletion: model.pricing?.completion
          ? parseFloat(model.pricing.completion)
          : undefined,
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Models</h1>
        <p className="text-muted-foreground">
          Browse and star your favorite AI models
        </p>
      </div>
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All Models ({filteredModels?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="starred">
            Starred ({starredModels?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Models Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {model.name || model.id}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {model.id}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStar(model)}
                      className="shrink-0"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          starredModelIds.has(model.id) &&
                            "fill-yellow-400 text-yellow-400"
                        )}
                      />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {model.contextLength && (
                      <Badge variant="secondary">
                        {(model.contextLength / 1000).toFixed(0)}k context
                      </Badge>
                    )}
                    {model.pricing?.prompt && (
                      <Badge variant="outline">
                        ${Number(model.pricing.prompt * 1000000).toFixed(2)}
                        /M input
                      </Badge>
                    )}
                    {model.pricing?.completion && (
                      <Badge variant="outline">
                        ${Number(model.pricing.completion * 1000000).toFixed(2)}
                        /M output
                      </Badge>
                    )}
                  </div>
                  {model.description && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {model.description}
                    </p>
                  )}
                  {/* Add if it supports tools */}
                  <Badge variant="outline">
                    {model.supportedParameters?.includes("tool_choice") ||
                    model.supportedParameters?.includes("tools")
                      ? "Supports Tools"
                      : "No Tools"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredModels.length === 0 && (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No models found
            </div>
          )}
        </TabsContent>

        <TabsContent value="starred" className="space-y-4">
          {!starredModels || starredModels.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              You haven't starred any models yet
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {starredModels.map((model) => (
                <Card key={model.modelId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {model.modelName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {model.modelId}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => unstar(model.modelId)}
                        className="shrink-0"
                      >
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{model.provider}</Badge>
                      {model.contextLength && (
                        <Badge variant="secondary">
                          {(model.contextLength / 1000).toFixed(0)}k context
                        </Badge>
                      )}
                      {model.pricingCompletion && (
                        <Badge variant="outline">
                          ${Number(model.pricingCompletion).toFixed(4)}/1k
                          tokens
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
