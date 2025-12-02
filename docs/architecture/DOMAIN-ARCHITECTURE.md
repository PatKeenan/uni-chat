# Domain Architecture

This document defines the domain structure for the uni-chat codebase. Each domain has a clear purpose and boundary. Code should be organized by domain to enable validation, maintainability, and scalability.

## Domains Overview

| Domain | Directory | Purpose |
|--------|-----------|---------|
| Routing | `src/routes/` | Page routes, API endpoints, layouts |
| Server | `src/server/` | All server-side code |
| Client | `src/client/` | All client-side code |
| Components | `src/components/` | React UI components |
| Integrations | `src/integrations/` | Third-party API clients |
| Types | `src/types/` | Shared TypeScript definitions |
| Testing | `src/test/` | Test infrastructure |

---

## Domain 1: Routing

**Directory:** `src/routes/`

**Purpose:** File-based routing with TanStack Router. Contains page components, layouts, and API endpoints.

**Structure:**
```
src/routes/
├── __root.tsx              # Root HTML shell
├── index.tsx               # Home/landing page
├── login.tsx               # Auth pages
├── signup.tsx
├── unauthorized.tsx
├── dashboard.tsx           # Protected layout
├── dashboard/              # Dashboard pages
│   ├── index.tsx
│   ├── new.tsx
│   ├── models.tsx
│   ├── settings.tsx
│   └── c.$chatId.tsx
└── api/                    # API endpoints
    ├── auth/$.ts           # Better Auth handler
    └── chat.ts             # Streaming endpoint
```

**Rules:**
- Routes define pages and API endpoints only
- Business logic lives in Server or Client domains
- Loaders call server actions, not database directly
- API routes use middleware for auth/context

---

## Domain 2: Server

**Directory:** `src/server/`

**Purpose:** All server-side code including server functions, middleware, database, and authentication.

**Structure:**
```
src/server/
├── actions/                # Server functions (createServerFn)
│   ├── auth-actions.ts
│   ├── chat-actions.ts
│   ├── message-actions.ts
│   ├── folder-actions.ts
│   ├── model-actions.ts
│   └── api-key-actions.ts
├── middleware/             # Request middleware
│   ├── global-middleware.ts
│   ├── auth-middleware.ts
│   └── protected-middleware.ts
├── db/                     # Database layer
│   ├── index.ts            # Connection factory
│   ├── schema.ts           # Schema exports
│   └── schema/
│       ├── index.ts
│       └── server-only.ts
├── auth/                   # Better Auth config
│   └── index.ts
├── utils/                  # Server utilities
│   └── encryption.ts
└── config.ts               # loadConfig function
```

**Rules:**
- All `createServerFn()` calls live in `actions/`
- Middleware composes: global → auth → protected
- Database connections created per-request (Cloudflare Workers)
- No client-side imports allowed

---

## Domain 3: Client

**Directory:** `src/client/`

**Purpose:** All client-side code including hooks, stores, local database, and client actions.

**Structure:**
```
src/client/
├── hooks/                  # React hooks
│   ├── use-chat-stream.ts
│   ├── use-local-chats.ts
│   ├── use-local-folders.ts
│   ├── use-local-messages.ts
│   ├── use-models.ts
│   ├── use-data-management.ts
│   └── use-mobile.ts
├── stores/                 # Zustand stores
│   └── chat-store.ts
├── actions/                # Client-side mutations
│   ├── chat-actions.ts
│   ├── message-actions.ts
│   ├── folder-actions.ts
│   ├── model-actions.ts
│   └── data-actions.ts
├── queries/                # TanStack Query definitions
│   ├── auth-queries.ts
│   └── data-queries.ts
├── db/                     # PGlite local database
│   ├── index.ts
│   ├── migrations.ts
│   └── schema/
│       ├── index.ts
│       └── client-only.ts
├── storage/                # localStorage utilities
│   ├── api-key.ts
│   └── default-model.ts
├── utils/                  # Client utilities
│   ├── generate-chat-title.ts
│   └── to-ui-message.ts
└── auth.ts                 # Auth client (signIn, signOut, etc.)
```

