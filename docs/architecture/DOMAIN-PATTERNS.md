# Domain Patterns

This document defines the canonical patterns for each domain in the codebase. These patterns represent "how we do things" and should be followed when writing new code.

> **Status**: Draft - Pending validation against package best practices (see [DOMAIN-PATTERN-INVESTIGATION.md](./DOMAIN-PATTERN-INVESTIGATION.md))

---

## Table of Contents

1. [Routes Domain](#1-routes-domain-srcroutes)
2. [Server Domain](#2-server-domain-srcserver)
3. [Client Domain](#3-client-domain-srcclient)
4. [Components Domain](#4-components-domain-srccomponents)
5. [Integrations Domain](#5-integrations-domain-srcintegrations)
6. [Types Domain](#6-types-domain-srctypes)
7. [Shared Utilities](#7-shared-utilities-srclib)

---

## 1. Routes Domain (`src/routes/`)

File-based routing with TanStack Router. Contains page components, layouts, and API endpoints.

### File Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `__root.tsx` | `__root.tsx` | Root HTML shell |
| `index.tsx` | `dashboard/index.tsx` | Index route for directory |
| `$param.tsx` | `c.$chatId.tsx` | Dynamic route parameter |
| `$.ts` | `api/auth/$.ts` | Catch-all route |
| `.tsx` | `login.tsx` | Page route (React component) |
| `.ts` | `api/chat.ts` | API route (no UI) |

### Page Route Template

```typescript
// src/routes/feature.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FeatureComponent } from "@/components/feature/feature-component";
import { getFeatureData } from "@/server/actions/feature-actions";

export const Route = createFileRoute("/feature")({
  component: FeatureView,

  // Optional: Pre-loader for auth/context setup
  beforeLoad: async () => {
    const user = await getUser();
    return { user };
  },

  // Optional: Data loading with TanStack Query integration
  loader: async ({ context, params }) => {
    // Auth guard
    if (!context.user) {
      throw redirect({ to: "/login" });
    }

    // Data fetching with query client
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["feature", params.id],
      queryFn: () => getFeatureData(params.id),
    });

    // Not found handling
    if (!data) {
      throw notFound();
    }

    return { data };
  },
});

function FeatureView() {
  const { data } = Route.useLoaderData();

  return <FeatureComponent data={data} />;
}
```

### Layout Route Template

```typescript
// src/routes/dashboard.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { getUser } from "@/server/actions/auth-actions";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,

  beforeLoad: async () => {
    const user = await getUser();
    return { user };
  },

  loader: async ({ context }) => {
    if (!context?.user) {
      throw redirect({ to: "/login" });
    }
    return { user: context.user };
  },
});

function DashboardLayout() {
  const { user } = Route.useLoaderData();

  return (
    <div>
      <AppSidebar user={user} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

### API Route Template

```typescript
// src/routes/api/feature.ts
import { createFileRoute } from "@tanstack/react-router";
import { protectedMiddleware } from "@/server/middleware/protected-middleware";

export const Route = createFileRoute("/api/feature")({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        try {
          // 1. Parse request
          const body = await request.json();
          const { field1, field2 } = body as { field1: string; field2?: string };

          // 2. Validate
          if (!field1) {
            return new Response(
              JSON.stringify({ error: "Missing required field: field1" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // 3. Business logic
          const { db } = context.config;
          const result = await db.query.table.findFirst({
            where: (t, { eq }) => eq(t.userId, context.user.id),
          });

          // 4. Return response
          return new Response(
            JSON.stringify({ success: true, data: result }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );

        } catch (error) {
          console.error("API error:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error"
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
```

### Key Patterns

- **Component naming**: Use descriptive names (`ChatView`, `SettingsView`) for feature pages
- **Data access**: Always use `Route.useLoaderData()` in components
- **Navigation**: Use `<Link to="/path" />` for declarative, `useNavigate()` for programmatic
- **Auth guards**: Check in `loader`, redirect with `throw redirect({ to: "/login" })`
- **Error handling**: Use `throw notFound()` for 404s

---

## 2. Server Domain (`src/server/`)

All server-side code including server functions, middleware, database, and authentication.

### Directory Structure

```
src/server/
├── actions/          # Server functions (createServerFn)
├── middleware/       # Request middleware chain
├── db/              # Database layer and schema
├── auth/            # Better Auth configuration
├── utils/           # Server utilities
└── config.ts        # Per-request config loader
```

### Per-Request Config Pattern

**CRITICAL**: Cloudflare Workers requires per-request I/O isolation.

```typescript
// src/server/config.ts
export const loadConfig = createServerOnlyFn(() => {
  const db = createDb();
  const auth = getAuth(db);

  return {
    env: process.env,
    db,
    auth,
  };
});
```

**Never do this:**
```typescript
// BAD: Module-level instances
const db = createDb();
export { db };
```

### Middleware Chain Pattern

```typescript
// 1. Global Middleware - Loads config
export const globalMiddleware = createMiddleware().server(({ next }) => {
  const config = loadConfig();
  return next({ context: { config } });
});

// 2. Auth Middleware - Extends global, adds session/user
export const authMiddleware = createMiddleware()
  .middleware([globalMiddleware])
  .server(async ({ next, request, context }) => {
    const data = await context.config.auth.api.getSession(request);
    return next({
      context: {
        session: data?.session ?? null,
        user: data?.user ?? null,
      },
    });
  });

// 3. Protected Middleware - Extends auth, enforces authentication
export const protectedMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user) {
      throw json({ error: "Unauthorized" }, { status: 401 });
    }
    return next({ context: { ...context, user: context.user } });
  });
```

### Server Action Template

```typescript
// src/server/actions/feature-actions.ts
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { featureTable } from "../db/schema";
import { protectedMiddleware } from "../middleware/protected-middleware";

export const createFeature = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    const newFeature = {
      id: nanoid(),
      userId: context.user.id,
      name: data.name,
      description: data.description || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(featureTable).values(newFeature);

    return newFeature;
  });

export const getFeatures = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;

    return db
      .select()
      .from(featureTable)
      .where(eq(featureTable.userId, context.user.id))
      .orderBy(desc(featureTable.createdAt));
  });

export const deleteFeature = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    await db
      .delete(featureTable)
      .where(
        and(
          eq(featureTable.id, data.id),
          eq(featureTable.userId, context.user.id) // ALWAYS filter by userId
        )
      );

    return { success: true };
  });
```

### Database Schema Pattern

```typescript
// src/server/db/schema.ts
import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const feature = pgTable(
  "feature",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("feature_user_idx").on(table.userId),
  ],
);

export const featureRelations = relations(feature, ({ one }) => ({
  user: one(user, {
    fields: [feature.userId],
    references: [user.id],
  }),
}));
```

### Key Patterns

- **Middleware selection**: Use `[protectedMiddleware]` for authenticated actions
- **Context access**: Always `const { db } = context.config;`
- **ID generation**: Use `nanoid()` for all IDs
- **Security**: ALL queries must filter by `context.user.id`
- **Validation**: Use Zod schemas with `.inputValidator()`
- **Return values**: Return data directly (auto-serialized)

---

## 3. Client Domain (`src/client/`)

All client-side code including hooks, stores, local database, and client actions.

### Directory Structure

```
src/client/
├── hooks/            # React hooks (TanStack Query wrappers)
├── stores/           # Zustand stores (UI state only)
├── actions/          # Client-side database operations
├── queries/          # TanStack Query configurations
├── db/               # PGlite local database
├── storage/          # localStorage utilities
├── utils/            # Client utilities
└── auth.ts           # Auth client
```

### Query Keys Factory Pattern

```typescript
// src/client/hooks/use-features.ts
export const featureKeys = {
  all: (userId: string) => ["features", userId] as const,
  lists: (userId: string) => [...featureKeys.all(userId), "list"] as const,
  list: (userId: string, filters?: { status?: string }) =>
    [...featureKeys.lists(userId), filters] as const,
  details: (userId: string) => [...featureKeys.all(userId), "detail"] as const,
  detail: (userId: string, id: string) =>
    [...featureKeys.details(userId), id] as const,
};
```

### Query Hook Template

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
    queryFn: () => getFeatureById(featureId, userId),
    enabled: !!userId && !!featureId,
  });
}
```

### Mutation Hook Template (with Optimistic Updates)

```typescript
export function useCreateFeature(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      createFeature({ userId, ...data }),

    onSuccess: (newFeature) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });
      // Add to detail cache
      queryClient.setQueryData(
        featureKeys.detail(userId, newFeature.id),
        newFeature
      );
    },
  });
}

export function useUpdateFeature(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Feature> }) =>
      updateFeature(id, userId, data),

    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: featureKeys.detail(userId, id),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData(featureKeys.detail(userId, id));

      // Optimistically update
      if (previous) {
        queryClient.setQueryData(featureKeys.detail(userId, id), {
          ...previous,
          ...data,
          updatedAt: new Date(),
        });
      }

      return { previous };
    },

    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(featureKeys.detail(userId, id), context.previous);
      }
    },

    onSettled: (_data, _error, { id }) => {
      // Refetch for consistency
      queryClient.invalidateQueries({ queryKey: featureKeys.detail(userId, id) });
      queryClient.invalidateQueries({ queryKey: featureKeys.lists(userId) });
    },
  });
}
```

### Zustand Store Template

```typescript
// src/client/stores/feature-store.ts
import { create } from "zustand";

interface FeatureStoreState {
  selectedId: string | null;
  filterStatus: string | null;
  isCreateModalOpen: boolean;
}

interface FeatureStoreActions {
  setSelectedId: (id: string | null) => void;
  setFilterStatus: (status: string | null) => void;
  setIsCreateModalOpen: (open: boolean) => void;
  reset: () => void;
}

const initialState: FeatureStoreState = {
  selectedId: null,
  filterStatus: null,
  isCreateModalOpen: false,
};

export const useFeatureStore = create<FeatureStoreState & FeatureStoreActions>(
  (set) => ({
    ...initialState,
    setSelectedId: (selectedId) => set({ selectedId }),
    setFilterStatus: (filterStatus) => set({ filterStatus }),
    setIsCreateModalOpen: (isCreateModalOpen) => set({ isCreateModalOpen }),
    reset: () => set(initialState),
  })
);
```

### Client Action Template

```typescript
// src/client/actions/feature-actions.ts
import { and, eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getClientDb } from "@/client/db";
import { feature } from "@/client/db/schema";

export async function createFeature(data: {
  userId: string;
  name: string;
  description?: string;
}): Promise<typeof feature.$inferSelect> {
  const db = await getClientDb();

  const newFeature = {
    id: nanoid(),
    userId: data.userId,
    name: data.name,
    description: data.description || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [created] = await db.insert(feature).values(newFeature).returning();

  return created;
}

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

### localStorage Wrapper Template

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

### Key Patterns

- **TanStack Query for server/DB state**: All data fetching wrapped in `useQuery`/`useMutation`
- **Zustand for UI state only**: Modal open state, filters, selections - NOT for data
- **Query key factories**: Hierarchical, composable, type-safe
- **Optimistic updates**: `onMutate` (snapshot + update) → `onError` (rollback) → `onSettled` (refetch)
- **SSR safety**: Always check `typeof window === "undefined"` in storage utilities
- **User isolation**: All queries filter by `userId`

---

## 4. Components Domain (`src/components/`)

React UI components organized by feature area.

### Directory Structure

```
src/components/
├── ui/               # shadcn/ui primitives
├── chat/             # Chat feature components
├── nav/              # Navigation components
└── shared/           # Shared utilities (error boundaries)
```

### UI Component Template (CVA Variants)

```typescript
// src/components/ui/example.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const exampleVariants = cva(
  "base-classes here",
  {
    variants: {
      variant: {
        default: "default-styles",
        secondary: "secondary-styles",
        destructive: "destructive-styles",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Example({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof exampleVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="example"
      className={cn(exampleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Example, exampleVariants };
```

### UI Component Template (Simple Wrapper)

```typescript
// src/components/ui/simple.tsx
import type * as React from "react";

import { cn } from "@/lib/utils";

function Simple({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="simple"
      className={cn(
        "base-classes",
        "focus-classes",
        "state-classes",
        className,
      )}
      {...props}
    />
  );
}

export { Simple };
```

### Feature Component Template

```typescript
// src/components/feature/feature-card.tsx
import { Edit, Trash } from "lucide-react";
import { useState } from "react";
import { useFeatureStore } from "@/client/stores/feature-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteFeature } from "@/client/hooks/use-features";
import { cn } from "@/lib/utils";
import type { DB_Feature } from "@/types";

interface FeatureCardProps {
  feature: DB_Feature;
  userId: string;
  onEdit: (feature: DB_Feature) => void;
}

export function FeatureCard({ feature, userId, onEdit }: FeatureCardProps) {
  // 1. Global state (Zustand)
  const selectedId = useFeatureStore((state) => state.selectedId);
  const setSelectedId = useFeatureStore((state) => state.setSelectedId);

  // 2. Server state (TanStack Query)
  const deleteFeature = useDeleteFeature(userId);

  // 3. Local UI state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // 4. Event handlers
  const handleDelete = async () => {
    try {
      await deleteFeature.mutateAsync({ id: feature.id });
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete. Please try again.");
    }
  };

  // 5. Render
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all",
        selectedId === feature.id && "ring-2 ring-primary"
      )}
      onClick={() => setSelectedId(feature.id)}
    >
      <CardHeader>
        <CardTitle>{feature.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{feature.description}</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onEdit(feature)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteFeature.isPending}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Key Patterns

- **UI components**: CVA for variants, `cn()` for class merging, `data-slot` for debugging
- **Feature components**: Compose UI primitives, integrate hooks/stores
- **Props typing**: `React.ComponentProps<"element">` + custom interface
- **Styling**: Tailwind only, multi-line `cn()` for complex styles
- **Exports**: Named exports only (no default exports)
- **Import order**: lucide-react → react → client stores → UI components → hooks → utilities

---

## 5. Integrations Domain (`src/integrations/`)

Third-party API clients and external service integrations.

### Directory Structure

```
src/integrations/
├── openrouter/
│   └── client.ts     # Factory, API methods, types
└── tavily/
    └── web-search.ts # Tool wrapper
```

### Integration Client Template

```typescript
// src/integrations/service/client.ts
import { ServiceSDK } from "@service/sdk";

/**
 * Creates Service client instance with the provided API key
 * Used for [primary purpose]
 *
 * @param apiKey - User's Service API key
 * @returns Service client instance
 */
export function createServiceClient(apiKey: string) {
  return ServiceSDK.create({
    apiKey,
    headers: {
      "HTTP-Referer": process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : process.env.APP_URL,
      "X-Title": "Uni-Chat",
    },
  });
}

/**
 * Fetches resources from Service API
 *
 * @param apiKey - User's Service API key
 * @returns Promise with resources data
 */
export async function fetchServiceResources(apiKey: string) {
  const client = new ServiceSDK({ apiKey });
  const resources = await client.resources.list();
  return resources;
}

// Derive type from return value
export type ServiceResource = Awaited<
  ReturnType<typeof fetchServiceResources>
>["data"][number];
```

### Tool Integration Template

```typescript
// src/integrations/service/tool.ts
import { tool } from "ai";
import { z } from "zod";
import { ServiceSDK } from "@service/sdk";

export function initServiceTool(apiKey: string) {
  const client = ServiceSDK({ apiKey });

  return tool({
    description: "Description of what this tool does",
    inputSchema: z.object({
      query: z.string().min(1).max(100).describe("Input description"),
    }),
    execute: async ({ query }) => {
      const response = await client.execute(query);

      // Transform to normalized format
      return response.results.map((result) => ({
        id: result.id,
        content: result.content,
      }));
    },
  });
}
```

### Key Patterns

- **Factory functions**: `create[Service]Client(apiKey)` for per-request isolation
- **Standalone methods**: `fetch[Service][Resource](apiKey)` for specific operations
- **Type derivation**: `Awaited<ReturnType<typeof fn>>["data"][number]`
- **Single file**: Each integration in one file, no separate types.ts
- **Error delegation**: No try/catch, errors bubble to callers
- **No business logic**: Thin wrappers only

---

## 6. Types Domain (`src/types/`)

Shared TypeScript type definitions used across domains.

### Directory Structure

```
src/types/
├── index.ts     # Re-exports all types
├── chat.ts      # Message part types
└── models.ts    # Model and DB types
```

### Type File Template

```typescript
// src/types/feature.ts
import type { ExternalType } from "external-lib";
import type { DB_Feature } from "@/client/db/schema";
import type { serverAction } from "@/server/actions/feature-actions";

// Type aliases for clarity
type FeatureId = DB_Feature["id"];
type UserId = string;

// Infer from function returns
type FeatureData = Awaited<ReturnType<typeof serverAction>>;

// Compose external types
type CustomFeature = ExternalType<{
  customField: string;
}>;

export type {
  FeatureId,
  UserId,
  FeatureData,
  CustomFeature,
  DB_Feature, // Re-export from domain
};
```

### Index Re-export Pattern

```typescript
// src/types/index.ts
export * from "./chat";
export * from "./models";
export * from "./feature";
```

### When to Add Types Here

**DO add types when:**
- Used by 3+ domains (client + server + components)
- Cross-domain contracts (shared API shapes)
- Composed from external libraries with app customization

**DON'T add types when:**
- Only used within single domain
- Zod schema inference types
- Integration-specific types
- Component-local interfaces

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `DB_` prefix | `DB_Chat`, `DB_Message` | Database table types |
| `Custom` prefix | `CustomUIMessage` | Extended external types |
| `Id` suffix | `ChatId`, `UserId` | ID type aliases |
| Descriptive | `Model`, `ModelName` | Inferred types |

---

## 7. Shared Utilities (`src/lib/`)

Contains the `cn()` function for Tailwind class merging.

### cn() Function

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```typescript
import { cn } from "@/lib/utils";

// Basic usage
className={cn("base-class", className)}

// Conditional classes
className={cn(
  "base-class",
  isActive && "active-class",
  variant === "primary" && "primary-class"
)}

// Multi-line for complex styles
className={cn(
  "flex items-center justify-center",
  "rounded-md border",
  "focus:outline-none focus:ring-2",
  className
)}
```

---

## Import Order Convention

All files should follow this import order:

```typescript
// 1. External libraries
import { something } from "external-package";
import { Icon } from "lucide-react";
import { useState } from "react";

// 2. Internal - Client domain
import { useFeatures } from "@/client/hooks/use-features";
import { useFeatureStore } from "@/client/stores/feature-store";

// 3. Internal - Server domain
import { getFeatures } from "@/server/actions/feature-actions";

// 4. Internal - Components
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/feature/feature-card";

// 5. Internal - Integrations
import { createServiceClient } from "@/integrations/service/client";

// 6. Internal - Types (type-only imports)
import type { DB_Feature } from "@/types";

// 7. Internal - Utilities
import { cn } from "@/lib/utils";
```

---

## Export Conventions

| Domain | Export Style |
|--------|--------------|
| Routes | `export const Route = ...` |
| Server Actions | Named exports: `export const actionName = ...` |
| Client Hooks | Named exports: `export function useFeature() {}` |
| Client Actions | Named exports: `export async function action() {}` |
| Stores | Named exports: `export const useStore = create(...)` |
| Components | Named exports: `export function Component() {}` |
| Integrations | Named exports: `export function createClient() {}` |
| Types | Named type exports: `export type { TypeName }` |

**No default exports anywhere in the codebase.**
