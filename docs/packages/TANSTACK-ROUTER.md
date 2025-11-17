# TanStack Router/Start Documentation

**Package:** `@tanstack/react-router` + `@tanstack/react-start`
**Version:** 1.x
**Purpose:** Type-safe routing for React with SSR support
**Last Updated:** 2025-11-17

---

## Table of Contents
1. [Overview](#overview)
2. [Key Concepts](#key-concepts)
3. [File-Based Routing](#file-based-routing)
4. [Route Loaders](#route-loaders)
5. [Navigation](#navigation)
6. [TanStack Start (SSR)](#tanstack-start-ssr)
7. [Patterns for Our Project](#patterns-for-our-project)
8. [Best Practices](#best-practices)

---

## Overview

### What is TanStack Router?

TanStack Router is a fully type-safe router for React with:
- File-based routing
- Type-safe navigation
- Data loaders
- Nested layouts
- Search params management

### TanStack Start

TanStack Start builds on TanStack Router to add:
- Server-side rendering (SSR)
- Server functions
- API routes
- Deployed to Cloudflare Workers in our case

---

## Key Concepts

### Routes as Files

```
src/routes/
├── __root.tsx              # Root layout
├── index.tsx               # /
├── dashboard.tsx           # /dashboard (layout)
├── dashboard/
│   ├── index.tsx           # /dashboard (index)
│   ├── c.$chatId.tsx       # /dashboard/c/:chatId
│   ├── new.tsx             # /dashboard/new
│   └── settings.tsx        # /dashboard/settings
└── api/
    └── chat.ts             # /api/chat
```

### Route Definition

```typescript
// src/routes/dashboard/c.$chatId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/c/$chatId')({
  // Loader runs on server/client before render
  loader: async ({ params }) => {
    const chat = await getChatById(params.chatId);
    return { chat };
  },

  // Component to render
  component: ChatView,
});

function ChatView() {
  const { chat } = Route.useLoaderData();
  return <div>{chat.title}</div>;
}
```

---

## File-Based Routing

### Route File Naming

```typescript
// Static routes
index.tsx               → /
about.tsx               → /about
dashboard.tsx           → /dashboard

// Dynamic params
$id.tsx                 → /:id
users.$userId.tsx       → /users/:userId
c.$chatId.tsx           → /c/:chatId

// Nested layouts
dashboard.tsx           → /dashboard (layout with <Outlet />)
dashboard/index.tsx     → /dashboard (content)
dashboard/settings.tsx  → /dashboard/settings

// Optional params
$.tsx                   → Catch-all route
```

### Layout Routes

```typescript
// src/routes/dashboard.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <Outlet /> {/* Child routes render here */}
      </main>
    </div>
  );
}
```

### Accessing Route Params

```typescript
// src/routes/dashboard/c.$chatId.tsx
export const Route = createFileRoute('/dashboard/c/$chatId')({
  component: ChatView,
});

function ChatView() {
  const { chatId } = Route.useParams(); // Type-safe!
  return <div>Chat ID: {chatId}</div>;
}
```

---

## Route Loaders

### Client-Side Loader

```typescript
// Runs on client only
export const Route = createFileRoute('/dashboard/c/$chatId')({
  loader: async ({ params }) => {
    const db = await getClientDb();

    const chat = await db.query.chat.findFirst({
      where: (chat, { eq }) => eq(chat.id, params.chatId),
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    return { chat };
  },
  component: ChatView,
});
```

### With Search Params

```typescript
export const Route = createFileRoute('/dashboard/models')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      filter: (search.filter as string) || 'all',
      sort: (search.sort as 'name' | 'price') || 'name',
    };
  },

  loader: async ({ search }) => {
    const models = await getModels({
      filter: search.filter,
      sort: search.sort,
    });

    return { models };
  },

  component: ModelsView,
});

function ModelsView() {
  const { models } = Route.useLoaderData();
  const { filter, sort } = Route.useSearch();

  return <ModelList models={models} filter={filter} sort={sort} />;
}
```

### Loader Context

```typescript
export const Route = createFileRoute('/dashboard')({
  loader: async ({ params, search, context }) => {
    // Access router context
    console.log(context.user);

    return {};
  },
});
```

---

## Navigation

### Link Component

```typescript
import { Link } from '@tanstack/react-router';

// Basic link
<Link to="/dashboard">Dashboard</Link>

// With params
<Link to="/dashboard/c/$chatId" params={{ chatId: 'chat-123' }}>
  View Chat
</Link>

// With search params
<Link
  to="/dashboard/models"
  search={{ filter: 'favorites', sort: 'name' }}
>
  View Models
</Link>

// Active styling
<Link
  to="/dashboard"
  activeProps={{ className: 'font-bold text-blue-600' }}
>
  Dashboard
</Link>
```

### Programmatic Navigation

```typescript
import { useNavigate } from '@tanstack/react-router';

function MyComponent() {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to route
    navigate({ to: '/dashboard' });

    // With params
    navigate({
      to: '/dashboard/c/$chatId',
      params: { chatId: 'chat-123' },
    });

    // With search params
    navigate({
      to: '/dashboard/models',
      search: { filter: 'favorites' },
    });

    // Go back
    navigate({ to: '..', });
  };

  return <button onClick={handleClick}>Navigate</button>;
}
```

### useRouter Hook

```typescript
import { useRouter } from '@tanstack/react-router';

function MyComponent() {
  const router = useRouter();

  // Invalidate route (refetch loader)
  router.invalidate();

  // Get current location
  console.log(router.state.location);

  // Navigate
  router.navigate({ to: '/dashboard' });
}
```

---

## TanStack Start (SSR)

### Server Functions

```typescript
// src/lib/server/actions/chat-actions.ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const getChatById = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ chatId: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    const chat = await db.query.chat.findFirst({
      where: (chat, { eq }) => eq(chat.id, data.chatId),
    });

    return chat;
  });

// Call from client
const chat = await getChatById({ data: { chatId: 'chat-123' } });
```

### API Routes

```typescript
// src/routes/api/chat.ts
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/chat')({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const body = await request.json();

        // Process request
        const result = await processChat(body);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
```

### Middleware

```typescript
// src/lib/server/middleware/auth-middleware.ts
import { createMiddleware } from '@tanstack/react-start';

export const authMiddleware = createMiddleware().server(async ({ next, context }) => {
  const session = await context.config.auth.getSession();

  return next({
    context: {
      ...context,
      session,
      user: session?.user,
    },
  });
});
```

---

## Patterns for Our Project

### Pattern 1: Protected Route

```typescript
// src/routes/dashboard/c.$chatId.tsx
export const Route = createFileRoute('/dashboard/c/$chatId')({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login' });
    }
  },

  loader: async ({ params, context }) => {
    const db = await getClientDb();

    const chat = await db.query.chat.findFirst({
      where: (chat, { and, eq }) =>
        and(
          eq(chat.id, params.chatId),
          eq(chat.userId, context.user.id)
        ),
    });

    if (!chat) {
      throw redirect({ to: '/dashboard' });
    }

    return { chat };
  },

  component: ChatView,
});
```

### Pattern 2: Redirect After Create

```typescript
function NewChatButton() {
  const navigate = useNavigate();

  const handleCreate = async () => {
    const chat = await createLocalChat({
      selectedModel: 'gpt-4',
      title: 'New Chat',
    });

    // Navigate to new chat
    navigate({
      to: '/dashboard/c/$chatId',
      params: { chatId: chat.id },
    });
  };

  return <button onClick={handleCreate}>New Chat</button>;
}
```

### Pattern 3: Search Params for Filters

```typescript
// src/routes/dashboard/models.tsx
export const Route = createFileRoute('/dashboard/models')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      provider: search.provider as string | undefined,
      starred: search.starred === 'true',
    };
  },

  loader: async ({ search }) => {
    const db = await getClientDb();

    let query = db.query.starredModel.findMany();

    if (search.provider) {
      query = query.where((model, { eq }) =>
        eq(model.provider, search.provider!)
      );
    }

    return { models: await query };
  },

  component: ModelsView,
});

function ModelsView() {
  const { models } = Route.useLoaderData();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const setProvider = (provider: string) => {
    navigate({
      search: { ...search, provider },
    });
  };

  return (
    <div>
      <select value={search.provider} onChange={(e) => setProvider(e.target.value)}>
        <option value="">All Providers</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
      </select>

      <ModelList models={models} />
    </div>
  );
}
```

### Pattern 4: Layout with Sidebar

```typescript
// src/routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb />
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

---

## Best Practices

### 1. Type-Safe Navigation

```typescript
// ✅ GOOD - Type-safe
navigate({
  to: '/dashboard/c/$chatId',
  params: { chatId: chat.id },
});

// ❌ BAD - String URLs (lose type safety)
navigate({ to: `/dashboard/c/${chat.id}` });
```

### 2. Use Loaders for Data

```typescript
// ✅ GOOD - Loader fetches data
export const Route = createFileRoute('/dashboard/c/$chatId')({
  loader: async ({ params }) => {
    return { chat: await fetchChat(params.chatId) };
  },
  component: ChatView,
});

// ❌ BAD - useEffect fetches data
function ChatView() {
  const [chat, setChat] = useState(null);

  useEffect(() => {
    fetchChat(chatId).then(setChat);
  }, [chatId]);

  return <div>{chat?.title}</div>;
}
```

### 3. Handle Loading States

```typescript
export const Route = createFileRoute('/dashboard/c/$chatId')({
  loader: async ({ params }) => {
    const chat = await fetchChat(params.chatId);
    return { chat };
  },

  pendingComponent: () => <Skeleton />,
  errorComponent: ({ error }) => <ErrorAlert error={error} />,
  component: ChatView,
});
```

### 4. Validate Search Params

```typescript
// ✅ GOOD - Validate search params
export const Route = createFileRoute('/dashboard/models')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      filter: z.enum(['all', 'favorites']).parse(search.filter ?? 'all'),
      page: z.number().int().positive().parse(Number(search.page) || 1),
    };
  },
});

// ❌ BAD - No validation
const searchParams = new URLSearchParams(location.search);
const filter = searchParams.get('filter'); // Could be anything!
```

---

## Additional Resources

- [TanStack Router Docs](https://tanstack.com/router/latest)
- [TanStack Start Docs](https://tanstack.com/start/latest)
- [TanStack Router Examples](https://tanstack.com/router/latest/docs/framework/react/examples)

---

**Last Updated:** 2025-11-17
**Status:** Complete
**Next:** See [AI-SDK.md](./AI-SDK.md) for client-side AI streaming
