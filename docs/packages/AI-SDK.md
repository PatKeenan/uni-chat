# AI SDK + OpenRouter Documentation

**Packages:** `ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`
**Version:** ai@5.x, @ai-sdk/react@3.x
**Purpose:** Client-side AI streaming with OpenRouter
**Last Updated:** 2025-11-17

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Options](#architecture-options)
3. [Client-Side Streaming (Maximum Privacy)](#client-side-streaming-maximum-privacy)
4. [Server-Side Streaming (Current)](#server-side-streaming-current)
5. [OpenRouter Integration](#openrouter-integration)
6. [Message Management](#message-management)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is AI SDK?

Vercel AI SDK provides:
- Streaming AI responses
- React hooks for chat UIs
- Framework-agnostic core
- Support for multiple providers (OpenAI, Anthropic, etc.)

### OpenRouter Integration

OpenRouter is an AI model router that:
- Aggregates 100+ models from multiple providers
- Single API key for all models
- Unified pricing and interface
- Fallback support

---

## Architecture Options

### Option 1: Client-Side (Maximum Privacy) ⭐ RECOMMENDED

**Flow:**
```
User → Browser → OpenRouter API → Browser → Local DB
```

**Pros:**
- ✅ Maximum privacy - no server sees conversations
- ✅ Simpler architecture
- ✅ Works offline (after initial load)
- ✅ No server costs for streaming
- ✅ User's API key never sent to your server

**Cons:**
- ❌ API key stored in browser (use encryption)
- ❌ Rate limits apply to client IP
- ❌ Can't hide API calls from user

**When to Use:**
- Privacy is the top priority
- Users trust to manage their own keys
- Local-first architecture

### Option 2: Server-Side (Current Implementation)

**Flow:**
```
User → Your Server → OpenRouter API → Your Server → User
                ↓
          Remote Database
```

**Pros:**
- ✅ API keys never exposed to client
- ✅ Can implement custom rate limiting
- ✅ Centralized logging
- ✅ Can add custom middleware

**Cons:**
- ❌ Server sees all conversations
- ❌ Privacy concerns
- ❌ Server bandwidth costs
- ❌ Additional latency

**When to Use:**
- Need server-side control
- Multi-user features
- Compliance requirements

---

## Client-Side Streaming (Maximum Privacy)

### Setup

```bash
pnpm add ai @ai-sdk/react @openrouter/ai-sdk-provider
```

### Store API Key Securely

```typescript
// src/lib/client/storage/api-key.ts

// Encrypt API key before storing
async function encryptApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);

  // Generate encryption key from user password or device ID
  const password = await getDeviceId(); // Or user password
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('salt'), // Use proper salt
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    data
  );

  // Store IV + encrypted data
  return btoa(String.fromCharCode(...new Uint8Array([...iv, ...new Uint8Array(encrypted)])));
}

// Store encrypted key
export async function storeApiKey(key: string): Promise<void> {
  const encrypted = await encryptApiKey(key);
  localStorage.setItem('encrypted_api_key', encrypted);
}

// Decrypt and retrieve
export async function getApiKey(): Promise<string | null> {
  const encrypted = localStorage.getItem('encrypted_api_key');
  if (!encrypted) return null;

  // Decrypt logic (reverse of encrypt)
  // ... decryption code ...

  return decryptedKey;
}

// Clear key
export function clearApiKey(): void {
  localStorage.removeItem('encrypted_api_key');
}
```

### Client-Side Chat Hook

```typescript
// src/lib/client/hooks/use-client-chat.ts
import { useChat } from '@ai-sdk/react';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getApiKey } from '@/lib/client/storage/api-key';
import { getClientDb } from '@/lib/client/db';
import { saveLocalMessages } from '@/lib/client/actions/message-actions';

export function useClientChat(chatId: string, initialMessages = []) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Load API key on mount
  useEffect(() => {
    getApiKey().then(setApiKey);
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    error,
  } = useChat({
    id: chatId,
    initialMessages,

    // Call OpenRouter API directly from client
    api: 'https://openrouter.ai/api/v1/chat/completions',

    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Uni-Chat',
    },

    body: {
      model: 'anthropic/claude-3.5-sonnet', // Or dynamic
    },

    // Save messages to local database after streaming completes
    onFinish: async ({ messages: allMessages }) => {
      await saveLocalMessages(chatId, allMessages);
    },

    onError: (error) => {
      console.error('Chat error:', error);
      // Show user-friendly error
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    if (!apiKey) {
      // Prompt user to add API key
      alert('Please add your OpenRouter API key in settings');
      return;
    }

    originalHandleSubmit(e);
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    hasApiKey: !!apiKey,
  };
}
```

### Usage in Component

```typescript
// src/routes/dashboard/c.$chatId.tsx
function ChatView() {
  const { chatId } = Route.useParams();
  const { messages: initialMessages } = Route.useLoaderData();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    hasApiKey,
  } = useClientChat(chatId, initialMessages);

  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>API Key Required</CardTitle>
            <CardDescription>
              Add your OpenRouter API key to start chatting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/settings">
              <Button>Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} isLoading={isLoading} />

      <form onSubmit={handleSubmit} className="p-4">
        <Textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
}
```

### API Key Settings UI

```typescript
// src/routes/dashboard/settings.tsx
function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [isStored, setIsStored] = useState(false);

  useEffect(() => {
    getApiKey().then(key => setIsStored(!!key));
  }, []);

  const handleSave = async () => {
    if (!apiKey.startsWith('sk-or-')) {
      alert('Invalid OpenRouter API key');
      return;
    }

    await storeApiKey(apiKey);
    setIsStored(true);
    setApiKey(''); // Clear input
    toast.success('API key saved securely');
  };

  const handleRemove = async () => {
    clearApiKey();
    setIsStored(false);
    toast.success('API key removed');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenRouter API Key</CardTitle>
        <CardDescription>
          Your API key is encrypted and stored only on this device.
          Get your key from <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStored ? (
          <div className="flex items-center gap-4">
            <Badge variant="success">API Key Configured</Badge>
            <Button variant="destructive" onClick={handleRemove}>
              Remove Key
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={handleSave} disabled={!apiKey}>
              Save API Key
            </Button>
          </div>
        )}

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Privacy</AlertTitle>
          <AlertDescription>
            Your API key is encrypted and stored locally. It never leaves your device
            and is sent directly to OpenRouter (not our servers).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
```

---

## Server-Side Streaming (Current)

### Current Implementation

```typescript
// src/routes/api/chat.ts
export const Route = createFileRoute('/api/chat')({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { chatId, messages, modelId } = await request.json();

        // Get user's API key from server database
        const apiKey = await getDecryptedApiKey(context.user.id);

        // Create OpenRouter client
        const openrouter = createOpenRouter({ apiKey });

        // Stream response
        const result = streamText({
          model: openrouter(modelId),
          messages,
        });

        return result.toDataStreamResponse();
      },
    },
  },
});
```

### Client Hook

```typescript
// src/lib/client/hooks/use-chat-stream.ts
import { useChat } from '@ai-sdk/react';

export function useChatStream({ chatId, initialMessages, initialModel }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    id: chatId,
    api: '/api/chat',
    body: {
      chatId,
      modelId: initialModel,
    },
    initialMessages,
  });

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  };
}
```

---

## OpenRouter Integration

### Get Available Models

```typescript
// Client-side
export async function getOpenRouterModels(apiKey: string) {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  const { data } = await response.json();

  return data.map((model: any) => ({
    id: model.id,
    name: model.name,
    context_length: model.context_length,
    pricing: {
      prompt: model.pricing.prompt,
      completion: model.pricing.completion,
    },
    top_provider: model.top_provider,
  }));
}
```

### Model Selection

```typescript
// src/components/model-selector.tsx
export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState([]);

  useEffect(() => {
    getApiKey().then(async (apiKey) => {
      if (apiKey) {
        const models = await getOpenRouterModels(apiKey);
        setModels(models);
      }
    });
  }, []);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

## Message Management

### Message Format (AI SDK v5)

```typescript
interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  createdAt?: Date;
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: any }
  | { type: 'tool-result'; toolCallId: string; result: any };
```

### Save to Local Database

```typescript
// src/lib/client/actions/message-actions.ts
export async function saveLocalMessages(
  chatId: string,
  messages: UIMessage[]
) {
  const db = await getClientDb();

  for (const msg of messages) {
    // Check if message already exists
    const existing = await db.query.message.findFirst({
      where: (message, { eq }) => eq(message.id, msg.id),
    });

    if (existing) continue; // Skip existing messages

    // Insert message
    await db.insert(message).values({
      id: msg.id,
      chatId,
      role: msg.role,
      order: messages.indexOf(msg),
      createdAt: msg.createdAt || new Date(),
    });

    // Insert message parts
    for (const part of msg.parts) {
      if (part.type === 'text') {
        await db.insert(messagePart).values({
          id: nanoid(),
          messageId: msg.id,
          type: 'text',
          order: msg.parts.indexOf(part),
          textContent: part.text,
        });
      }
      // Handle other part types...
    }
  }
}
```

### Load from Local Database

```typescript
export async function getLocalMessages(chatId: string): Promise<UIMessage[]> {
  const db = await getClientDb();

  const messages = await db.query.message.findMany({
    where: (message, { eq }) => eq(message.chatId, chatId),
    with: {
      parts: {
        orderBy: (part, { asc }) => [asc(part.order)],
      },
    },
    orderBy: (message, { asc }) => [asc(message.order)],
  });

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    parts: msg.parts
      .filter((part) => part.type === 'text')
      .map((part) => ({
        type: 'text' as const,
        text: part.textContent || '',
      })),
    createdAt: msg.createdAt,
  }));
}
```

---

## Best Practices

### 1. Encrypt API Keys

```typescript
// ✅ GOOD - Encrypt before storing
const encrypted = await encryptApiKey(key);
localStorage.setItem('api_key', encrypted);

// ❌ BAD - Store plaintext
localStorage.setItem('api_key', key);
```

### 2. Validate API Key Format

```typescript
// OpenRouter keys start with sk-or-
if (!key.startsWith('sk-or-')) {
  throw new Error('Invalid OpenRouter API key');
}
```

### 3. Handle API Errors Gracefully

```typescript
useChat({
  onError: (error) => {
    if (error.message.includes('401')) {
      toast.error('Invalid API key. Please check your settings.');
    } else if (error.message.includes('429')) {
      toast.error('Rate limit exceeded. Please try again later.');
    } else {
      toast.error('An error occurred. Please try again.');
    }
  },
});
```

### 4. Show API Key Status

```typescript
function ApiKeyIndicator() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    getApiKey().then(key => setHasKey(!!key));
  }, []);

  return (
    <div className="flex items-center gap-2">
      {hasKey ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span>API Key Configured</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <Link to="/dashboard/settings">Add API Key</Link>
        </>
      )}
    </div>
  );
}
```

### 5. Implement Retry Logic

```typescript
useChat({
  maxRetries: 2,
  retryDelay: 1000,
  onError: (error) => {
    console.error('Chat error after retries:', error);
  },
});
```

---

## Troubleshooting

### API Key Not Working

**Problem:** Getting 401 errors

**Solutions:**
1. Verify key starts with `sk-or-`
2. Check key is not expired at openrouter.ai
3. Ensure encryption/decryption is working correctly

### CORS Errors

**Problem:** CORS errors when calling OpenRouter directly

**Solution:** OpenRouter supports CORS for web apps:
```typescript
headers: {
  'HTTP-Referer': window.location.origin,
  'X-Title': 'Your App Name',
}
```

### Messages Not Saving

**Problem:** Messages disappear after refresh

**Solution:** Ensure `onFinish` callback is saving to local DB:
```typescript
useChat({
  onFinish: async ({ messages }) => {
    await saveLocalMessages(chatId, messages);
  },
});
```

### Rate Limiting

**Problem:** Getting 429 errors

**Solutions:**
1. Implement client-side rate limiting
2. Show user they're being rate limited
3. Add retry with exponential backoff

---

## Migration Path

### From Server-Side to Client-Side

**Step 1:** Add client-side API key storage
**Step 2:** Create client-side chat hook
**Step 3:** Update components to use client hook
**Step 4:** Remove server `/api/chat` route
**Step 5:** Update message saving to local DB only

**Benefits:**
- Maximum privacy
- No server costs
- Simpler architecture
- Users control their own keys

**Trade-offs:**
- API keys in browser (encrypted)
- Can't hide API usage from dev tools
- Rate limits per client IP

---

## Additional Resources

- [AI SDK Docs](https://sdk.vercel.ai/docs)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [OpenRouter API Keys](https://openrouter.ai/keys)
- [@ai-sdk/react Docs](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)

---

**Last Updated:** 2025-11-17
**Status:** Complete
**Recommendation:** Implement client-side streaming for maximum privacy
