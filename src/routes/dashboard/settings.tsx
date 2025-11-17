import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Check, Key, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteApiKey,
  hasApiKey,
  saveApiKey,
  validateApiKey,
} from "@/lib/server/actions/api-key-actions";

export const Route = createFileRoute("/dashboard/settings")({
  loader: async () => {
    const hasKey = await hasApiKey();
    return { hasKey };
  },
  component: SettingsView,
});

function SettingsView() {
  const { hasKey: initialHasKey } = Route.useLoaderData();
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setValidationResult(null);

    try {
      // First validate the key
      setIsValidating(true);
      const validation = await validateApiKey({ data: { apiKey } });
      setIsValidating(false);

      if (!validation.valid) {
        setValidationResult({
          valid: false,
          message: "Invalid API key. Please check and try again.",
        });
        setIsSaving(false);
        return;
      }

      // Save the key
      await saveApiKey({ data: { apiKey } });
      setHasKey(true);
      setApiKey("");
      setValidationResult({
        valid: true,
        message: "API key saved successfully!",
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        message: "Failed to save API key. Please try again.",
      });
    } finally {
      setIsSaving(false);
      setIsValidating(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm("Are you sure you want to delete your API key?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteApiKey();
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
                Your OpenRouter API key is used to access AI models. Get your
                key from{" "}
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
                      You have an API key configured. Your key is encrypted and
                      stored securely.
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
                    disabled={!apiKey.trim() || isSaving || isValidating}
                  >
                    {isValidating
                      ? "Validating..."
                      : isSaving
                        ? "Saving..."
                        : "Save API Key"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Customize your experience (coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Preference options will be added in a future update.
              </p>
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
