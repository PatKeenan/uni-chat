# Domain Pattern Investigation Plan

This document outlines the systematic investigation and validation process for each domain in the codebase. The goal is to ensure our documented patterns align with package best practices before standardizing.

> **Purpose**: Validate current code against package best practices, identify anti-patterns, fix code smells, and only then standardize on proven patterns.

---

## Table of Contents

1. [Investigation Process](#investigation-process)
2. [Domain 1: Routes](#domain-1-routes)
3. [Domain 2: Server](#domain-2-server)
4. [Domain 3: Client](#domain-3-client)
5. [Domain 4: Components](#domain-4-components)
6. [Domain 5: Integrations](#domain-5-integrations)
7. [Domain 6: Types](#domain-6-types)
8. [Domain 7: Testing](#domain-7-testing)
9. [Progress Tracking](#progress-tracking)

---

## Investigation Process

For each domain, we follow this workflow:

### Phase 1: Package Research
- Identify all packages used in the domain
- Research official documentation and best practices
- Find recommended patterns from package maintainers
- Check for common anti-patterns and gotchas

### Phase 2: Code Audit
- Compare current code against researched best practices
- Identify deviations, anti-patterns, and code smells
- Document specific files and line numbers with issues
- Categorize issues by severity (critical, warning, suggestion)

### Phase 3: Remediation
- Fix critical issues first
- Refactor anti-patterns to follow best practices
- Update code to align with package recommendations
- Ensure all changes pass existing tests

### Phase 4: Pattern Finalization
- Update DOMAIN-PATTERNS.md with validated patterns
- Remove "Draft" status for the domain section
- Document any package-specific gotchas discovered

---

## Domain 1: Routes

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-router` | Check package.json | File-based routing, loaders, type-safe navigation |
| `@tanstack/react-start` | Check package.json | SSR, server functions, middleware |

### Research Questions

1. **Route Definition**
   - Is `createFileRoute` the recommended pattern for all routes?
   - Should we use `beforeLoad` vs `loader` vs both?
   - What's the canonical way to handle auth guards?

2. **Data Loading**
   - Best practice for integrating TanStack Query with loaders?
   - Should loaders call server actions directly or use queryClient?
   - How to properly handle `notFound()` and `redirect()`?

3. **API Routes**
   - Is the `server.handlers` pattern the recommended approach?
   - How should middleware be composed for API routes?
   - Best practices for request/response handling?

4. **Component Patterns**
   - Should route components use `Route.useLoaderData()` or alternatives?
   - Best practice for accessing route params in components?

### Current Patterns to Validate

- [ ] `export const Route = createFileRoute("/path")({...})`
- [ ] `beforeLoad` for auth checks, `loader` for data fetching
- [ ] `context.queryClient.ensureQueryData()` for query integration
- [ ] `throw redirect()` and `throw notFound()` for flow control
- [ ] API routes using `server.handlers` with middleware array

### Known Concerns

- Inconsistent component naming (`RouteComponent` vs descriptive names)
- Some routes only use `beforeLoad`, others use both
- Unclear when to use server actions vs direct DB calls in loaders

### Files to Audit

```
src/routes/__root.tsx
src/routes/index.tsx
src/routes/login.tsx
src/routes/signup.tsx
src/routes/unauthorized.tsx
src/routes/dashboard.tsx
src/routes/dashboard/index.tsx
src/routes/dashboard/new.tsx
src/routes/dashboard/settings.tsx
src/routes/dashboard/models.tsx
src/routes/dashboard/c.$chatId.tsx
src/routes/api/chat.ts
src/routes/api/auth/$.ts
```

### Status: `[ ] Not Started`

---

## Domain 2: Server

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-start` | Check package.json | `createServerFn`, `createMiddleware`, `createServerOnlyFn` |
| `drizzle-orm` | Check package.json | Database ORM, queries, schema |
| `postgres` (postgres-js) | Check package.json | PostgreSQL driver |
| `better-auth` | Check package.json | Authentication |
| `zod` | Check package.json | Input validation |
| `nanoid` | Check package.json | ID generation |

### Research Questions

1. **Server Functions**
   - Is `createServerFn().middleware([]).inputValidator().handler()` the canonical pattern?
   - Best practice for error handling in server functions?
   - Should we validate inside handler or rely on inputValidator?

2. **Middleware**
   - Is composing middleware via `.middleware([parent])` correct?
   - Best practice for context typing through middleware chain?
   - How to properly throw errors from middleware?

3. **Database (Drizzle)**
   - Best patterns for Cloudflare Workers compatibility?
   - Should we use `db.query.*` or `db.select().from()`?
   - Proper way to handle transactions?
   - Best practice for JSON columns typing?

4. **Authentication (Better Auth)**
   - Is factory pattern (`getAuth(db)`) the right approach?
   - Best practice for session handling?
   - How to properly integrate with TanStack Start?

5. **Cloudflare Workers**
   - Is `createServerOnlyFn()` wrapper necessary for all factory functions?
   - Best practice for connection pooling (`max: 1`)?
   - Any other isolation requirements we're missing?

### Current Patterns to Validate

- [ ] `loadConfig()` wrapped in `createServerOnlyFn()`
- [ ] Middleware chain: global → auth → protected
- [ ] `createServerFn().middleware([]).inputValidator().handler()`
- [ ] `const { db } = context.config;` inside handlers
- [ ] All queries filter by `context.user.id`
- [ ] Zod schemas for input validation
- [ ] `nanoid()` for ID generation

### Known Concerns

- No explicit error handling in server actions (relying on framework)
- Some redundant auth checks in handlers after protectedMiddleware
- Unclear if postgres-js `max: 1` is optimal
- No transaction patterns documented

### Files to Audit

```
src/server/config.ts
src/server/db/index.ts
src/server/db/schema.ts
src/server/db/schema/server-only.ts
src/server/auth/index.ts
src/server/middleware/global-middleware.ts
src/server/middleware/auth-middleware.ts
src/server/middleware/protected-middleware.ts
src/server/actions/auth-actions.ts
src/server/actions/chat-actions.ts
src/server/actions/folder-actions.ts
src/server/actions/message-actions.ts
src/server/actions/model-actions.ts
src/server/actions/api-key-actions.ts
src/server/utils/encryption.ts
```

### Status: `[ ] Not Started`

---

## Domain 3: Client

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | Check package.json | Server state management |
| `zustand` | Check package.json | Client state management |
| `@electric-sql/pglite` | Check package.json | Local PostgreSQL (WASM) |
| `drizzle-orm` | Check package.json | Local database ORM |
| `better-auth/react` | Check package.json | Auth client hooks |
| `ai` (Vercel AI SDK) | Check package.json | AI chat hooks |

### Research Questions

1. **TanStack Query**
   - Is our query key factory pattern optimal?
   - Best practice for optimistic updates?
   - Should we use `ensureQueryData` vs `prefetchQuery`?
   - How to properly handle cache invalidation?

2. **Zustand**
   - Should we separate state and actions interfaces?
   - Best practice for derived state?
   - When to use selectors vs direct access?
   - Should stores be used for form state?

3. **PGlite**
   - Is singleton pattern with lazy init correct?
   - Best practice for migrations?
   - How to handle database errors gracefully?
   - IndexedDB storage limits and handling?

4. **Vercel AI SDK**
   - Is `useChat` hook used correctly?
   - Best practice for streaming state management?
   - How to properly handle errors in chat?

5. **Auth Client**
   - Is destructuring from `createAuthClient()` the right pattern?
   - Best practice for session state?

### Current Patterns to Validate

- [ ] Query key factory: `featureKeys.list(userId, filters)`
- [ ] `useQuery({ queryKey, queryFn, enabled })`
- [ ] Optimistic updates: `onMutate` → `onError` → `onSettled`
- [ ] Zustand: separate State and Actions interfaces
- [ ] Client actions: `await getClientDb()` at start
- [ ] localStorage: SSR safety with `typeof window`

### Known Concerns

- Complex hooks (use-chat-stream) mixing many concerns
- Some actions have try/catch, others don't
- Unclear when to use Zustand vs TanStack Query
- PGlite error handling may not be robust

### Files to Audit

```
src/client/auth.ts
src/client/db/index.ts
src/client/db/schema/client-only.ts
src/client/db/schema/index.ts
src/client/db/migrations.ts
src/client/hooks/use-chat-stream.ts
src/client/hooks/use-local-chats.ts
src/client/hooks/use-local-folders.ts
src/client/hooks/use-local-messages.ts
src/client/hooks/use-models.ts
src/client/hooks/use-mobile.ts
src/client/stores/chat-store.ts
src/client/actions/chat-actions.ts
src/client/actions/folder-actions.ts
src/client/actions/message-actions.ts
src/client/actions/model-actions.ts
src/client/actions/data-actions.ts
src/client/storage/api-key.ts
src/client/storage/default-model.ts
src/client/storage/tavily-api-key.ts
src/client/utils/generate-chat-title.ts
src/client/utils/to-ui-message.ts
src/client/queries/auth-queries.ts
```

### Status: `[ ] Not Started`

---

## Domain 4: Components

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | Check package.json | Component fundamentals |
| `@radix-ui/*` | Check package.json | Primitive components |
| `class-variance-authority` | Check package.json | Variant management |
| `tailwind-merge` | Check package.json | Class merging |
| `clsx` | Check package.json | Conditional classes |
| `lucide-react` | Check package.json | Icons |

### Research Questions

1. **shadcn/ui Patterns**
   - Are we following shadcn/ui conventions correctly?
   - Should all components use `data-slot` attribute?
   - Best practice for component customization?

2. **Radix UI**
   - Are we wrapping primitives correctly?
   - Best practice for accessibility?
   - Should we customize or re-export primitives?

3. **CVA (Class Variance Authority)**
   - Is our variant structure optimal?
   - Best practice for compound variants?
   - When to use CVA vs simple cn()?

4. **React Patterns**
   - When to use forwardRef vs function components?
   - Best practice for prop typing?
   - How to structure compound components?

5. **Feature Components**
   - How much logic should live in components?
   - Best practice for hook integration?
   - When to split vs keep together?

### Current Patterns to Validate

- [ ] CVA for variants with `defaultVariants`
- [ ] `cn()` for class merging
- [ ] Named exports only
- [ ] `data-slot` attribute for debugging
- [ ] Feature components import from hooks/stores

### Known Concerns

- Inconsistent use of forwardRef vs simple functions
- Some components have inline styles (custom hex colors)
- Large feature components with lots of logic
- Unclear boundary between UI and feature components

### Files to Audit

```
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/card.tsx
src/components/ui/dialog.tsx
src/components/ui/sidebar.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/tooltip.tsx
src/components/chat/chat-input.tsx
src/components/chat/chat-message.tsx
src/components/chat/chat-view-content.tsx
src/components/chat/chat-header.tsx
src/components/chat/code-block.tsx
src/components/nav/app-sidebar.tsx
src/components/nav/nav-folders.tsx
src/components/nav/nav-user.tsx
src/components/shared/default-catch-boundary.tsx
```

### Status: `[ ] Not Started`

---

## Domain 5: Integrations

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `@openrouter/ai-sdk-provider` | Check package.json | OpenRouter AI SDK adapter |
| `@openrouter/sdk` | Check package.json | OpenRouter direct API |
| `@tavily/core` | Check package.json | Tavily web search |
| `ai` (Vercel AI SDK) | Check package.json | Tool definitions |

### Research Questions

1. **OpenRouter**
   - Is factory pattern the recommended approach?
   - Best practice for API key handling?
   - How to properly configure headers?
   - Error handling recommendations?

2. **Tavily**
   - Is tool wrapper pattern correct?
   - Best practice for result transformation?
   - Rate limiting considerations?

3. **Vercel AI SDK Tools**
   - Is our tool definition structure correct?
   - Best practice for input validation?
   - How to handle tool execution errors?

4. **General Integration Patterns**
   - Should integrations handle their own errors?
   - Best practice for response transformation?
   - How to handle API versioning?

### Current Patterns to Validate

- [ ] Factory functions: `create[Service]Client(apiKey)`
- [ ] Type derivation: `Awaited<ReturnType<typeof fn>>`
- [ ] Single-file integrations
- [ ] Error delegation to callers

### Known Concerns

- Console.log left in Tavily integration
- No retry logic for API failures
- Type derivation may break if API changes
- No rate limiting handling

### Files to Audit

```
src/integrations/openrouter/client.ts
src/integrations/tavily/web-search.ts
```

### Status: `[ ] Not Started`

---

## Domain 6: Types

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | Check package.json | Type system |
| `ai` (Vercel AI SDK) | Check package.json | UIMessage types |
| `better-auth` | Check package.json | User types |

### Research Questions

1. **Type Organization**
   - When should types go in src/types vs stay in domain?
   - Best practice for re-exporting types?
   - How to handle external library types?

2. **Type Patterns**
   - When to use `type` vs `interface`?
   - Best practice for type inference from functions?
   - How to handle generic type composition?

3. **Cross-Domain Types**
   - Clear criteria for what belongs here?
   - How to prevent circular dependencies?

### Current Patterns to Validate

- [ ] Barrel exports via `index.ts`
- [ ] Type inference: `Awaited<ReturnType<typeof fn>>`
- [ ] `DB_` prefix for database types
- [ ] `Custom` prefix for extended types

### Known Concerns

- `chat.ts` types appear unused
- Some types duplicated between domains
- Unclear criteria for when to add types here

### Files to Audit

```
src/types/index.ts
src/types/chat.ts
src/types/models.ts
```

### Status: `[ ] Not Started`

---

## Domain 7: Testing

### Packages to Research

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | Check package.json | Test runner |

### Research Questions

1. **Test Organization**
   - Should tests be co-located or in src/test?
   - Best practice for test file naming?
   - How to structure test utilities?

2. **Test Patterns**
   - Best practice for mocking in Vitest?
   - How to test server functions?
   - How to test React hooks?

### Current Patterns to Validate

- [ ] Tests co-located with source files (`*.test.ts`)
- [ ] Shared mocks in `src/test/`

### Known Concerns

- Limited test coverage currently
- No documented testing patterns
- Unclear how to test SSR/server code

### Files to Audit

```
src/test/
src/server/utils/encryption.test.ts
```

### Status: `[ ] Not Started`

---

## Progress Tracking

### Overall Status

| Domain | Research | Audit | Remediation | Finalized |
|--------|----------|-------|-------------|-----------|
| Routes | [ ] | [ ] | [ ] | [ ] |
| Server | [ ] | [ ] | [ ] | [ ] |
| Client | [ ] | [ ] | [ ] | [ ] |
| Components | [ ] | [ ] | [ ] | [ ] |
| Integrations | [ ] | [ ] | [ ] | [ ] |
| Types | [ ] | [ ] | [ ] | [ ] |
| Testing | [ ] | [ ] | [ ] | [ ] |

### Investigation Log

Use this section to track findings as investigations progress:

```
### [Date] - Domain Name

**Researcher**: [AI Agent / Human]

**Findings**:
- Finding 1
- Finding 2

**Issues Identified**:
- [ ] Issue 1 (file:line) - Severity
- [ ] Issue 2 (file:line) - Severity

**Actions Taken**:
- Action 1
- Action 2
```

---

## How to Run an Investigation

### Phase 1 Prompt Template

Use this prompt to kick off Phase 1 (Package Research) for any domain:

````
## Domain Pattern Investigation: Phase 1 - [DOMAIN_NAME]

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **[DOMAIN_NAME]** domain.

### Context

Read the investigation plan for this domain in:
- `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (find the [DOMAIN_NAME] section)
- `docs/architecture/DOMAIN-PATTERNS.md` (current documented patterns)

### Your Mission

Research all packages used in this domain to establish best practices BEFORE we standardize our patterns. We need to validate that our current patterns align with official recommendations and identify any anti-patterns.

### Packages to Research

[COPY THE PACKAGES TABLE FROM THE DOMAIN SECTION]

### Research Questions to Answer

[COPY THE RESEARCH QUESTIONS FROM THE DOMAIN SECTION]

### Available Subagents

You have access to specialized subagents that you should use **in parallel** for efficiency:

1. **`web-researcher`** - Use for researching package documentation, best practices, and official recommendations
   - Research official docs for each package
   - Find best practice guides and recommendations
   - Identify common anti-patterns and gotchas
   - Check GitHub issues for known problems

2. **`codebase-analyzer`** - Use for understanding how we currently use each package
   - Analyze current implementation patterns
   - Document how packages are configured
   - Identify integration points between packages

3. **`codebase-pattern-finder`** - Use for finding all usages of package APIs
   - Find all import statements for each package
   - Locate all API usages with file:line references
   - Identify variations in how we use the same APIs

4. **`git-historian`** - Use if you need to understand why certain patterns were chosen
   - Find commits that introduced package usage
   - Understand evolution of patterns over time

### Execution Strategy

1. **First**, spawn `web-researcher` agents IN PARALLEL for each major package to research:
   - Official documentation and getting started guides
   - Best practices and recommended patterns
   - Common anti-patterns and mistakes
   - Cloudflare Workers / edge runtime considerations (if applicable)

2. **Simultaneously**, spawn `codebase-analyzer` and `codebase-pattern-finder` agents to:
   - Document our current usage patterns
   - Find all locations where each package is used
   - Note any variations or inconsistencies

3. **Compile findings** into a structured report

### Expected Output

Provide a comprehensive research report with:

#### 1. Package Best Practices Summary
For each package:
- Official recommended patterns
- Anti-patterns to avoid
- Edge runtime / Cloudflare Workers considerations
- Version-specific notes (if relevant)

#### 2. Current Usage Analysis
For each package:
- How we currently use it (with file:line references)
- Whether our usage aligns with best practices
- Any deviations or concerns identified

#### 3. Gap Analysis
- Patterns we use that ARE recommended ✅
- Patterns we use that are NOT recommended ⚠️
- Recommended patterns we DON'T use yet 📝
- Anti-patterns we're currently using ❌

#### 4. Recommendations
- Critical changes needed (blocking standardization)
- Suggested improvements (nice to have)
- Patterns to keep as-is (validated)

#### 5. Updated Research Questions
- Questions that were answered
- New questions that emerged
- Questions needing human input

### Important Notes

- DO NOT make any code changes in this phase - research only
- DO NOT update DOMAIN-PATTERNS.md yet - that's Phase 4
- Focus on FACTS from documentation, not opinions
- Include source links for all best practice claims
- Flag any conflicting recommendations between sources
````

---

### Quick-Start Prompts by Domain

Copy-paste these to start investigating each domain:

#### Types Domain (Recommended First)
```
## Domain Pattern Investigation: Phase 1 - Types

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Types** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 6: Types section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `typescript` | Type system |
| `ai` (Vercel AI SDK) | UIMessage types |
| `better-auth` | User types |

### Research Questions

1. **Type Organization**: When should types go in src/types vs stay in domain? Best practice for re-exporting types?
2. **Type Patterns**: When to use `type` vs `interface`? Best practice for type inference from functions?
3. **Cross-Domain Types**: Clear criteria for what belongs here? How to prevent circular dependencies?

### Available Subagents (use in parallel)

- `web-researcher` - Research TypeScript best practices, Vercel AI SDK types documentation
- `codebase-analyzer` - Analyze current type definitions and usage
- `codebase-pattern-finder` - Find all type imports/exports across codebase

### Files to Analyze

src/types/index.ts, src/types/chat.ts, src/types/models.ts

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

#### Integrations Domain
```
## Domain Pattern Investigation: Phase 1 - Integrations

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Integrations** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 5: Integrations section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `@openrouter/ai-sdk-provider` | OpenRouter AI SDK adapter |
| `@openrouter/sdk` | OpenRouter direct API |
| `@tavily/core` | Tavily web search |
| `ai` (Vercel AI SDK) | Tool definitions |

### Research Questions

1. **OpenRouter**: Is factory pattern recommended? Best practice for API key handling and headers?
2. **Tavily**: Is tool wrapper pattern correct? Best practice for result transformation?
3. **Vercel AI SDK Tools**: Is our tool definition structure correct? How to handle tool execution errors?
4. **General**: Should integrations handle their own errors? Best practice for response transformation?

### Available Subagents (use in parallel)

- `web-researcher` - Research OpenRouter docs, Tavily docs, Vercel AI SDK tool documentation
- `codebase-analyzer` - Analyze current integration implementations
- `codebase-pattern-finder` - Find all usages of integration exports

### Files to Analyze

src/integrations/openrouter/client.ts, src/integrations/tavily/web-search.ts

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

#### Server Domain
```
## Domain Pattern Investigation: Phase 1 - Server

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Server** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 2: Server section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `@tanstack/react-start` | createServerFn, createMiddleware, createServerOnlyFn |
| `drizzle-orm` | Database ORM, queries, schema |
| `postgres` (postgres-js) | PostgreSQL driver |
| `better-auth` | Authentication |
| `zod` | Input validation |
| `nanoid` | ID generation |

### Research Questions

1. **Server Functions**: Is `createServerFn().middleware([]).inputValidator().handler()` canonical? Best error handling?
2. **Middleware**: Is composing via `.middleware([parent])` correct? Context typing best practices?
3. **Database (Drizzle)**: Best patterns for Cloudflare Workers? `db.query.*` vs `db.select().from()`? Transactions?
4. **Authentication (Better Auth)**: Is factory pattern right? Best practice for TanStack Start integration?
5. **Cloudflare Workers**: Is `createServerOnlyFn()` necessary? Best practice for connection pooling?

### Available Subagents (use in parallel)

- `web-researcher` - Research TanStack Start docs, Drizzle ORM docs, Better Auth docs, postgres-js Cloudflare guide
- `codebase-analyzer` - Analyze server action patterns, middleware chain, database usage
- `codebase-pattern-finder` - Find all server function definitions, middleware usages, DB queries

### Files to Analyze

All files in src/server/ (config.ts, db/, auth/, middleware/, actions/, utils/)

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

#### Client Domain
```
## Domain Pattern Investigation: Phase 1 - Client

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Client** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 3: Client section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Server state management |
| `zustand` | Client state management |
| `@electric-sql/pglite` | Local PostgreSQL (WASM) |
| `drizzle-orm` | Local database ORM |
| `better-auth/react` | Auth client hooks |
| `ai` (Vercel AI SDK) | AI chat hooks |

### Research Questions

1. **TanStack Query**: Is our query key factory optimal? Best practice for optimistic updates? `ensureQueryData` vs `prefetchQuery`?
2. **Zustand**: Should we separate state/actions interfaces? Best practice for derived state and selectors?
3. **PGlite**: Is singleton with lazy init correct? Best practice for migrations and error handling?
4. **Vercel AI SDK**: Is `useChat` hook used correctly? Best practice for streaming state?
5. **Auth Client**: Is destructuring from `createAuthClient()` the right pattern?

### Available Subagents (use in parallel)

- `web-researcher` - Research TanStack Query v5 docs, Zustand best practices, PGlite docs, Vercel AI SDK React docs
- `codebase-analyzer` - Analyze hooks, stores, actions, and their interactions
- `codebase-pattern-finder` - Find all query keys, store usages, action calls

### Files to Analyze

All files in src/client/ (auth.ts, db/, hooks/, stores/, actions/, storage/, utils/, queries/)

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

#### Components Domain
```
## Domain Pattern Investigation: Phase 1 - Components

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Components** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 4: Components section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `react` | Component fundamentals |
| `@radix-ui/*` | Primitive components |
| `class-variance-authority` | Variant management |
| `tailwind-merge` | Class merging |
| `clsx` | Conditional classes |
| `lucide-react` | Icons |

### Research Questions

1. **shadcn/ui Patterns**: Are we following conventions correctly? Should all components use `data-slot`?
2. **Radix UI**: Are we wrapping primitives correctly? Accessibility best practices?
3. **CVA**: Is our variant structure optimal? When to use CVA vs simple cn()?
4. **React Patterns**: When forwardRef vs function components? Best prop typing practices?
5. **Feature Components**: How much logic should live in components? When to split?

### Available Subagents (use in parallel)

- `web-researcher` - Research shadcn/ui docs, Radix UI patterns, CVA best practices, React 19 patterns
- `codebase-analyzer` - Analyze UI components structure, feature component patterns
- `codebase-pattern-finder` - Find all CVA usages, forwardRef usages, cn() patterns

### Files to Analyze

Key files in src/components/ (ui/button.tsx, ui/dialog.tsx, ui/sidebar.tsx, chat/*, nav/*)

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

#### Routes Domain
```
## Domain Pattern Investigation: Phase 1 - Routes

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Routes** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 1: Routes section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `@tanstack/react-router` | File-based routing, loaders, type-safe navigation |
| `@tanstack/react-start` | SSR, server functions, middleware |

### Research Questions

1. **Route Definition**: Is `createFileRoute` recommended for all routes? `beforeLoad` vs `loader` vs both?
2. **Data Loading**: Best practice for TanStack Query integration with loaders? How to handle `notFound()` and `redirect()`?
3. **API Routes**: Is `server.handlers` pattern recommended? Middleware composition best practices?
4. **Component Patterns**: Should route components use `Route.useLoaderData()` or alternatives?

### Available Subagents (use in parallel)

- `web-researcher` - Research TanStack Router docs, TanStack Start docs, SSR best practices
- `codebase-analyzer` - Analyze route definitions, loader patterns, API route structure
- `codebase-pattern-finder` - Find all createFileRoute usages, loader patterns, redirect/notFound usages

### Files to Analyze

All files in src/routes/ (__root.tsx, index.tsx, login.tsx, dashboard.tsx, dashboard/*, api/*)

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

#### Testing Domain
```
## Domain Pattern Investigation: Phase 1 - Testing

You are conducting Phase 1 (Package Research) of the domain pattern investigation for the **Testing** domain.

### Context

Read the investigation plan in `docs/architecture/DOMAIN-PATTERN-INVESTIGATION.md` (Domain 7: Testing section) and current patterns in `docs/architecture/DOMAIN-PATTERNS.md`.

### Packages to Research

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner |

### Research Questions

1. **Test Organization**: Should tests be co-located or in src/test? Best practice for test file naming?
2. **Test Patterns**: Best practice for mocking in Vitest? How to test server functions? How to test React hooks?

### Available Subagents (use in parallel)

- `web-researcher` - Research Vitest best practices, testing TanStack Start apps, testing React hooks
- `codebase-analyzer` - Analyze existing test structure and patterns
- `codebase-pattern-finder` - Find all test files, mock usages, test utilities

### Files to Analyze

src/test/, src/server/utils/encryption.test.ts

Execute Phase 1 research and provide a comprehensive report. DO NOT make code changes.
```

---

## Notes

- Each domain investigation is independent and can be done in any order
- Prioritize domains with the most external package dependencies
- Document all findings for future reference
- Update DOMAIN-PATTERNS.md only after validation is complete
