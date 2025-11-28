# Client Domain Best Practices Guide

> **Purpose**: This document is the authoritative source of truth for coding standards and best practices within the `src/client/` domain. It is used by AI coding agents for implementation and by senior AI reviewers for gatekeeping code changes.

**Domain Path**: `src/client/`
**Last Updated**: 2025-11-26
**Status**: Active

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [Directory Structure](#2-directory-structure)
3. [TanStack Query Patterns](#3-tanstack-query-patterns)
4. [Zustand Store Patterns](#4-zustand-store-patterns)
5. [PGlite Database Patterns](#5-pglite-database-patterns)
6. [Client Actions Patterns](#6-client-actions-patterns)
7. [Auth Client Patterns](#7-auth-client-patterns)
8. [localStorage Patterns](#8-localstorage-patterns)
9. [Import/Export Conventions](#9-importexport-conventions)
10. [Validation Checklist](#10-validation-checklist)

---

## 1. Domain Overview

The Client domain contains all browser-only code including:
- React hooks (TanStack Query wrappers)
- Zustand stores (UI state management)
- Client actions (PGlite database operations)
- Local database (PGlite + Drizzle ORM)
- Auth client (Better Auth React)
- localStorage utilities

### Key Principles

1. **No server imports** - Never import from `@/server/*`
2. **SSR safety** - Always guard browser APIs with `typeof window` checks
3. **User isolation** - All queries must filter by `userId`
4. **Type safety** - Use Drizzle's `$inferSelect` for return types
5. **Singleton database** - Always use `getClientDb()`, never create instances

---

## 2. Directory Structure

```
src/client/
├── hooks/            # React hooks (TanStack Query wrappers)
│   ├── use-local-chats.ts
│   ├── use-local-messages.ts
│   ├── use-local-folders.ts
│   ├── use-models.ts
│   ├── use-data-management.ts
│   ├── use-chat-stream.ts
│   └── use-mobile.ts
├── stores/           # Zustand stores (UI state only)
│   └── chat-store.ts
├── actions/          # Client-side database operations
│   ├── chat-actions.ts
│   ├── message-actions.ts
│   ├── folder-actions.ts
│   ├── model-actions.ts
│   └── data-actions.ts
├── queries/          # TanStack Query configurations
│   └── auth-queries.ts
├── db/               # PGlite local database
│   ├── index.ts
│   ├── migrations.ts
│   └── schema/
├── storage/          # localStorage utilities
│   ├── api-key.ts
│   ├── default-model.ts
│   └── tavily-api-key.ts
├── utils/            # Client utilities
│   ├── generate-chat-title.ts
│   └── to-ui-message.ts
└── auth.ts           # Auth client
```

---

## 3. TanStack Query Patterns

### 3.1 Query Key Factories

Query keys MUST use hierarchical factory functions for cache management.

#### ✅ DO: Hierarchical Query Key Factory

```typescript
// src/client/hooks/use-feature.ts
export const featureKeys = {
  all: (userId: string) => ["features", userId] as const,
  lists: (userId: string) => [...featureKeys.all(userId), "list"] as const,
  list: (userId: string, filters?: { status?: string }) =>
    [...featureKeys.lists(userId), filters] as const,
  details: (userId: string) => [...featureKeys.all(userId), "detail"] as const,
  detail: (userId: string, featureId: string) =>
    [...featureKeys.details(userId), featureId] as const,
};
```

**Requirements:**
- Use `as const` for type inference
- Include `userId` in all keys for user isolation
- Build hierarchically using spread operator
- Export from the same file as the hooks

#### ❌ DON'T: Scattered String Keys

```typescript
// BAD: Plain strings scattered throughout code
const { data } = useQuery({
  queryKey: ["features"],  // Missing userId!
  queryFn: () => getFeatures(userId),
});

// BAD: Inconsistent key structure
queryClient.invalidateQueries({ queryKey: ["feature", id] });
queryClient.invalidateQueries({ queryKey: ["features-list"] });
```

**Why this is wrong:**
- Missing `userId` breaks user isolation
- Inconsistent keys cause cache misses
- No type safety for invalidation

---

### 3.2 Query Hooks

#### ✅ DO: Standard Query Hook Pattern

```typescript
export function useFeatures(userId: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: featureKeys.list(userId, filters),
    queryFn: () => getFeatures(userId, filters),
    enabled: !!userId,
  });
}

export function useFeature(userId: string, featureId: string) {
  return useQuery({
    queryKey: featureKeys.detail(userId, featureId),
    queryFn: () => getFeatureById(userId, featureId),
    enabled: !!userId && !!featureId,
  });
}
```

**Requirements:**
- Always use `enabled` to guard against missing params
- Query key and queryFn params must match
- Return the `useQuery` result directly

#### ❌ DON'T: Missing Guards or Mismatched Keys

```typescript
// BAD: No enabled guard
export function useFeature(userId: string, featureId: string) {
  return useQuery({
    queryKey: featureKeys.detail(userId, featureId),
    queryFn: () => getFeatureById(userId, featureId),
    // Missing: enabled: !!userId && !!featureId
  });
}

// BAD: Key doesn't match queryFn params
export function useFeatures(userId: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: featureKeys.list(userId),  // Missing filters!
    queryFn: () => getFeatures(userId, filters),
  });
}
```

---

### 3.3 Mutation Hooks

#### ✅ DO: Simple Invalidation Pattern (Default)

Use for most mutations where optimistic updates aren't needed:

```typescript
export function useCreateFeature(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeatureInput) => createFeature(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });
    },
  });
}

export function useDeleteFeature(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (featureId: string) => deleteFeature(userId, featureId),
    onSuccess: (_, featureId) => {
      queryClient.removeQueries({
        queryKey: featureKeys.detail(userId, featureId),
      });
      queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });
    },
  });
}
```

#### ✅ DO: Optimistic Update Pattern (When Needed)

Use for updates where immediate UI feedback is important:

```typescript
export function useUpdateFeature(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureId, data }: { featureId: string; data: UpdateInput }) =>
      updateFeature(userId, featureId, data),

    // Phase 1: Optimistic update
    onMutate: async ({ featureId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: featureKeys.detail(userId, featureId),
      });

      // Snapshot previous value
      const previousFeature = queryClient.getQueryData<Feature>(
        featureKeys.detail(userId, featureId)
      );

      // Optimistically update cache
      if (previousFeature) {
        queryClient.setQueryData(featureKeys.detail(userId, featureId), {
          ...previousFeature,
          ...data,
          updatedAt: new Date(),
        });
      }

      // Return context for rollback
      return { previousFeature };
    },

    // Phase 2: Rollback on error
    onError: (_err, { featureId }, context) => {
      if (context?.previousFeature) {
        queryClient.setQueryData(
          featureKeys.detail(userId, featureId),
          context.previousFeature
        );
      }
    },

    // Phase 3: Refetch for consistency
    onSettled: (_data, _error, { featureId }) => {
      queryClient.invalidateQueries({
        queryKey: featureKeys.detail(userId, featureId),
      });
      queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });
    },
  });
}
```

**Requirements for optimistic updates:**
1. `onMutate`: Cancel queries, snapshot, update, return context
2. `onError`: Rollback using context
3. `onSettled`: Invalidate for server consistency

#### ❌ DON'T: Incomplete Optimistic Updates

```typescript
// BAD: No rollback mechanism
onMutate: async ({ featureId, data }) => {
  queryClient.setQueryData(featureKeys.detail(userId, featureId), {
    ...data,
  });
  // Missing: cancelQueries, snapshot, return context
},

// BAD: Using onSuccess instead of onSettled
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });
  // Wrong: onSettled should be used (runs on both success AND error)
},
```

---

### 3.4 Cache Invalidation

#### ✅ DO: Prefix Invalidation for Related Queries

```typescript
// Invalidate all feature lists (keeps detail caches)
queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });

// Invalidate specific detail
queryClient.invalidateQueries({
  queryKey: featureKeys.detail(userId, featureId),
});

// Invalidate everything for a user
queryClient.invalidateQueries({ queryKey: featureKeys.all(userId) });
```

#### ❌ DON'T: Over-Invalidation

```typescript
// BAD: Invalidates ALL queries in the app
queryClient.invalidateQueries();

// BAD: Wrong key structure
queryClient.invalidateQueries({ queryKey: ["features"] }); // Missing userId
```

---

## 4. Zustand Store Patterns

### 4.1 Store Definition

#### ✅ DO: Separate State and Actions Interfaces

```typescript
// src/client/stores/feature-store.ts
import { create } from "zustand";

interface FeatureStoreState {
  selectedId: string | null;
  filterStatus: string | null;
  isModalOpen: boolean;
}

interface FeatureStoreActions {
  setSelectedId: (id: string | null) => void;
  setFilterStatus: (status: string | null) => void;
  setIsModalOpen: (open: boolean) => void;
  reset: () => void;
}

const initialState: FeatureStoreState = {
  selectedId: null,
  filterStatus: null,
  isModalOpen: false,
};

export const useFeatureStore = create<FeatureStoreState & FeatureStoreActions>(
  (set) => ({
    ...initialState,
    setSelectedId: (selectedId) => set({ selectedId }),
    setFilterStatus: (filterStatus) => set({ filterStatus }),
    setIsModalOpen: (isModalOpen) => set({ isModalOpen }),
    reset: () => set(initialState),
  })
);
```

**Requirements:**
- Separate `State` and `Actions` interfaces
- Combine with intersection type `&`
- Define `initialState` for reset functionality
- Use simple setters with `set()`

#### ❌ DON'T: Mixed Interfaces or Derived State

```typescript
// BAD: Combined interface
interface FeatureStore {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  // Mixed state and actions
}

// BAD: Storing derived state
interface FeatureStoreState {
  modelMetadata: Model | null;
  capabilities: ModelCapabilities; // DERIVED from modelMetadata!
}

setModel: (model, metadata) => {
  const capabilities = extractCapabilities(metadata); // Computing derived state
  return set({ model, metadata, capabilities }); // Storing it - BAD!
}
```

---

### 4.2 Derived State

#### ✅ DO: Compute in Custom Hooks

```typescript
// src/client/stores/chat-store.ts

// Store only holds raw state
interface ChatStoreState {
  model?: ModelName;
  modelMetadata: Model | null;
}

// Export custom hook for derived state
export function useModelCapabilities(): ModelCapabilities {
  return useChatStore((state) => extractModelCapabilities(state.modelMetadata));
}

// The extraction function (pure, no store dependency)
export function extractModelCapabilities(model: Model | null): ModelCapabilities {
  if (!model) {
    return { supportsToolCalls: false, supportsImageOutput: false };
  }
  return {
    supportsToolCalls: model.supportedParameters?.includes("tools") ?? false,
    supportsImageOutput: model.architecture?.outputModalities?.includes("image") ?? false,
  };
}
```

#### ❌ DON'T: Store Derived State

```typescript
// BAD: Derived state stored in store
interface ChatStoreState {
  modelMetadata: Model | null;
  capabilities: ModelCapabilities; // This is derived!
}

// BAD: Computing and storing on update
setModel: (model, metadata) => {
  const capabilities = extractModelCapabilities(metadata);
  return set({ model, modelMetadata: metadata, capabilities });
}
```

**Why this is wrong:**
- Creates dual source of truth
- Risk of state becoming out of sync
- Violates Zustand best practices

---

### 4.3 Store Consumption

#### ✅ DO: Always Use Selectors

```typescript
// GOOD: Individual selectors - minimal re-renders
function MyComponent() {
  const selectedId = useFeatureStore((state) => state.selectedId);
  const setSelectedId = useFeatureStore((state) => state.setSelectedId);

  // Component only re-renders when selectedId changes
}

// GOOD: Multiple selectors with useShallow (if needed)
import { useShallow } from "zustand/react/shallow";

function MyComponent() {
  const { selectedId, filterStatus } = useFeatureStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      filterStatus: state.filterStatus,
    }))
  );
}
```

#### ❌ DON'T: Destructure Without Selector

```typescript
// BAD: Subscribes to entire store - re-renders on ANY change
function MyComponent() {
  const { selectedId, setSelectedId } = useFeatureStore();
  // This component re-renders when filterStatus changes too!
}

// BAD: New object in selector without useShallow
const { a, b } = useFeatureStore((state) => ({ a: state.a, b: state.b }));
// Creates new object reference every time - triggers re-renders
```

---

### 4.4 Imperative Access

#### ✅ DO: Use getState() for Non-Reactive Access

```typescript
// GOOD: In event handlers where you don't need reactivity
const handleSubmit = async () => {
  const input = useChatStore.getState().input;
  useChatStore.getState().setInput("");

  await sendMessage(input);
};
```

#### ❌ DON'T: Use getState() in Render

```typescript
// BAD: Won't update when state changes
function MyComponent() {
  const input = useChatStore.getState().input; // Not reactive!
  return <div>{input}</div>;
}
```

---

### 4.5 Store Scope

#### ✅ DO: Store These in Zustand
- UI state shared across components (selected item, filters)
- Modal/dialog open states
- Loading states that affect multiple components
- User preferences (if not persisted elsewhere)

#### ❌ DON'T: Store These in Zustand
- **Form state** - Use `useState` or React Hook Form
- **Server data** - Use TanStack Query
- **Temporary UI state** - Use local `useState`
- **Derived/computed values** - Use custom hooks

---

## 5. PGlite Database Patterns

### 5.1 Database Access

#### ✅ DO: Always Use getClientDb()

```typescript
// src/client/actions/feature-actions.ts
import { getClientDb } from "@/client/db";

export async function getFeatures(userId: string) {
  const db = await getClientDb();

  return db.query.feature.findMany({
    where: (feature, { eq }) => eq(feature.userId, userId),
    orderBy: (feature, { desc }) => [desc(feature.updatedAt)],
  });
}
```

**Requirements:**
- Always `await getClientDb()` at the start of every action
- Assign to variable named `db`
- Never store db reference at module level

#### ❌ DON'T: Create Database Instances

```typescript
// BAD: Module-level instance
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite("idb://my-db"); // NEVER do this!

// BAD: Creating new instances
export async function getFeatures() {
  const pg = await PGlite.create({ dataDir: "idb://my-db" });
  // Creates competing instances!
}

// BAD: Caching db reference
let cachedDb: PgliteDatabase | null = null;
export async function getFeatures() {
  if (!cachedDb) cachedDb = await getClientDb();
  // getClientDb already handles caching!
}
```

---

### 5.2 Database Configuration

#### ✅ DO: Use relaxedDurability

```typescript
// src/client/db/index.ts
pgliteClient = await PGlite.create({
  dataDir: "idb://uni-chat-local",
  relaxedDurability: true, // Required for browser performance
});
```

**Why:**
- Without: Every query waits for IndexedDB flush (~milliseconds)
- With: Queries return immediately, flush async
- Trade-off: Minimal data loss risk on browser crash (acceptable)

---

### 5.3 Query Patterns

#### ✅ DO: Use Drizzle Query API

```typescript
// FindFirst with conditions
export async function getFeatureById(
  userId: string,
  featureId: string
): Promise<typeof feature.$inferSelect | null> {
  const db = await getClientDb();

  const result = await db.query.feature.findFirst({
    where: (feature, { eq, and }) =>
      and(eq(feature.id, featureId), eq(feature.userId, userId)),
  });

  return result || null;
}

// FindMany with filters and ordering
export async function getFeatures(
  userId: string,
  options?: { status?: string }
): Promise<Array<typeof feature.$inferSelect>> {
  const db = await getClientDb();

  const conditions = [eq(feature.userId, userId)];

  if (options?.status) {
    conditions.push(eq(feature.status, options.status));
  }

  return db.query.feature.findMany({
    where: and(...conditions),
    orderBy: [desc(feature.updatedAt)],
  });
}
```

#### ✅ DO: Always Filter by userId

```typescript
// GOOD: Every query includes userId check
await db.query.feature.findMany({
  where: (f, { eq }) => eq(f.userId, userId),
});

// GOOD: Updates and deletes include userId
await db
  .update(feature)
  .set({ title: newTitle })
  .where(and(eq(feature.id, featureId), eq(feature.userId, userId)));

await db
  .delete(feature)
  .where(and(eq(feature.id, featureId), eq(feature.userId, userId)));
```

#### ❌ DON'T: Query Without User Isolation

```typescript
// BAD: No userId filter - security vulnerability!
await db.query.feature.findFirst({
  where: (f, { eq }) => eq(f.id, featureId),
});

// BAD: Delete without userId check
await db.delete(feature).where(eq(feature.id, featureId));
```

---

### 5.4 Insert/Update Patterns

#### ✅ DO: Use nanoid for IDs, Manual Timestamps

```typescript
import { nanoid } from "nanoid";

export async function createFeature(data: CreateFeatureInput) {
  const db = await getClientDb();

  const newFeature = {
    id: nanoid(),
    userId: data.userId,
    title: data.title,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [created] = await db.insert(feature).values(newFeature).returning();
  return created;
}

export async function updateFeature(
  featureId: string,
  userId: string,
  data: Partial<UpdateFeatureInput>
) {
  const db = await getClientDb();

  await db
    .update(feature)
    .set({
      ...data,
      updatedAt: new Date(), // Always update timestamp
    })
    .where(and(eq(feature.id, featureId), eq(feature.userId, userId)));
}
```

---

### 5.5 Return Types

#### ✅ DO: Use Drizzle Type Inference

```typescript
import { feature } from "@/client/db/schema";

// Single item
export async function getFeature(
  userId: string,
  featureId: string
): Promise<typeof feature.$inferSelect | null> {
  // ...
}

// Array
export async function getFeatures(
  userId: string
): Promise<Array<typeof feature.$inferSelect>> {
  // ...
}

// Void for mutations
export async function deleteFeature(
  userId: string,
  featureId: string
): Promise<void> {
  // ...
}
```

---

## 6. Client Actions Patterns

### 6.1 Action Structure

#### ✅ DO: Standard Action Template

```typescript
// src/client/actions/feature-actions.ts
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getClientDb } from "@/client/db";
import { feature } from "@/client/db/schema";

// 1. Define Zod schema for validation
export const CreateFeatureSchema = z.object({
  userId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
});

// 2. Export type from schema
export type CreateFeatureInput = z.infer<typeof CreateFeatureSchema>;

// 3. Implement action
export async function createFeature(
  input: CreateFeatureInput
): Promise<typeof feature.$inferSelect> {
  // Validate input (optional - can rely on TypeScript)
  const data = CreateFeatureSchema.parse(input);

  const db = await getClientDb();

  const newFeature = {
    id: nanoid(),
    userId: data.userId,
    title: data.title,
    description: data.description || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [created] = await db.insert(feature).values(newFeature).returning();
  return created;
}
```

---

### 6.2 Error Handling

#### ✅ DO: Consistent Error Strategy

For data operations that can fail gracefully:

```typescript
export interface ActionResult {
  success: boolean;
  message: string;
  itemsAffected?: number;
}

export async function clearAllData(userId: string): Promise<ActionResult> {
  const db = await getClientDb();

  try {
    const deleted = await db
      .delete(feature)
      .where(eq(feature.userId, userId))
      .returning();

    return {
      success: true,
      message: `Deleted ${deleted.length} items`,
      itemsAffected: deleted.length,
    };
  } catch (error) {
    console.error("[FeatureActions] Failed to clear data:", error);
    return {
      success: false,
      message: "Failed to clear data. Please try again.",
    };
  }
}
```

For critical operations that should throw:

```typescript
export async function getFeatureOrThrow(
  userId: string,
  featureId: string
): Promise<typeof feature.$inferSelect> {
  const db = await getClientDb();

  const result = await db.query.feature.findFirst({
    where: (f, { eq, and }) =>
      and(eq(f.id, featureId), eq(f.userId, userId)),
  });

  if (!result) {
    throw new Error("Feature not found or access denied");
  }

  return result;
}
```

---

### 6.3 Avoiding Circular Dependencies

#### ✅ DO: Dynamic Imports for Cross-Action Calls

```typescript
// src/client/actions/message-actions.ts
export async function saveMessage(input: SaveMessageInput) {
  const db = await getClientDb();

  // ... save message ...

  // Dynamic import to avoid circular dependency
  const { touchChat } = await import("./chat-actions");
  await touchChat(input.chatId, input.userId);
}
```

---

## 7. Auth Client Patterns

### 7.1 Client Definition

#### ✅ DO: Single Instance with Destructuring

```typescript
// src/client/auth.ts
import { createAuthClient } from "better-auth/react";

export const { useSession, signIn, signOut, signUp, getSession } =
  createAuthClient({
    baseURL:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://your-production-url.com",
  });
```

**Requirements:**
- Create ONE client instance
- Destructure all needed exports from that instance
- Export the destructured functions/hooks

#### ❌ DON'T: Multiple Client Instances

```typescript
// BAD: Creates TWO separate client instances with different state!
export const authClient = createAuthClient({ baseURL: "..." });
export const { useSession } = createAuthClient(); // SECOND INSTANCE!

// This causes hydration errors and inconsistent state
```

---

### 7.2 Using useSession

#### ✅ DO: Handle Loading and Error States

```typescript
import { useSession } from "@/client/auth";

function UserProfile() {
  const { data: session, isPending, error } = useSession();

  if (isPending) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!session) return <LoginPrompt />;

  return <div>Welcome, {session.user.name}</div>;
}
```

#### ❌ DON'T: Assume Session Exists

```typescript
// BAD: No loading/error handling
function UserProfile() {
  const { data: session } = useSession();
  return <div>Welcome, {session.user.name}</div>; // Crashes if null!
}
```

---

### 7.3 Server vs Client Session

#### ✅ DO: Use Correct Method for Context

```typescript
// CLIENT: In React components/hooks
import { useSession } from "@/client/auth";
const { data: session } = useSession();

// CLIENT: In route loaders (still client-side)
import { getSession } from "@/client/auth";
const session = await getSession();

// SERVER: In server functions (NOT authClient!)
import { auth } from "@/server/auth";
const session = await auth.api.getSession({ headers: request.headers });
```

#### ❌ DON'T: Use authClient on Server

```typescript
// BAD: authClient is client-only!
// In a server function:
import { getSession } from "@/client/auth";
const session = await getSession(); // Won't work on server!
```

---

## 8. localStorage Patterns

### 8.1 SSR-Safe Wrappers

#### ✅ DO: Always Guard with typeof window

```typescript
// src/client/storage/feature-preference.ts
const STORAGE_KEY = "feature_preference";

export function getFeaturePreference(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setFeaturePreference(value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, value);
}

export function removeFeaturePreference(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasFeaturePreference(): boolean {
  const value = getFeaturePreference();
  return value !== null && value.trim() !== "";
}
```

**Requirements:**
- Every function must check `typeof window === "undefined"`
- Return `null` or `void` for SSR case
- Use descriptive, namespaced storage keys

#### ❌ DON'T: Direct localStorage Access

```typescript
// BAD: Will crash during SSR
export function getPreference(): string | null {
  return localStorage.getItem("preference");
}

// BAD: Short, non-namespaced key
const STORAGE_KEY = "pref"; // Too generic, collision risk
```

---

### 8.2 Storage Key Naming

#### ✅ DO: Namespaced, Descriptive Keys

```typescript
const API_KEY_STORAGE_KEY = "openrouter_api_key";
const DEFAULT_MODEL_STORAGE_KEY = "default_model";
const TAVILY_API_KEY_STORAGE_KEY = "tavily_api_key";
```

#### ❌ DON'T: Generic Keys

```typescript
const KEY = "key";           // Too generic
const API = "api";           // Collision risk
const data = "data";         // Not descriptive
```

---

## 9. Import/Export Conventions

### 9.1 Import Order

```typescript
// 1. External libraries
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

// 2. Internal - Client domain
import { getClientDb } from "@/client/db";
import { feature } from "@/client/db/schema";
import { useFeatureStore } from "@/client/stores/feature-store";

// 3. Internal - Types (type-only imports)
import type { Feature } from "@/types";
```

### 9.2 Export Style

```typescript
// Named exports ONLY - no default exports
export const featureKeys = { ... };
export function useFeatures() { ... }
export async function createFeature() { ... }
export const useFeatureStore = create(...);

// Type exports
export type { CreateFeatureInput };
```

---

## 10. Validation Checklist

Use this checklist to validate Client domain code changes:

### Query Hooks
- [ ] Uses hierarchical query key factory
- [ ] Query key includes `userId` for user isolation
- [ ] `enabled` option guards against missing params
- [ ] Query key params match `queryFn` params

### Mutations
- [ ] Uses `invalidateQueries` in `onSuccess` or `onSettled`
- [ ] Optimistic updates include all three phases (if used)
- [ ] Uses `removeQueries` for deleted items

### Zustand Stores
- [ ] Separate `State` and `Actions` interfaces
- [ ] No derived state stored in store
- [ ] All consumers use selector pattern
- [ ] No full store destructuring

### Database Actions
- [ ] Uses `await getClientDb()` (not module-level instance)
- [ ] All queries filter by `userId`
- [ ] Uses `nanoid()` for ID generation
- [ ] Uses `new Date()` for timestamps
- [ ] Return type uses `typeof table.$inferSelect`

### Auth Client
- [ ] Single `createAuthClient()` call
- [ ] Destructured exports from same instance
- [ ] `useSession` handles `isPending` and `error`

### localStorage
- [ ] All functions have `typeof window` guard
- [ ] Storage keys are namespaced and descriptive

### General
- [ ] No imports from `@/server/*`
- [ ] Named exports only (no default exports)
- [ ] Proper import order

---

## References

### Official Documentation
- [TanStack Query v5](https://tanstack.com/query/v5/docs)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [PGlite](https://pglite.dev/docs/)
- [Better Auth](https://www.better-auth.com/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs)

### Community Best Practices
- [TkDodo's React Query Blog](https://tkdodo.eu/blog/)
- [TkDodo's Working with Zustand](https://tkdodo.eu/blog/working-with-zustand)

### Codebase Examples
- Query keys: [use-local-chats.ts](../../src/client/hooks/use-local-chats.ts)
- Zustand store: [chat-store.ts](../../src/client/stores/chat-store.ts)
- Client actions: [chat-actions.ts](../../src/client/actions/chat-actions.ts)
- Database setup: [db/index.ts](../../src/client/db/index.ts)
- Auth client: [auth.ts](../../src/client/auth.ts)
- localStorage: [storage/api-key.ts](../../src/client/storage/api-key.ts)
