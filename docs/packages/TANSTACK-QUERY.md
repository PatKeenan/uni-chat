# TanStack Query Documentation

**Package:** `@tanstack/react-query`
**Version:** 5.x
**Purpose:** Data fetching and caching library for React
**Last Updated:** 2025-11-17

---

## Table of Contents
1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Basic Concepts](#basic-concepts)
4. [Query Hooks](#query-hooks)
5. [Mutation Hooks](#mutation-hooks)
6. [Advanced Patterns](#advanced-patterns)
7. [Integration with Local Database](#integration-with-local-database)
8. [Best Practices](#best-practices)
9. [Common Patterns for Our Project](#common-patterns-for-our-project)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is TanStack Query?

TanStack Query (formerly React Query) is a powerful data synchronization library that:
- Manages server state in React applications
- Provides caching, background refetching, and stale data management
- Reduces boilerplate for loading/error states
- Optimizes performance with automatic request deduplication

### Why TanStack Query for This Project?

**Perfect for Local-First Architecture:**
1. **Cache Management:** Automatically caches local database queries
2. **Optimistic Updates:** Built-in support for optimistic UI updates
3. **Background Sync:** Refetch data when window regains focus
4. **Dev Tools:** Excellent debugging experience
5. **Type Safety:** Full TypeScript support

---

## Installation & Setup

### Install Package

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

### Setup Query Client

```typescript
// src/router.tsx or App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Configuration Options

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data is considered fresh (no refetch)
      staleTime: 1000 * 60 * 5, // 5 min

      // How long inactive data stays in cache
      gcTime: 1000 * 60 * 30, // 30 min

      // Number of retries on error
      retry: 1,

      // Refetch when window regains focus
      refetchOnWindowFocus: true,

      // Refetch on mount if data is stale
      refetchOnMount: true,

      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Default retry for mutations
      retry: 0,
    },
  },
});
```

---

## Basic Concepts

### Query Keys

Query keys uniquely identify queries and are used for caching.

```typescript
// Simple key
useQuery({ queryKey: ['chats'] });

// With parameters
useQuery({ queryKey: ['chat', chatId] });

// Hierarchical keys
useQuery({ queryKey: ['chats', userId, { folderId }] });
```

**Best Practices:**
- Use arrays for keys
- Include all variables that affect the query
- Order matters: `['chats', '123']` ≠ `['123', 'chats']`
- Objects are compared by value

### Query States

```typescript
const { data, isLoading, isError, error, isSuccess } = useQuery({
  queryKey: ['chats'],
  queryFn: fetchChats,
});
```

**States:**
- `isLoading`: Query is running for first time (no cached data)
- `isFetching`: Query is running (may have cached data)
- `isError`: Query encountered an error
- `isSuccess`: Query completed successfully
- `data`: The query data (undefined initially)
- `error`: Error object if query failed

### Stale vs Fresh Data

```
Fresh → Can use cached data without refetching
Stale → Will refetch in background on mount/focus
```

Configure with `staleTime`:
```typescript
useQuery({
  queryKey: ['chats'],
  queryFn: fetchChats,
  staleTime: 1000 * 60 * 5, // Fresh for 5 minutes
});
```

---

## Query Hooks

### useQuery - Basic Usage

```typescript
import { useQuery } from '@tanstack/react-query';
import { getClientDb } from '@/lib/client/db';

function useChats(userId: string) {
  return useQuery({
    queryKey: ['chats', userId],
    queryFn: async () => {
      const db = await getClientDb();
      return await db.query.chat.findMany({
        where: (chat, { eq }) => eq(chat.userId, userId),
        orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
      });
    },
  });
}

// In component
function ChatList() {
  const { data: chats, isLoading, error } = useChats('user-123');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {chats?.map(chat => (
        <ChatItem key={chat.id} chat={chat} />
      ))}
    </div>
  );
}
```

### useQuery - With Options

```typescript
function useChat(chatId: string) {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      const db = await getClientDb();
      const chat = await db.query.chat.findFirst({
        where: (chat, { eq }) => eq(chat.id, chatId),
        with: {
          messages: {
            with: {
              parts: true,
            },
          },
        },
      });

      if (!chat) {
        throw new Error('Chat not found');
      }

      return chat;
    },

    // Options
    staleTime: 1000 * 60, // 1 minute
    enabled: !!chatId,    // Only run if chatId exists
    retry: 2,             // Retry twice on failure
    refetchInterval: false, // Don't auto-refetch

    // Callbacks
    onSuccess: (data) => {
      console.log('Chat loaded:', data.id);
    },
    onError: (error) => {
      console.error('Failed to load chat:', error);
    },
  });
}
```

### useQueries - Multiple Queries

```typescript
import { useQueries } from '@tanstack/react-query';

function useChatDetails(chatIds: string[]) {
  return useQueries({
    queries: chatIds.map(chatId => ({
      queryKey: ['chat', chatId],
      queryFn: () => fetchChat(chatId),
    })),
  });
}

// In component
const results = useChatDetails(['chat-1', 'chat-2', 'chat-3']);

// Check if all loaded
const allLoaded = results.every(r => r.isSuccess);

// Get all data
const chats = results.map(r => r.data).filter(Boolean);
```

### useInfiniteQuery - Pagination

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

function useInfiniteChats(userId: string) {
  return useInfiniteQuery({
    queryKey: ['chats', 'infinite', userId],
    queryFn: async ({ pageParam = 0 }) => {
      const db = await getClientDb();
      const chats = await db.query.chat.findMany({
        where: (chat, { eq }) => eq(chat.userId, userId),
        limit: 20,
        offset: pageParam * 20,
        orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
      });

      return {
        chats,
        nextPage: chats.length === 20 ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}

// In component
function InfiniteChatList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteChats('user-123');

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.chats.map(chat => (
            <ChatItem key={chat.id} chat={chat} />
          ))}
        </div>
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

---

## Mutation Hooks

### useMutation - Basic Usage

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientDb } from '@/lib/client/db';
import { nanoid } from 'nanoid';

function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; selectedModel: string }) => {
      const db = await getClientDb();

      const newChat = {
        id: nanoid(),
        userId: 'user-123', // Get from auth context
        title: data.title,
        selectedModel: data.selectedModel,
        createdAt: new Date(),
        updatedAt: new Date(),
        pinned: false,
      };

      const [created] = await db.insert(chat).values(newChat).returning();
      return created;
    },

    // Invalidate queries after success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

// In component
function NewChatButton() {
  const createChat = useCreateChat();

  const handleCreate = () => {
    createChat.mutate({
      title: 'New Chat',
      selectedModel: 'gpt-4',
    });
  };

  return (
    <button
      onClick={handleCreate}
      disabled={createChat.isPending}
    >
      {createChat.isPending ? 'Creating...' : 'New Chat'}
    </button>
  );
}
```

### useMutation - With Optimistic Updates

```typescript
function useUpdateChatTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      const db = await getClientDb();
      await db.update(chat)
        .set({ title, updatedAt: new Date() })
        .where(eq(chat.id, chatId));
    },

    // Optimistic update
    onMutate: async ({ chatId, title }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['chats'] });

      // Snapshot previous value
      const previousChats = queryClient.getQueryData(['chats']);

      // Optimistically update cache
      queryClient.setQueryData(['chats'], (old: Chat[]) =>
        old?.map(chat =>
          chat.id === chatId ? { ...chat, title } : chat
        )
      );

      // Return context with previous value
      return { previousChats };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      queryClient.setQueryData(['chats'], context?.previousChats);
    },

    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}
```

### useMutation - With Callbacks

```typescript
function useDeleteChat() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (chatId: string) => {
      const db = await getClientDb();
      await db.delete(chat).where(eq(chat.id, chatId));
    },

    onSuccess: (data, chatId) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['chats'] });

      // Navigate away
      navigate('/dashboard');

      // Show toast
      toast.success('Chat deleted');
    },

    onError: (error) => {
      toast.error('Failed to delete chat');
      console.error(error);
    },
  });
}
```

---

## Advanced Patterns

### Manual Cache Updates

```typescript
const queryClient = useQueryClient();

