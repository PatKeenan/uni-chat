# Routes Domain Best Practices Guide

> **Status:** Validated
> **Last Updated:** 2025-11-28
> **Domain Path:** `src/routes/`
> **Maintainer:** AI Gatekeeper Agent

This document defines the canonical patterns, coding standards, and best practices for the Routes domain. It serves as the **source of truth** for all routing code and is used by AI coding agents for implementation and by the senior AI gatekeeper agent for code review validation.

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [Directory Structure](#2-directory-structure)
3. [Core Principles](#3-core-principles)
4. [Page Routes](#4-page-routes)
5. [Layout Routes](#5-layout-routes)
6. [API Routes](#6-api-routes)
7. [Authentication Guards](#7-authentication-guards)
8. [Data Loading](#8-data-loading)
9. [Error Handling](#9-error-handling)
10. [Component Patterns](#10-component-patterns)
11. [Navigation](#11-navigation)
12. [Anti-Patterns Reference](#12-anti-patterns-reference)
13. [Security Checklist](#13-security-checklist)
14. [Sources & References](#14-sources--references)

---

## 1. Domain Overview

The Routes domain contains all file-based routing using TanStack Router. This includes:
- **Page Routes** - UI pages rendered in the browser
- **Layout Routes** - Shared layouts wrapping child routes
- **API Routes** - Server-side HTTP endpoints

### Key Technologies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-router` | ^1.132.0 | File-based routing, loaders, type-safe navigation |
| `@tanstack/react-start` | ^1.132.0 | SSR, server functions, API routes |

### Critical Concepts

| Term | Definition |
|------|------------|
| `beforeLoad` | Serial pre-loading phase that blocks ALL child routes. Use for auth guards only. |
| `loader` | Parallel loading phase. Use for data fetching. |
| `server.handlers` | API route HTTP method handlers (GET, POST, etc.) |
| `isomorphic` | Code that runs on BOTH server (SSR) and client (navigation) |

---

## 2. Directory Structure

```
src/routes/
├── __root.tsx              # Root HTML shell (special)
├── index.tsx               # Landing page (/)
├── login.tsx               # Login page (/login)
├── signup.tsx              # Signup page (/signup)
├── unauthorized.tsx        # Error page (/unauthorized)
├── dashboard.tsx           # Protected layout (/dashboard)
├── dashboard/
│   ├── index.tsx           # Dashboard home (/dashboard)
│   ├── new.tsx             # New chat (/dashboard/new)
│   ├── settings.tsx        # Settings (/dashboard/settings)
│   ├── models.tsx          # Models browser (/dashboard/models)
│   └── c.$chatId.tsx       # Chat view (/dashboard/c/:chatId)
└── api/
    ├── chat.ts             # Chat API (/api/chat)
    └── auth/
        └── $.ts            # Auth catch-all (/api/auth/*)
```

### File Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `__root.tsx` | `__root.tsx` | Root HTML shell (only one) |
| `index.tsx` | `dashboard/index.tsx` | Index route for directory |
| `$param.tsx` | `c.$chatId.tsx` | Dynamic route parameter |
| `$.ts` | `api/auth/$.ts` | Catch-all route (splat) |
| `.tsx` | `login.tsx` | Page route (React component) |
| `.ts` | `api/chat.ts` | API route (no UI) |

---

## 3. Core Principles

### 3.1 Loaders are Isomorphic

**CRITICAL**: Route loaders run on BOTH server (SSR) and client (navigation).

```typescript
// ❌ BAD: Secrets exposed to client bundle
export const Route = createFileRoute("/data")({
  loader: async () => {
    const secret = process.env.API_SECRET; // EXPOSED TO CLIENT!
    return fetch(`/api?key=${secret}`);
  },
});

// ✅ GOOD: Use server functions for secrets
const getSecureData = createServerFn().handler(async () => {
  const secret = process.env.API_SECRET; // Safe - server only
  return fetch(`/api?key=${secret}`);
});

export const Route = createFileRoute("/data")({
  loader: () => getSecureData(), // Calls server function
});
```

### 3.2 beforeLoad vs loader

| Aspect | `beforeLoad` | `loader` |
|--------|--------------|----------|
| **Execution** | Serial (blocks everything) | Parallel (with siblings) |
| **Purpose** | Auth guards, context injection | Data fetching |
| **Use When** | Blocking child routes | Loading route-specific data |
| **Warning** | "Be extremely careful" - blocks ALL loaders | Primary data loading location |

```typescript
// ✅ GOOD: beforeLoad for auth (layout routes only)
beforeLoad: async () => {
  const user = await getUser();
  if (!user) throw redirect({ to: "/login" });
  return { user }; // Available in child loaders via context
},

// ✅ GOOD: loader for data fetching
loader: async ({ context, params }) => {
  return context.queryClient.ensureQueryData({
    queryKey: ["chat", params.chatId],
    queryFn: () => getChatById(params.chatId),
  });
},
```

### 3.3 Auth Guard Location

**Auth guards belong in layout routes only.** Child routes inherit protection automatically.

```
/dashboard        ← Auth guard HERE (beforeLoad)
  /dashboard/     ← Inherits protection (no guard needed)
  /dashboard/new  ← Inherits protection (no guard needed)
  /dashboard/c/$  ← Inherits protection (no guard needed)
```

```typescript
// ❌ BAD: Redundant auth check in child route
// src/routes/dashboard/models.tsx
export const Route = createFileRoute("/dashboard/models")({
  loader: async ({ context }) => {
    if (!context.user?.id) {  // REDUNDANT - parent already checks
      throw redirect({ to: "/login" });
    }
  },
});

// ✅ GOOD: Trust parent layout auth guard
// src/routes/dashboard/models.tsx
export const Route = createFileRoute("/dashboard/models")({
  loader: async ({ context }) => {
    // context.user guaranteed by parent dashboard.tsx
    return getModels(context.user.id);
  },
});
```

### 3.4 QueryClient Usage

QueryClient integration is **optional on a per-route basis**. Use it when:
- Data benefits from caching
- Route uses React Query hooks in components
- Data is shared across components

```typescript
// ✅ GOOD: Using queryClient for cacheable data
loader: async ({ context, params }) => {
  return context.queryClient.ensureQueryData({
    queryKey: ["chat", params.chatId],
    queryFn: () => getChatById(params.chatId, context.user.id),
  });
},

// ✅ GOOD: Direct server action for non-cached data
loader: async ({ context }) => {
  const apiKeyExists = await hasApiKey();
  if (!apiKeyExists) throw redirect({ to: "/dashboard/settings" });
  return {};
},
```

---

## 4. Page Routes

### 4.1 Canonical Page Route Template

```typescript
// src/routes/feature.tsx
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { FeatureComponent } from "@/components/feature/feature-component";
import { getFeatureData } from "@/server/actions/feature-actions";

export const Route = createFileRoute("/feature")({
  component: RouteComponent,

  loader: async ({ context, params }) => {
    // Access user from parent layout context
    const userId = context.user?.id;

    // Fetch data (with or without queryClient)
    const data = await getFeatureData(params.id, userId);

    // Handle not found
    if (!data) {
      throw notFound();
    }

    return { data };
  },
});

function RouteComponent() {
  const { data } = Route.useLoaderData();

  return <FeatureComponent data={data} />;
}
```

### 4.2 Route Config Property Order

Properties MUST follow this order (enforced by ESLint):

```typescript
export const Route = createFileRoute("/path")({
  // 1. Component (required for page routes)
  component: RouteComponent,

  // 2. beforeLoad (optional - auth/context)
  beforeLoad: async () => {},

  // 3. loader (optional - data fetching)
  loader: async () => {},

  // 4. Other properties (rarely used)
  // onEnter, onStay, onLeave, head, scripts, headers, remountDeps
});
```

### 4.3 Component Naming Convention

**Always use `RouteComponent`** as the component function name for consistency.

```typescript
// ✅ GOOD: Standard naming
export const Route = createFileRoute("/dashboard/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  // Component implementation
}

// ❌ BAD: Inconsistent naming
export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsView,  // Don't use descriptive names
});

function SettingsView() {
  // ...
}

// ❌ BAD: Generic 'App' name
function App() {
  // ...
}
```

---

## 5. Layout Routes

### 5.1 Canonical Layout Route Template

Layout routes wrap child routes and provide shared UI/context.

```typescript
// src/routes/dashboard.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getUser } from "@/server/actions/auth-actions";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,

  // Auth guard in layout route - protects ALL children
  beforeLoad: async () => {
    const user = await getUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user }; // Available to all child routes via context
  },
});

function RouteComponent() {
  // Access beforeLoad data via useRouteContext (NOT useLoaderData)
  const { user } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <main>
        <Outlet /> {/* Child routes render here */}
      </main>
    </SidebarProvider>
  );
}
```

### 5.2 Layout vs Page Route Differences

| Aspect | Layout Route | Page Route |
|--------|--------------|------------|
| **File Location** | `dashboard.tsx` (same level as folder) | `dashboard/index.tsx` (inside folder) |
| **Renders Children** | Yes, via `<Outlet />` | No |
| **Auth Guard** | Yes, use `beforeLoad` | No, inherit from parent |
| **Data Access** | `useRouteContext()` for beforeLoad data | `useLoaderData()` for loader data |

### 5.3 Context Flow

Data returned from `beforeLoad` flows to child routes via context:

```typescript
// Parent: dashboard.tsx
beforeLoad: async () => {
  const user = await getUser();
  return { user }; // Added to context
},

// Child: dashboard/settings.tsx
loader: async ({ context }) => {
  const userId = context.user.id; // Access parent's user
  return getSettings(userId);
},
```

---

## 6. API Routes

### 6.1 Canonical API Route Template

```typescript
// src/routes/api/feature.ts
import { createFileRoute, json } from "@tanstack/react-router";
import { protectedMiddleware } from "@/server/middleware/protected-middleware";

export const Route = createFileRoute("/api/feature")({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { db } = context.config;
        const data = await db.select().from(feature);

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },

      POST: async ({ request, context }) => {
        try {
          const body = await request.json();

          // Validate required fields
          if (!body.name) {
            return new Response(
              JSON.stringify({ error: "Missing required field: name" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Business logic
          const { db } = context.config;
          const result = await createFeature(db, context.user.id, body);

          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("API error:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
```

### 6.2 Handler Context

Handlers receive:

| Property | Type | Description |
|----------|------|-------------|
| `request` | `Request` | Standard Web Request object |
| `params` | `object` | Dynamic route parameters |
| `context` | `object` | Middleware-provided context |

```typescript
handlers: {
  POST: async ({ request, params, context }) => {
    const body = await request.json();      // Parse request body
    const { id } = params;                   // Access route params
    const { db } = context.config;           // Access middleware context
    const userId = context.user.id;          // Access authenticated user
  },
}
```

### 6.3 Response Patterns

```typescript
// ✅ GOOD: JSON response with proper headers
return new Response(JSON.stringify({ data }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

// ✅ GOOD: Streaming response
return new Response(stream, {
  headers: { "Content-Type": "text/event-stream" },
});

// ✅ GOOD: Error response
return new Response(
  JSON.stringify({ error: "Not found" }),
  { status: 404, headers: { "Content-Type": "application/json" } }
);

// ❌ BAD: Missing Content-Type header
return new Response(JSON.stringify({ data }));

// ❌ BAD: Throwing errors instead of returning Response
throw new Error("Not found"); // Use Response with status code instead
```

### 6.4 Middleware Selection for API Routes

| Middleware | Use Case | Context Provides |
|------------|----------|------------------|
| `globalMiddleware` | Public API (auth handler) | `config` |
| `authMiddleware` | Optional auth API | `config`, `user?` |
| `protectedMiddleware` | Authenticated API | `config`, `user!` |

```typescript
// ✅ GOOD: Public auth handler
export const Route = createFileRoute("/api/auth/$")({
  server: {
    middleware: [globalMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        return context.config.auth.handler(request);
      },
    },
  },
});

// ✅ GOOD: Protected API endpoint
export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [protectedMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        // context.user guaranteed by middleware
      },
    },
  },
});
```

---

## 7. Authentication Guards

### 7.1 Protected Layout Pattern (Recommended)

```typescript
// src/routes/dashboard.tsx
export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,

  beforeLoad: async () => {
    const user = await getUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
});
```

All routes under `/dashboard/*` automatically inherit this protection.

### 7.2 Public Route with Auth Redirect

For login/signup pages that redirect authenticated users:

```typescript
// src/routes/login.tsx
import { getSession } from "@/client/auth";

export const Route = createFileRoute("/login")({
  component: RouteComponent,

  beforeLoad: async () => {
    const session = await getSession();
    if (session.data?.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
});
```

### 7.3 Auth Guard Anti-Patterns

```typescript
// ❌ BAD: Auth check in loader instead of beforeLoad
export const Route = createFileRoute("/dashboard")({
  loader: async ({ context }) => {
    if (!context.user) {  // Wrong location
      throw redirect({ to: "/login" });
    }
  },
});

// ❌ BAD: Both beforeLoad AND loader doing auth
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const user = await getUser();
    return { user };
  },
  loader: async ({ context }) => {
    if (!context.user) {  // Redundant check
      throw redirect({ to: "/login" });
    }
    return { user: context.user };  // Redundant return
  },
});

// ❌ BAD: Auth check in child route when parent handles it
// src/routes/dashboard/models.tsx
export const Route = createFileRoute("/dashboard/models")({
  loader: async ({ context }) => {
    if (!context.user?.id) {  // Parent already checks this
      throw redirect({ to: "/login" });
    }
  },
});
```

---

## 8. Data Loading

### 8.1 With QueryClient (Cacheable Data)

Use when data benefits from caching or is used with React Query hooks.

```typescript
// src/routes/dashboard/c.$chatId.tsx
export const Route = createFileRoute("/dashboard/c/$chatId")({
  component: RouteComponent,

  loader: async ({ context, params }) => {
    const userId = context.user.id;

    // Parallel fetching with Promise.all
    const [chat, messages] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["chat", params.chatId],
        queryFn: () => getChatById(params.chatId, userId),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["messages", params.chatId],
        queryFn: () => getMessages(params.chatId, userId),
      }),
    ]);

    if (!chat) {
      throw notFound();
    }

    return { chat, messages, userId };
  },
});
```

### 8.2 Without QueryClient (One-off Data)

Use for data that doesn't need caching.

```typescript
// src/routes/dashboard/new.tsx
export const Route = createFileRoute("/dashboard/new")({
  component: RouteComponent,

  loader: async () => {
    // Simple check - no caching needed
    const hasKey = await hasApiKey();
    if (!hasKey) {
      throw redirect({ to: "/dashboard/settings" });
    }
    return {};
  },
});
```

### 8.3 ensureQueryData vs prefetchQuery

| Method | Returns Data | Respects staleTime | Use When |
|--------|--------------|-------------------|----------|
| `ensureQueryData` | Yes | No (always returns cache) | Critical data needed for render |
| `prefetchQuery` | No | Yes | Background prefetch, non-blocking |

```typescript
// ✅ GOOD: Critical data - await ensureQueryData
const chat = await context.queryClient.ensureQueryData({
  queryKey: ["chat", chatId],
  queryFn: () => getChatById(chatId),
});

// ✅ GOOD: Non-critical data - prefetch without await
context.queryClient.prefetchQuery({
  queryKey: ["chatHistory", chatId],
  queryFn: () => getChatHistory(chatId),
});
// Continue without waiting

// ✅ GOOD: Mix critical and non-critical
loader: async ({ context }) => {
  // Start prefetch (don't await)
  context.queryClient.prefetchQuery(secondaryQuery);

  // Await critical data
  const criticalData = await context.queryClient.ensureQueryData(primaryQuery);

  return { criticalData };
},
```

### 8.4 Accessing Loader Data

```typescript
function RouteComponent() {
  // ✅ GOOD: Access loader data via Route.useLoaderData()
  const { chat, messages } = Route.useLoaderData();

  // ✅ GOOD: Access beforeLoad context via Route.useRouteContext()
  const { user } = Route.useRouteContext();

  // ✅ GOOD: Access params via Route.useParams()
  const { chatId } = Route.useParams();

  return <ChatView chat={chat} messages={messages} />;
}

// ❌ BAD: Importing useLoaderData from @tanstack/react-router
import { useLoaderData } from "@tanstack/react-router";
const data = useLoaderData(); // Missing type safety
```

---

## 9. Error Handling

### 9.1 throw redirect()

Use for navigation-based flow control.

```typescript
// ✅ GOOD: Auth redirect
if (!user) {
  throw redirect({ to: "/login" });
}

// ✅ GOOD: Config redirect
if (!hasApiKey) {
  throw redirect({ to: "/dashboard/settings" });
}

// ✅ GOOD: Redirect with search params
throw redirect({
  to: "/login",
  search: { returnTo: "/dashboard/settings" },
});
```

### 9.2 throw notFound()

Use for missing resources. **Only use in `loader`, NOT in `beforeLoad`.**

```typescript
// ✅ GOOD: In loader
loader: async ({ params }) => {
  const chat = await getChatById(params.chatId);
  if (!chat) {
    throw notFound();
  }
  return { chat };
},

// ❌ BAD: In beforeLoad (always triggers root notFoundComponent)
beforeLoad: async ({ params }) => {
  const chat = await getChatById(params.chatId);
  if (!chat) {
    throw notFound(); // Don't do this
  }
},
```

### 9.3 Error Boundaries

Use `errorComponent` for route-specific error handling:

```typescript
export const Route = createFileRoute("/dashboard/c/$chatId")({
  component: RouteComponent,
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,

  loader: async ({ params }) => {
    // Errors thrown here render ErrorComponent
    // notFound() renders NotFoundComponent
  },
});

function ErrorComponent({ error }: { error: Error }) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
    </div>
  );
}

function NotFoundComponent() {
  return <div>Chat not found</div>;
}
```

---

## 10. Component Patterns

### 10.1 Route Component Structure

```typescript
function RouteComponent() {
  // 1. Access route data
  const { data } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const { chatId } = Route.useParams();

  // 2. Client hooks (React Query, Zustand, etc.)
  const { mutate } = useUpdateChat();
  const isOpen = useChatStore((s) => s.isOpen);

  // 3. Local state
  const [isEditing, setIsEditing] = useState(false);

  // 4. Effects (if needed)
  useEffect(() => {
    // Side effects
  }, []);

  // 5. Render
  return <FeatureComponent data={data} />;
}
```

### 10.2 Avoid Heavy Logic in Components

```typescript
// ❌ BAD: Complex async logic in useEffect
function RouteComponent() {
  const [data, setData] = useState(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function init() {
      const session = await getSession();
      const model = await getDefaultModel();
      const chat = await createChat(model);
      navigate({ to: `/dashboard/c/${chat.id}` });
    }
    init();
  }, []);
}

// ✅ GOOD: Move logic to loader
export const Route = createFileRoute("/dashboard/new")({
  loader: async ({ context }) => {
    const model = getDefaultModel();
    if (model) {
      const chat = await createChat(model, context.user.id);
      throw redirect({ to: `/dashboard/c/${chat.id}` });
    }
    return { needsModelSelection: true };
  },
});

function RouteComponent() {
  const { needsModelSelection } = Route.useLoaderData();
  return <ModelSelector />;
}
```

---

## 11. Navigation

### 11.1 Declarative Navigation (Links)

```typescript
import { Link } from "@tanstack/react-router";

// ✅ GOOD: Basic link
<Link to="/dashboard">Dashboard</Link>

// ✅ GOOD: Link with params
<Link to="/dashboard/c/$chatId" params={{ chatId: "123" }}>
  Open Chat
</Link>

// ✅ GOOD: Link with search params
<Link to="/search" search={{ q: "query" }}>
  Search
</Link>

// ✅ GOOD: Active link styling
<Link
  to="/dashboard"
  activeProps={{ className: "font-bold" }}
  inactiveProps={{ className: "text-gray-500" }}
>
  Dashboard
</Link>
```

### 11.2 Programmatic Navigation

```typescript
import { useNavigate } from "@tanstack/react-router";

function Component() {
  const navigate = useNavigate();

  const handleClick = () => {
    // ✅ GOOD: Navigate with params
    navigate({ to: "/dashboard/c/$chatId", params: { chatId: "123" } });

    // ✅ GOOD: Navigate with replace (no history entry)
    navigate({ to: "/login", replace: true });
  };
}
```

### 11.3 Navigation from Loaders

```typescript
// ✅ GOOD: Use throw redirect() in loaders
loader: async ({ context }) => {
  if (!context.user) {
    throw redirect({ to: "/login" });
  }
},

// ❌ BAD: Using navigate in components for loader-level redirects
function RouteComponent() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  useEffect(() => {
    if (!user) navigate({ to: "/login" }); // Should be in loader
  }, [user]);
}
```

---

## 12. Anti-Patterns Reference

### 12.1 Redundant Auth Guards

```typescript
// ❌ ANTI-PATTERN: Auth in both beforeLoad and loader
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const user = await getUser();
    return { user };
  },
  loader: async ({ context }) => {
    if (!context?.user) {
      throw redirect({ to: "/login" }); // Redundant
    }
    return { user: context.user }; // Redundant return
  },
});

// ✅ CORRECT: Auth in beforeLoad only
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const user = await getUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
});
```

### 12.2 Child Route Auth Checks

```typescript
// ❌ ANTI-PATTERN: Auth check when parent handles it
// src/routes/dashboard/models.tsx
export const Route = createFileRoute("/dashboard/models")({
  loader: async ({ context }) => {
    if (!context.user?.id) {
      throw redirect({ to: "/login" }); // Parent already checks
    }
  },
});

// ✅ CORRECT: Trust parent layout
export const Route = createFileRoute("/dashboard/models")({
  loader: async ({ context }) => {
    // context.user guaranteed by parent
    return getModels(context.user.id);
  },
});
```

### 12.3 Dead Code

```typescript
// ❌ ANTI-PATTERN: Component never renders (all paths redirect)
export const Route = createFileRoute("/")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getSession();
    if (session.data?.user) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/login" }); // Always redirects
  },
});

function RouteComponent() {
  // This component NEVER renders - dead code
  return <div>Welcome</div>;
}

// ✅ CORRECT: Remove unreachable component
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSession();
    throw redirect({
      to: session.data?.user ? "/dashboard" : "/login",
    });
  },
});
```

### 12.4 Unused Loader Data

```typescript
// ❌ ANTI-PATTERN: Loader returns unused data
export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    return { hasChats: false }; // Never accessed
  },
});

function RouteComponent() {
  // Doesn't use loader data
  return <WelcomeScreen />;
}

// ✅ CORRECT: Remove unused loader or use the data
export const Route = createFileRoute("/dashboard/")({
  component: RouteComponent,
  // No loader needed
});
```

### 12.5 Debug Logging in Production

```typescript
// ❌ ANTI-PATTERN: Console.log in API routes
handlers: {
  POST: async ({ request }) => {
    const body = await request.json();
    console.log(body); // Remove this
  },
}

// ✅ CORRECT: No debug logging (or use proper logger)
handlers: {
  POST: async ({ request }) => {
    const body = await request.json();
    // Process without logging sensitive data
  },
}
```

### 12.6 Inconsistent Component Naming

```typescript
// ❌ ANTI-PATTERN: Mixed naming conventions
// File 1: function RouteComponent() {}
// File 2: function SettingsView() {}
// File 3: function App() {}

// ✅ CORRECT: Always use RouteComponent
function RouteComponent() {}
```

### 12.7 notFound() in beforeLoad

```typescript
// ❌ ANTI-PATTERN: notFound in beforeLoad
beforeLoad: async ({ params }) => {
  const item = await getItem(params.id);
  if (!item) {
    throw notFound(); // Always triggers ROOT notFoundComponent
  }
},

// ✅ CORRECT: notFound in loader
loader: async ({ params }) => {
  const item = await getItem(params.id);
  if (!item) {
    throw notFound(); // Triggers route-specific notFoundComponent
  }
  return { item };
},
```

### 12.8 Heavy useEffect Initialization

```typescript
// ❌ ANTI-PATTERN: Complex async logic in useEffect
function RouteComponent() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      const session = await getSession();
      const model = await getDefaultModel();
      // ... more async logic
      navigate({ to: newPath });
    })();
  }, []);
}

// ✅ CORRECT: Move to loader
loader: async ({ context }) => {
  const model = getDefaultModel();
  if (model) {
    throw redirect({ to: `/dashboard/c/${newChatId}` });
  }
  return { needsSelection: true };
},
```

---

## 13. Security Checklist

### Pre-Merge Validation

Every route MUST be validated against this checklist:

- [ ] **No secrets in loaders** - Loaders are isomorphic; use server functions for secrets
- [ ] **Auth guard in layout only** - Child routes don't duplicate auth checks
- [ ] **User isolation** - All data queries filter by user ID
- [ ] **Proper middleware** - API routes use appropriate middleware level
- [ ] **No debug logging** - Remove console.log from API routes
- [ ] **Error handling** - Proper Response objects with status codes
- [ ] **No dead code** - All components are reachable

### Route Security Review

```typescript
// ✅ SECURE: Server function for secrets
const getData = createServerFn().handler(async () => {
  const secret = process.env.SECRET;
  return fetchWithSecret(secret);
});

loader: () => getData(), // Safe

// ❌ INSECURE: Secret in loader
loader: async () => {
  const secret = process.env.SECRET; // Exposed to client!
},
```

---

## 14. Sources & References

### Official Documentation

| Resource | URL |
|----------|-----|
| TanStack Router - File-Based Routing | https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing |
| TanStack Router - Data Loading | https://tanstack.com/router/latest/docs/framework/react/guide/data-loading |
| TanStack Router - Authenticated Routes | https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes |
| TanStack Router - Query Integration | https://tanstack.com/router/latest/docs/integrations/query |
| TanStack Router - Not Found Errors | https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors |
| TanStack Router - Router Context | https://tanstack.com/router/latest/docs/framework/react/guide/router-context |
| TanStack Start - Server Functions | https://tanstack.com/start/latest/docs/framework/react/guide/server-functions |
| TanStack Start - Server Routes | https://tanstack.com/start/latest/docs/framework/react/guide/server-routes |
| TanStack Start - Middleware | https://tanstack.com/start/latest/docs/framework/react/guide/middleware |
| TanStack Start - Execution Model | https://tanstack.com/start/latest/docs/framework/react/guide/execution-model |

### Cloudflare Workers

| Resource | URL |
|----------|-----|
| TanStack Start on Cloudflare | https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/ |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Initial version from Phase 1 research | AI Agent |
