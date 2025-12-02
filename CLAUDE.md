# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uni-Chat is a full-stack AI chat application built with TanStack Start (React Server Framework) designed to run on Cloudflare Workers. It features:
- Server-side rendering with TanStack Router
- PostgreSQL database with Drizzle ORM (server-side)
- PGlite for client-side local storage
- Better Auth for authentication
- OpenRouter for LLM provider access
- Tailwind CSS with shadcn/ui components
- Vitest for testing

## Domain Architecture

The codebase is organized into 7 distinct domains. Each domain has a clear purpose and boundary.

```
src/
├── routes/         # Page routes, API endpoints, layouts
├── server/         # All server-side code
├── client/         # All client-side code
├── components/     # React UI components
├── integrations/   # Third-party API clients
├── types/          # Shared TypeScript definitions
├── test/           # Test infrastructure
└── lib/            # Shared utilities (cn function)
```

### Domain 1: Routing (`src/routes/`)

File-based routing with TanStack Router. Contains page components, layouts, and API endpoints.

**Key files:**
- `__root.tsx` - Root HTML shell
- `dashboard.tsx` - Protected layout wrapper
- `dashboard/c.$chatId.tsx` - Individual chat view
- `api/auth/$.ts` - Better Auth handler
- `api/chat.ts` - Streaming chat endpoint

**Rules:**
- Routes define pages and API endpoints only
- Business logic lives in Server or Client domains
- Loaders call server actions, not database directly

### Domain 2: Server (`src/server/`)

All server-side code including server functions, middleware, database, and authentication.

**Structure:**
- `actions/` - Server functions (`createServerFn`)
- `middleware/` - Request middleware (global → auth → protected)
- `db/` - Database layer and schema
- `auth/` - Better Auth configuration
- `utils/` - Server utilities (encryption)
- `config.ts` - `loadConfig()` function

**Key pattern - Per-request isolation (Cloudflare Workers):**
```typescript
// Always use loadConfig() or middleware context
const { db, auth } = loadConfig();

// Never create module-level instances
```

### Domain 3: Client (`src/client/`)

All client-side code including hooks, stores, local database, and client actions.

**Structure:**
- `hooks/` - React hooks (use-chat-stream, use-local-chats, etc.)
- `stores/` - Zustand stores (chat-store)
- `actions/` - Client-side mutations
- `queries/` - TanStack Query definitions
- `db/` - PGlite local database
- `storage/` - localStorage utilities
- `utils/` - Client utilities
- `auth.ts` - Auth client (signIn, signOut)

**Rules:**
- All React hooks live in `hooks/`
- Zustand stores live in `stores/`
- No server imports allowed

### Domain 4: Components (`src/components/`)

React UI components organized by feature area.

**Structure:**
- `ui/` - shadcn/ui primitives (button, input, dialog, etc.)
- `chat/` - Chat feature components
- `nav/` - Navigation components (sidebar, folders)
- `shared/` - Shared utilities (error boundaries)

**Rules:**
- `ui/` contains only generic, reusable primitives
- Feature components grouped by feature (chat, nav)
- No business logic in components - delegate to hooks/stores

### Domain 5: Integrations (`src/integrations/`)

Third-party API clients and external service integrations.

**Structure:**
- `openrouter/` - OpenRouter LLM provider client
- `tavily/` - Tavily web search tool

**Rules:**
- Each integration in its own directory
- Clients are factory functions (for per-request isolation)
- Easy to swap or remove integrations

### Domain 6: Types (`src/types/`)

Shared TypeScript type definitions used across domains.

**Files:**
- `index.ts` - Re-exports all types
- `chat.ts` - Chat, Message, MessagePart types
- `models.ts` - Model, DB schema types

**Rules:**
- Only types used across multiple domains go here
- Domain-specific types stay in their domain
- No runtime code, only type definitions

### Domain 7: Testing (`src/test/`)

Test infrastructure, mocks, and utilities.

**Rules:**
- Test files live next to source files (`*.test.ts`)
- Shared mocks and utilities in `src/test/`

### Shared Utilities (`src/lib/`)

Contains the `cn()` function for Tailwind class merging. This is the standard shadcn/ui convention location.

## Development Commands

### Essential Commands
- `bun dev` - Start development server on port 3000
- `bun build` - Build for production
- `bun test` - Run all tests with Vitest
- `bun typecheck` - Run TypeScript type checking
- `bun lint` - Check code with Biome
- `bun lint:fix` - Auto-fix linting issues
- `bun format` - Format code with Biome

### Database Commands
- `bun db:generate` - Generate Drizzle migrations from schema changes
- `bun db:migrate` - Apply pending migrations to database
- `bun db:studio` - Open Drizzle Studio UI for database exploration

### Deployment
- `bun deploy` - Build and deploy to Cloudflare Workers
- `bun cf-typegen` - Generate TypeScript types for Cloudflare Workers

## Key Patterns

### Cloudflare Workers I/O Isolation

**CRITICAL**: This application follows a per-request isolation pattern required for Cloudflare Workers:

```typescript
// GOOD: Per-request instances via middleware
export const myAction = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { db, auth } = context.config;
    // Use db and auth here
  });

// BAD: Module-level instances (never do this)
const db = createDb();
export { db };
```

### Middleware Composition

Middleware are composable and chainable:
1. `globalMiddleware` - Loads config with per-request db/auth
2. `authMiddleware` - Extends global, fetches session/user
3. `protectedMiddleware` - Extends auth, enforces authentication

### Path Alias

TypeScript path alias `@/*` maps to `src/*`:
```typescript
import { createDb } from "@/server/db";
import { useChatStream } from "@/client/hooks/use-chat-stream";
import { Button } from "@/components/ui/button";
```

## Detailed Architecture Documentation

For detailed migration history and domain specifications, see:
- [docs/architecture/DOMAIN-ARCHITECTURE.md](docs/architecture/DOMAIN-ARCHITECTURE.md)
- [docs/architecture/MIGRATION-TRACKER.md](docs/architecture/MIGRATION-TRACKER.md)
