import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getSession } from "@/lib/client/auth-client";
import { createLocalChat } from "@/lib/client/actions/chat-actions";
import { useStarredModels } from "@/lib/client/hooks/use-models";
import { hasApiKey } from "@/lib/server/actions/api-key-actions";
import { getDefaultModel } from "@/lib/client/storage/default-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/new")({
  loader: async () => {
    // Check if user has API key
    const hasKey = await hasApiKey();
    if (!hasKey) {
      throw redirect({ to: "/dashboard/settings" });
    }
    return {};
  },
  component: NewChatView,
});

function NewChatView() {
  const navigate = useNavigate();
  const { data: starredModels } = useStarredModels();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingDefaultModel, setIsCheckingDefaultModel] = useState(true);
  const hasCheckedDefaultModel = useRef(false);

  // Check for default model on mount and auto-create chat if set
  useEffect(() => {
    // Only run once
    if (hasCheckedDefaultModel.current) return;
    hasCheckedDefaultModel.current = true;

    const autoCreateChatWithDefaultModel = async () => {
      const defaultModel = getDefaultModel();

      // If no default model, show the model selection screen
      if (!defaultModel) {
        setIsCheckingDefaultModel(false);
        return;
      }

      const session = await getSession();
      if (!session.data?.user?.id) {
        setIsCheckingDefaultModel(false);
        return;
      }

      setIsCreating(true);
      try {
        const chat = await createLocalChat({
          userId: session.data.user.id,
          selectedModel: defaultModel,
        });

        navigate({ to: "/dashboard/c/$chatId", params: { chatId: chat.id } });
      } catch (error) {
        console.error("Failed to auto-create chat:", error);
        setIsCreating(false);
        setIsCheckingDefaultModel(false);
      }
    };

    autoCreateChatWithDefaultModel();
  }, [navigate]);

  const handleCreateChat = async () => {
    if (!selectedModel) return;

    setIsCreating(true);
    try {
      // Get current user session
      const session = await getSession();
      if (!session.data?.user?.id) {
        console.error("No user session found");
        setIsCreating(false);
        return;
      }

      // Create chat in local database
      const chat = await createLocalChat({
        userId: session.data.user.id,
        selectedModel,
        title: "New Chat",
      });

      navigate({ to: "/dashboard/c/$chatId", params: { chatId: chat.id } });
    } catch (error) {
      console.error("Failed to create chat:", error);
      setIsCreating(false);
    }
  };

  // Show loading state while checking for default model
  if (isCheckingDefaultModel || isCreating) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="text-lg text-muted-foreground">
              {isCreating ? "Creating chat..." : "Loading..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Start a new chat</h1>
        <p className="text-muted-foreground">
          Select a model to begin your conversation
        </p>
      </div>

      {!starredModels || starredModels.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No starred models</CardTitle>
            <CardDescription>
              You haven't starred any models yet. Visit the models page to star
              your favorite models for quick access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/dashboard/models" })}>
              Browse models
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {starredModels.map((model) => (
              <Card
                key={model.modelId}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary",
                  selectedModel === model.modelId &&
                    "border-primary ring-2 ring-primary ring-offset-2"
                )}
                onClick={() => setSelectedModel(model.modelId)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{model.modelName}</CardTitle>
                    {selectedModel === model.modelId && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <CardDescription>{model.provider}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {model.contextLength && (
                      <Badge variant="secondary">
                        {(model.contextLength / 1000).toFixed(0)}k context
                      </Badge>
                    )}
                    {model.pricingPrompt && (
                      <Badge variant="outline">
                        ${Number(model.pricingPrompt).toFixed(4)}/1k tokens
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateChat}
              disabled={!selectedModel || isCreating}
            >
              {isCreating ? "Creating..." : "Start chat"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