// Get cached data
const chats = queryClient.getQueryData(['chats']);

// Set cached data
queryClient.setQueryData(['chats'], newChats);

// Update cached data
queryClient.setQueryData(['chats'], (old: Chat[]) => {
  return [...old, newChat];
});
```

### Invalidate Queries

```typescript
const queryClient = useQueryClient();

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ['chats'] });

// Invalidate multiple queries
queryClient.invalidateQueries({ queryKey: ['chats', userId] });

// Invalidate all queries starting with 'chats'
queryClient.invalidateQueries({ queryKey: ['chats'] });
```

### Refetch Queries

```typescript
const queryClient = useQueryClient();

// Refetch specific query
await queryClient.refetchQueries({ queryKey: ['chats'] });

// Refetch all active queries
await queryClient.refetchQueries({ type: 'active' });
```

### Prefetch Data

```typescript
const queryClient = useQueryClient();

// Prefetch before navigation
await queryClient.prefetchQuery({
  queryKey: ['chat', chatId],
  queryFn: () => fetchChat(chatId),
});
```

### Dependent Queries

```typescript
function useChatMessages(chatId?: string) {
  // Only run if chatId exists
  return useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => fetchMessages(chatId!),
    enabled: !!chatId, // Dependent on chatId
  });
}

// In component
function ChatView({ chatId }: { chatId?: string }) {
  const { data: messages } = useChatMessages(chatId);

  if (!chatId) return <div>Select a chat</div>;

  return <MessageList messages={messages} />;
}
```

---

## Integration with Local Database

### Pattern: Local Database Queries

```typescript
// src/lib/client/hooks/use-local-chats.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientDb } from '@/lib/client/db';
import { chat } from '@/lib/client/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export function useLocalChats(userId: string) {
  const queryClient = useQueryClient();

  // Query
  const query = useQuery({
    queryKey: ['chats', 'local', userId],
    queryFn: async () => {
      const db = await getClientDb();
      return await db.query.chat.findMany({
        where: (chat, { eq }) => eq(chat.userId, userId),
        orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
      });
    },
    staleTime: 1000 * 60, // 1 minute
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { title?: string; selectedModel: string }) => {
      const db = await getClientDb();

      const newChat = {
        id: nanoid(),
        userId,
        title: data.title,
        selectedModel: data.selectedModel,
        createdAt: new Date(),
        updatedAt: new Date(),
        pinned: false,
      };

      const [created] = await db.insert(chat).values(newChat).returning();
      return created;
    },

    onSuccess: (newChat) => {
      // Optimistically add to cache
      queryClient.setQueryData(['chats', 'local', userId], (old: Chat[] = []) => [
        newChat,
        ...old,
      ]);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Chat> }) => {
      const db = await getClientDb();
      await db.update(chat)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(chat.id, id));
    },

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['chats', 'local', userId] });

      const previous = queryClient.getQueryData(['chats', 'local', userId]);

      queryClient.setQueryData(['chats', 'local', userId], (old: Chat[]) =>
        old?.map(c => (c.id === id ? { ...c, ...data } : c))
      );

      return { previous };
    },

    onError: (err, variables, context) => {
      queryClient.setQueryData(['chats', 'local', userId], context?.previous);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const db = await getClientDb();
      await db.delete(chat).where(eq(chat.id, chatId));
    },

    onMutate: async (chatId) => {
      await queryClient.cancelQueries({ queryKey: ['chats', 'local', userId] });

      const previous = queryClient.getQueryData(['chats', 'local', userId]);

      queryClient.setQueryData(['chats', 'local', userId], (old: Chat[]) =>
        old?.filter(c => c.id !== chatId)
      );

      return { previous };
    },

    onError: (err, variables, context) => {
      queryClient.setQueryData(['chats', 'local', userId], context?.previous);
    },
  });

  return {
    chats: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createChat: createMutation.mutateAsync,
    updateChat: updateMutation.mutateAsync,
    deleteChat: deleteMutation.mutateAsync,
  };
}
```

**Usage:**
```typescript
function ChatList() {
  const {
    chats,
    isLoading,
    createChat,
    updateChat,
    deleteChat,
  } = useLocalChats('user-123');

  const handleCreate = async () => {
    await createChat({
      title: 'New Chat',
      selectedModel: 'gpt-4',
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleCreate}>New Chat</button>
      {chats.map(chat => (
        <ChatItem
          key={chat.id}
          chat={chat}
          onDelete={() => deleteChat(chat.id)}
          onUpdate={(data) => updateChat({ id: chat.id, data })}
        />
      ))}
    </div>
  );
}
```

---

## Best Practices

### 1. Use Query Keys Consistently

```typescript
// ✅ GOOD - Consistent structure
const QUERY_KEYS = {
  chats: (userId: string) => ['chats', userId] as const,
  chat: (chatId: string) => ['chat', chatId] as const,
  messages: (chatId: string) => ['messages', chatId] as const,
};

// Usage
useQuery({ queryKey: QUERY_KEYS.chats(userId), ... });

// ❌ BAD - Inconsistent keys
useQuery({ queryKey: ['chats', userId], ... });
useQuery({ queryKey: ['user', userId, 'chats'], ... });
```

### 2. Handle Loading & Error States

```typescript
function ChatList() {
  const { data, isLoading, isError, error } = useChats();

  if (isLoading) {
    return <Skeleton count={5} />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return <div>{/* Render chats */}</div>;
}
```

### 3. Use Optimistic Updates for Better UX

```typescript
// User sees immediate feedback
queryClient.setQueryData(['chats'], (old) => [...old, newChat]);

// Then update database in background
await db.insert(chat).values(newChat);
```

### 4. Invalidate Related Queries

```typescript
// After creating a chat, invalidate chat list
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['chats'] });
  queryClient.invalidateQueries({ queryKey: ['folders'] }); // If folders show counts
}
```

### 5. Use Stale Time Appropriately

```typescript
// Frequently changing data
staleTime: 1000 * 30, // 30 seconds