**Rules:**
- All React hooks live in `hooks/`
- Zustand stores live in `stores/`
- Local database operations in `db/`
- No server imports allowed

---

## Domain 4: Components

**Directory:** `src/components/`

**Purpose:** React UI components organized by feature area.

**Structure:**
```
src/components/
├── ui/                     # shadcn/ui primitives (generic)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── ... (24 components)
├── chat/                   # Chat feature components
│   ├── chat-view-content.tsx
│   ├── chat-header.tsx
│   ├── chat-message.tsx
│   ├── chat-message-list.tsx
│   ├── chat-input.tsx
│   ├── chat-empty-state.tsx
│   └── code-block.tsx
├── nav/                    # Navigation components
│   ├── app-sidebar.tsx
│   ├── nav-folders.tsx
│   ├── nav-user.tsx
│   ├── nav-main.tsx
│   ├── nav-projects.tsx
│   └── nav-starred-models.tsx
└── shared/                 # Shared utilities
    ├── default-catch-boundary.tsx
    └── not-found.tsx
```

**Rules:**
- `ui/` contains only generic, reusable primitives
- Feature components grouped by feature (chat, nav)
- No business logic in components - delegate to hooks/stores
- Components use `@/client/` for data, `@/components/ui/` for primitives

---

## Domain 5: Integrations

**Directory:** `src/integrations/`

**Purpose:** Third-party API clients and external service integrations.

**Structure:**
```
src/integrations/
├── openrouter/             # OpenRouter LLM provider
│   └── client.ts
├── tavily/                 # Tavily web search
│   └── web-search.ts
└── ai-sdk/                 # AI SDK utilities (if needed)
    └── tools.ts
```

**Rules:**
- Each integration in its own directory
- Clients are factory functions (for per-request isolation)
- Keep integration-specific types co-located
- Easy to swap or remove integrations

---

## Domain 6: Types

**Directory:** `src/types/`

**Purpose:** Shared TypeScript type definitions used across domains.

**Structure:**
```
src/types/
├── index.ts                # Re-exports all types
├── chat.ts                 # Chat, Message, MessagePart types
├── models.ts               # Model, ModelCapabilities types
├── user.ts                 # User, Session types
└── api.ts                  # API request/response types
```

**Rules:**
- Only types used across multiple domains go here
- Domain-specific types stay in their domain
- No runtime code, only type definitions
- Use `index.ts` for clean imports

---

## Domain 7: Testing

**Directory:** `src/test/`

**Purpose:** Test infrastructure, mocks, and utilities.

**Structure:**
```
src/test/
├── setup.ts                # Vitest setup
├── mocks/
│   ├── auth.mock.ts
│   ├── db.mock.ts
│   └── external-apis.mock.ts
└── utils/
    └── test-helpers.ts
```

**Rules:**
- Test files live next to source files (`*.test.ts`)
- Shared mocks and utilities in `src/test/`
- Setup file configures global test environment

---

## Import Aliases

Update `tsconfig.json` paths to support new structure:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/server/*": ["./src/server/*"],
      "@/client/*": ["./src/client/*"],
      "@/components/*": ["./src/components/*"],
      "@/integrations/*": ["./src/integrations/*"],
      "@/types/*": ["./src/types/*"]
    }
  }
}
```

---

## Migration Order

1. **Server** - Move `src/lib/server/` → `src/server/`
2. **Client** - Move `src/lib/client/` → `src/client/`
3. **Components** - Reorganize into feature subdirectories
4. **Integrations** - Move `src/lib/openrouter/` → `src/integrations/`
5. **Types** - Consolidate scattered type files
6. **Testing** - Already organized, minor cleanup

See `MIGRATION-TRACKER.md` for detailed progress tracking.
