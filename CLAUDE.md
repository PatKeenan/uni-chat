# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack application built with TanStack Start (React Server Framework) designed to run on Cloudflare Workers. It features:
- Server-side rendering with TanStack Router
- PostgreSQL database with Drizzle ORM
- Better Auth for authentication
- Tailwind CSS with Radix UI components
- Vitest for testing

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

### Local Database Setup
```bash
docker-compose up -d  # Start PostgreSQL container
bun db:generate      # Generate migrations
bun db:migrate       # Run migrations
```

## Architecture

### Cloudflare Workers I/O Isolation Pattern

**CRITICAL**: This application follows a per-request isolation pattern required for Cloudflare Workers:

1. **Database Connections**: Always use `createDb()` per request, never share connections
   - Located in `src/lib/server/db/index.ts`
   - Uses `max: 1` connection pool for serverless compatibility
   - Wrapped in `createServerOnlyFn()` for automatic per-request isolation

2. **Auth Instances**: Always use `getAuth(db)` factory pattern, never export module-level instances
   - Located in `src/lib/server/auth/index.ts`
   - Takes a database instance and returns a Better Auth instance
   - Must be created per-request via `loadConfig()`

3. **Config Loading**: Use `loadConfig()` to create per-request instances
   - Located in `src/lib/server/loadConfig.ts`
   - Creates fresh `db` and `auth` instances for each request
   - Available in middleware context as `context.config`

### Middleware Architecture

Middleware are composable and chainable:

1. **globalMiddleware** (`src/lib/server/middleware/global-middleware.ts`)
   - Loads config with per-request db/auth instances
   - Adds `config` to context
   - Base middleware for all server operations

2. **authMiddleware** (`src/lib/server/middleware/auth-middleware.ts`)
   - Extends globalMiddleware
   - Fetches session/user data via `context.config.auth`
   - Adds `session` and `user` to context

3. **protectedMiddleware** (`src/lib/server/middleware/protected-middleware.ts`)
   - Extends authMiddleware
   - Throws 401 if no user in context
   - Use for protected routes/actions

### File-Based Routing

Routes are managed as files in `src/routes/`:
- `__root.tsx` - Layout wrapper with `<Outlet />` for child routes
- Route files export TanStack Router route definitions
- API routes in `src/routes/api/` handle server endpoints
- Auth API catch-all at `src/routes/api/auth/$.ts` handles all Better Auth endpoints

### Data Fetching Patterns

1. **Route Loaders**: Use TanStack Router's `loader` for SSR data fetching
2. **React Query**: Available for client-side data fetching and caching
3. **Server Actions**: Create in `src/lib/server/actions/` for form submissions/mutations

### Database Schema

Located in `src/lib/server/db/schema.ts`:
- `user` - User accounts
- `session` - Auth sessions
- `account` - OAuth/provider accounts
- `verification` - Email verification tokens

After schema changes:
1. Run `bun db:generate` to create migrations
2. Run `bun db:migrate` to apply migrations

### Path Aliases

TypeScript path alias `@/*` maps to `src/*`:
```typescript
import { createDb } from "@/lib/server/db";
```

### Authentication Flow

- Client-side auth via `src/lib/client/auth-client.ts` (Better Auth React hooks)
- Server-side session validation in authMiddleware
- Protected routes use protectedMiddleware to enforce authentication
- Auth API endpoints handled by Better Auth at `/api/auth/*`

## Important Patterns

### Never Do This (Cloudflare Workers Anti-Patterns)
```typescript
// ❌ BAD: Module-level instances
const db = createDb();
const auth = getAuth(db);
export { db, auth };
```

### Always Do This Instead
```typescript
// ✅ GOOD: Per-request instances
export const myAction = createServerOnlyFn(async () => {
  const { db, auth } = loadConfig();
  // Use db and auth here
});

// ✅ GOOD: Via middleware context
export const Route = createFileRoute("/my-route")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        // Use context.config.db and context.config.auth
      }
    }
  }
});
```

### Component Organization

- `src/components/ui/` - Radix UI-based primitives (generated via shadcn/ui pattern)
- `src/components/` - Application-specific components
- Files prefixed with `demo` can be safely deleted

### Styling

- Tailwind CSS v4 with Vite plugin
- Class utilities via `src/lib/utils.ts` (cn function)
- Responsive design with mobile-first approach