// Stable data
staleTime: 1000 * 60 * 5, // 5 minutes

// Static data
staleTime: Infinity,
```

---

## Common Patterns for Our Project

### Pattern 1: Chat List with Folders

```typescript
export function useChatsByFolder(userId: string, folderId?: string) {
  return useQuery({
    queryKey: ['chats', userId, { folderId }],
    queryFn: async () => {
      const db = await getClientDb();

      const conditions = [eq(chat.userId, userId)];
      if (folderId) {
        conditions.push(eq(chat.folderId, folderId));
      }

      return await db.query.chat.findMany({
        where: (chat, { and, eq }) => and(...conditions),
        orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
      });
    },
  });
}
```

### Pattern 2: Search with Debounce

```typescript
import { useDebounce } from '@/hooks/use-debounce';

export function useSearchChats(userId: string, searchTerm: string) {
  const debouncedSearch = useDebounce(searchTerm, 300);

  return useQuery({
    queryKey: ['chats', 'search', userId, debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];

      const db = await getClientDb();
      return await db.query.chat.findMany({
        where: (chat, { and, eq, like }) =>
          and(
            eq(chat.userId, userId),
            like(chat.title, `%${debouncedSearch}%`)
          ),
      });
    },
    enabled: debouncedSearch.length > 0,
  });
}
```

### Pattern 3: Real-time Updates

```typescript
// Poll for updates (for demo purposes)
export function useRealtimeChats(userId: string) {
  return useQuery({
    queryKey: ['chats', userId],
    queryFn: fetchChats,
    refetchInterval: 1000 * 30, // Poll every 30 seconds
  });
}
```

---

## Troubleshooting

### Query Not Refetching

**Problem:** Data isn't updating

**Solutions:**
1. Check `staleTime` - data might still be fresh
2. Verify `enabled` option is not false
3. Manually invalidate: `queryClient.invalidateQueries({ queryKey: ['chats'] })`

### Memory Leaks

**Problem:** Too much data in cache

**Solutions:**
1. Set `gcTime` appropriately
2. Remove unused queries: `queryClient.removeQueries({ queryKey: ['old-data'] })`
3. Clear cache on logout

### Type Errors

**Problem:** TypeScript errors with query data

**Solution:** Type your query functions:
```typescript
useQuery<Chat[]>({
  queryKey: ['chats'],
  queryFn: async (): Promise<Chat[]> => {
    // ...
  },
});
```

---

## Additional Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [TanStack Query DevTools](https://tanstack.com/query/latest/docs/react/devtools)
- [TanStack Query Examples](https://tanstack.com/query/latest/docs/react/examples)

---

**Last Updated:** 2025-11-17
**Status:** Complete
**Next:** See [TANSTACK-ROUTER.md](./TANSTACK-ROUTER.md) for routing patterns
