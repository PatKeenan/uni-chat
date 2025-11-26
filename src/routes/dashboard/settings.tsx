import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Database,
  FileImage,
  FolderOpen,
  HardDrive,
  Key,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useClearAllChats,
  useClearAllMessages,
  useClearAllUserData,
  useClearAttachments,
  useCompleteDataReset,
  useDataStats,
} from "@/lib/client/hooks/use-data-management";
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
    const userId = context.user?.id ?? "";
    return { starredModels, userId };
  },
});

function SettingsView() {
  const { starredModels, userId } = Route.useLoaderData();
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
    } catch (_error) {
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
          <DataManagementSection userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Separate component for data management to keep hooks organized
function DataManagementSection({ userId }: { userId: string }) {
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useDataStats(userId);
  const clearAttachmentsMutation = useClearAttachments();
  const clearMessagesMutation = useClearAllMessages();
  const clearChatsMutation = useClearAllChats();
  const clearAllDataMutation = useClearAllUserData();
  const resetDbMutation = useCompleteDataReset();

  const [actionResult, setActionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleClearAttachments = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all attachments? This will remove all images and files from your messages, but keep the text content."
      )
    ) {
      return;
    }
    setActionResult(null);
    const result = await clearAttachmentsMutation.mutateAsync(userId);
    setActionResult(result);
  };

  const handleClearMessages = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all messages? Your chats will remain but will be empty."
      )
    ) {
      return;
    }
    setActionResult(null);
    const result = await clearMessagesMutation.mutateAsync(userId);
    setActionResult(result);
  };

  const handleClearChats = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all chats? This will permanently remove all your conversations and messages."
      )
    ) {
      return;
    }
    setActionResult(null);
    const result = await clearChatsMutation.mutateAsync(userId);
    setActionResult(result);
  };

  const handleClearAllData = async () => {
    if (
      !confirm(
        "⚠️ DANGER: Are you sure you want to delete ALL your local data? This includes chats, messages, folders, and starred models. This action cannot be undone!"
      )
    ) {
      return;
    }
    // Double confirmation for destructive action
    if (
      !confirm(
        "This is your final warning. ALL local data will be permanently deleted. Continue?"
      )
    ) {
      return;
    }
    setActionResult(null);
    const result = await clearAllDataMutation.mutateAsync(userId);
    setActionResult(result);
  };

  const handleCompleteReset = async () => {
    if (
      !confirm(
        "⚠️ NUCLEAR OPTION: This will completely wipe the database and require a page refresh. Are you absolutely sure?"
      )
    ) {
      return;
    }
    if (
      !confirm(
        "Last chance to cancel. The entire database will be destroyed. Continue?"
      )
    ) {
      return;
    }
    setActionResult(null);
    const result = await resetDbMutation.mutateAsync();
    setActionResult(result);
    if (result.success) {
      // Force page refresh after complete reset
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const isAnyMutationPending =
    clearAttachmentsMutation.isPending ||
    clearMessagesMutation.isPending ||
    clearChatsMutation.isPending ||
    clearAllDataMutation.isPending ||
    resetDbMutation.isPending;

  return (
    <>
      {/* Storage Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              <CardTitle>Storage Usage</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <CardDescription>
            Your data is stored locally in your browser using IndexedDB. This
            keeps your conversations private and under your control.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Main storage bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Total Browser Storage</span>
                  <span className="text-muted-foreground">
                    {stats.totalStorageUsedFormatted} /{" "}
                    {stats.totalQuotaFormatted}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.percentUsed.toFixed(2)}% of available storage used
                </p>
              </div>

              <Separator />

              {/* Breakdown by type */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Data Breakdown</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DataBreakdownItem
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Chats"
                    count={stats.breakdown.chats.count}
                    size={stats.breakdown.chats.estimatedSizeFormatted}
                  />
                  <DataBreakdownItem
                    icon={<Database className="h-4 w-4" />}
                    label="Messages"
                    count={stats.breakdown.messages.count}
                    size={stats.breakdown.messages.estimatedSizeFormatted}
                  />
                  <DataBreakdownItem
                    icon={<FileImage className="h-4 w-4" />}
                    label="Attachments"
                    count={stats.breakdown.attachments.count}
                    size={stats.breakdown.attachments.estimatedSizeFormatted}
                    highlight={stats.breakdown.attachments.count > 0}
                  />
                  <DataBreakdownItem
                    icon={<FolderOpen className="h-4 w-4" />}
                    label="Folders"
                    count={stats.breakdown.folders.count}
                    size={stats.breakdown.folders.estimatedSizeFormatted}
                  />
                  <DataBreakdownItem
                    icon={<Star className="h-4 w-4" />}
                    label="Starred Models"
                    count={stats.breakdown.starredModels.count}
                    size={stats.breakdown.starredModels.estimatedSizeFormatted}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Unable to load storage statistics.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Result Alert */}
      {actionResult && (
        <Alert variant={actionResult.success ? "default" : "destructive"}>
          {actionResult.success ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{actionResult.message}</AlertDescription>
        </Alert>
      )}

      {/* Data Cleanup Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            <CardTitle>Data Cleanup</CardTitle>
          </div>
          <CardDescription>
            Remove specific types of data to free up storage space. All actions
            are permanent and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Clear Attachments */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-amber-500" />
                <h4 className="font-medium">Clear Attachments</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Remove all images and files from your messages. Text content
                will be preserved.
                {stats && stats.breakdown.attachments.count > 0 && (
                  <span className="ml-1 text-amber-500">
                    ({stats.breakdown.attachments.count} attachments, ~
                    {stats.breakdown.attachments.estimatedSizeFormatted})
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAttachments}
              disabled={
                isAnyMutationPending ||
                !stats ||
                stats.breakdown.attachments.count === 0
              }
            >
              {clearAttachmentsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Clear
            </Button>
          </div>

          {/* Clear Messages */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-500" />
                <h4 className="font-medium">Clear All Messages</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Delete all messages but keep your chat history (empty chats will
                remain).
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearMessages}
              disabled={isAnyMutationPending}
            >
              {clearMessagesMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Clear
            </Button>
          </div>

          {/* Clear Chats */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-red-500" />
                <h4 className="font-medium">Clear All Chats</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Delete all chats and their messages. Folders and starred models
                will be preserved.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChats}
              disabled={isAnyMutationPending}
            >
              {clearChatsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Clear
            </Button>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-destructive">
              Danger Zone
            </h4>

            {/* Clear All User Data */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <h4 className="font-medium text-destructive">
                    Clear All My Data
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Remove everything: chats, messages, folders, and starred
                  models. Your API keys stored in localStorage will be
                  preserved.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAllData}
                disabled={isAnyMutationPending}
              >
                {clearAllDataMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Clear All
              </Button>
            </div>

            {/* Complete Database Reset */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <h4 className="font-medium text-destructive">
                    Complete Database Reset
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Nuclear option: completely wipe the IndexedDB database. This
                  removes ALL data and requires a page refresh. Use only if
                  experiencing database issues.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCompleteReset}
                disabled={isAnyMutationPending}
              >
                {resetDbMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Reset DB
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            <CardTitle>Your Data, Your Control</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Local Storage:</strong> All
              your conversations are stored locally in your browser using
              IndexedDB. Nothing is sent to our servers.
            </p>
            <p>
              <strong className="text-foreground">No Cloud Sync:</strong> Your
              data stays on this device only. If you clear your browser data or
              switch devices, your conversations won't follow.
            </p>
            <p>
              <strong className="text-foreground">API Keys:</strong> Your
              OpenRouter and Tavily API keys are stored separately in
              localStorage and are not affected by database operations above.
            </p>
            <p>
              <strong className="text-foreground">Export Coming Soon:</strong>{" "}
              We're working on an export feature to let you backup and transfer
              your conversations.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Helper component for data breakdown items
function DataBreakdownItem({
  icon,
  label,
  count,
  size,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  size: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${highlight ? "border-amber-500/30 bg-amber-500/5" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={highlight ? "text-amber-500" : "text-muted-foreground"}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">{count}</div>
        <div className="text-xs text-muted-foreground">{size}</div>
      </div>
    </div>
  );
}
