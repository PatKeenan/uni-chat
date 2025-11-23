import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Check, Key, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  hasApiKey as hasLocalApiKey,
  hasTavilyApiKey as hasLocalTavilyApiKey,
  removeApiKey,
  removeTavilyApiKey,
  setApiKey as setLocalApiKey,
  setTavilyApiKey as setLocalTavilyApiKey,
} from "@/lib/client/storage/api-key";
import {
  getDefaultModel,
  removeDefaultModel,
  setDefaultModel,
} from "@/lib/client/storage/default-model";
import { getStarredModels } from "@/lib/server/actions/model-actions";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsView,
  loader: async ({ context }) => {
    const starredModels = await context.queryClient.ensureQueryData({
      queryKey: ["starred-models"],
      queryFn: () => getStarredModels(),
    });
    return { starredModels };
  },
});

function SettingsView() {
  const { starredModels } = Route.useLoaderData();
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Tavily API key state
  const [hasTavilyKey, setHasTavilyKey] = useState(false);
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [isSavingTavily, setIsSavingTavily] = useState(false);
  const [isDeletingTavily, setIsDeletingTavily] = useState(false);
  const [tavilyValidationResult, setTavilyValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Default model state
  const [defaultModel, setDefaultModelState] = useState<string>("");
  const [modelSaveMessage, setModelSaveMessage] = useState<string>("");

  // Check for existing API keys and default model on mount
  useEffect(() => {
    setHasKey(hasLocalApiKey());
    setHasTavilyKey(hasLocalTavilyApiKey());
    const savedModel = getDefaultModel();
    if (savedModel) {
      setDefaultModelState(savedModel);
    }
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setValidationResult(null);

    try {
      // Save the key to localStorage
      setLocalApiKey(apiKey);
      setHasKey(true);
      setApiKey("");
      setValidationResult({
        valid: true,
        message:
          "API key saved successfully! Your key is stored locally in your browser.",
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        message: "Failed to save API key. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm("Are you sure you want to delete your API key?")) {
      return;
    }

    setIsDeleting(true);
    try {
      removeApiKey();
      setHasKey(false);
      setValidationResult({
        valid: true,
        message: "API key deleted successfully.",
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        message: "Failed to delete API key.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTavilyApiKey = async () => {
    if (!tavilyApiKey.trim()) return;

    setIsSavingTavily(true);
    setTavilyValidationResult(null);

    try {
      setLocalTavilyApiKey(tavilyApiKey);
      setHasTavilyKey(true);
      setTavilyApiKey("");
      setTavilyValidationResult({
        valid: true,
        message:
          "Tavily API key saved successfully! Your key is stored locally in your browser.",
      });
    } catch (error) {
      setTavilyValidationResult({
        valid: false,
        message: "Failed to save Tavily API key. Please try again.",
      });
    } finally {
      setIsSavingTavily(false);
    }
  };

  const handleDeleteTavilyApiKey = async () => {
    if (!confirm("Are you sure you want to delete your Tavily API key?")) {
      return;
    }

    setIsDeletingTavily(true);
    try {
      removeTavilyApiKey();
      setHasTavilyKey(false);
      setTavilyValidationResult({
        valid: true,
        message: "Tavily API key deleted successfully.",
      });
    } catch (error) {
      setTavilyValidationResult({
        valid: false,
        message: "Failed to delete Tavily API key.",
      });
    } finally {
      setIsDeletingTavily(false);
    }
  };

  const handleSaveDefaultModel = (modelId: string) => {
    setDefaultModelState(modelId);
    setDefaultModel(modelId);
    setModelSaveMessage("Default model saved successfully!");
    setTimeout(() => setModelSaveMessage(""), 3000);
  };

  const handleRemoveDefaultModel = () => {
    setDefaultModelState("");
    removeDefaultModel();
    setModelSaveMessage("Default model removed.");
    setTimeout(() => setModelSaveMessage(""), 3000);
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences
        </p>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList>
          <TabsTrigger value="api">API Key</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>OpenRouter API Key</CardTitle>
              </div>
              <CardDescription>
                Your OpenRouter API key is stored locally in your browser and
                never sent to our servers. Get your key from{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasKey ? (
                <>
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertDescription>
                      You have an API key configured. Your key is stored locally
                      in your browser.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setHasKey(false)}>
                      Update API Key
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteApiKey}
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isDeleting ? "Deleting..." : "Delete API Key"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>

                  {validationResult && (
                    <Alert
                      variant={
                        validationResult.valid ? "default" : "destructive"
                      }
                    >
                      {validationResult.valid ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {validationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim() || isSaving}
                  >
                    {isSaving ? "Saving..." : "Save API Key"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                <CardTitle>Tavily API Key</CardTitle>
              </div>
              <CardDescription>
                Your Tavily API key enables web search capabilities. It's stored
                locally in your browser and never sent to our servers. Get your
                key from{" "}
                <a
                  href="https://tavily.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  tavily.com
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasTavilyKey ? (
                <>
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertDescription>
                      You have a Tavily API key configured. Your key is stored
                      locally in your browser.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setHasTavilyKey(false)}
                    >
                      Update API Key
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteTavilyApiKey}
                      disabled={isDeletingTavily}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isDeletingTavily ? "Deleting..." : "Delete API Key"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tavily-api-key">API Key</Label>
                    <Input
                      id="tavily-api-key"
                      type="password"
                      placeholder="tvly-..."
                      value={tavilyApiKey}
                      onChange={(e) => setTavilyApiKey(e.target.value)}
                      disabled={isSavingTavily}
                    />
                  </div>

                  {tavilyValidationResult && (
                    <Alert
                      variant={
                        tavilyValidationResult.valid ? "default" : "destructive"
                      }
                    >
                      {tavilyValidationResult.valid ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {tavilyValidationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleSaveTavilyApiKey}
                    disabled={!tavilyApiKey.trim() || isSavingTavily}
                  >
                    {isSavingTavily ? "Saving..." : "Save API Key"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <CardTitle>Default Model</CardTitle>
              </div>
              <CardDescription>
                Set your preferred AI model for new chats. This model will be
                automatically selected when you start a new conversation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!starredModels || starredModels.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You haven't starred any models yet. Visit the{" "}
                    <a
                      href="/dashboard/models"
                      className="text-primary hover:underline"
                    >
                      models page
                    </a>{" "}
                    to star your favorite models, then return here to set a
                    default.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="default-model">Default Model</Label>
                    <Select
                      value={defaultModel}
                      onValueChange={handleSaveDefaultModel}
                    >
                      <SelectTrigger id="default-model">
                        <SelectValue placeholder="Select a default model" />
                      </SelectTrigger>
                      <SelectContent>
                        {starredModels.map((model) => (
                          <SelectItem key={model.modelId} value={model.modelId}>
                            {model.modelName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      When set, clicking "New Chat" will take you directly to a
                      chat with this model selected.
                    </p>
                  </div>

                  {modelSaveMessage && (
                    <Alert>
                      <Check className="h-4 w-4" />
                      <AlertDescription>{modelSaveMessage}</AlertDescription>
                    </Alert>
                  )}

                  {defaultModel && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveDefaultModel}
                    >
                      Clear Default Model
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or delete your data (coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Data management options will be added in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
