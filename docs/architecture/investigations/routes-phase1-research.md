# Routes Domain - Phase 1 Research Report

**Date**: 2025-11-28
**Domain**: Routes (`src/routes/`)
**Status**: Research Complete - Ready for Phase 2 Audit

---

## Executive Summary

This report documents the findings from Phase 1 (Package Research) of the Routes domain investigation. We researched TanStack Router and TanStack Start best practices, then analyzed the current codebase implementation to identify alignment and gaps.

### Key Findings

| Category | Status | Summary |
|----------|--------|---------|
| Route Definition | ✅ Aligned | `createFileRoute` pattern correctly used |
| Auth Guards | ⚠️ Inconsistent | 4 different patterns found across routes |
| Data Loading | ⚠️ Mixed | Some routes use queryClient, others don't |
| Component Naming | ⚠️ Inconsistent | Mix of generic and descriptive names |
| API Routes | ✅ Aligned | `server.handlers` pattern correct |
| beforeLoad vs loader | ⚠️ Unclear | No consistent convention |

---

## 1. Package Best Practices Summary

### @tanstack/react-router

#### Route Definition
- **`createFileRoute`** is the recommended pattern for all file-based routes
- **Benefits**: Simplicity, scalability, automatic code-splitting, type-safety
- File naming conventions: `$param.tsx` for dynamic, `$.ts` for catch-all, `__root.tsx` for root

#### beforeLoad vs loader

| Aspect | `beforeLoad` | `loader` |
|--------|--------------|----------|
| **Execution** | Serial (blocks everything) | Parallel (with component preload) |
| **Purpose** | Auth guards, context injection | Data fetching |
| **Timing** | Runs BEFORE child routes' beforeLoad | Runs in parallel with siblings |
| **Warning** | "Be extremely careful what you do here" | Primary data loading location |

**Official recommendation**:
> "The main use case [for beforeLoad] is to dump auth into the context so that way you can reference the user every time the loaders do run."

#### Auth Guards
- **Recommended**: Use `beforeLoad` with `throw redirect()`
- **Pattern**: Create layout route (e.g., `dashboard.tsx`) with auth check that protects all children
- **Warning**: Don't throw `notFound()` in `beforeLoad` - always triggers root notFoundComponent

#### TanStack Query Integration
- **Recommended**: `ensureQueryData` in loaders + `useSuspenseQuery` in components
- **Pattern**:
```typescript
loader: ({ context }) => context.queryClient.ensureQueryData(queryOptions),
component: () => {
  const { data } = useSuspenseQuery(queryOptions) // Preferred
}
```

- **`ensureQueryData` vs `prefetchQuery`**:
  - `ensureQueryData`: Returns cached data if available, fetches if not
  - `prefetchQuery`: Respects staleTime, good for non-critical data
  - Can mix both for critical vs secondary data

#### Error Handling
- **Both should be THROWN**: `throw redirect()` and `throw notFound()`
- **`notFound()`**: Recommended in `loader`, NOT in `beforeLoad`
- **`redirect()`**: Can be in either, but `beforeLoad` for auth guards

#### Component Patterns
- **Primary**: `Route.useLoaderData()` for accessing loader data
- **Alternative**: `getRouteApi('/path')` for deep components (avoids circular imports)
- **Params**: `Route.useParams()` or `useParams({ from: '/path' })`

#### Root Route
- **Pattern**: `createRootRouteWithContext<{ queryClient: QueryClient }>()`
- **Purpose**: Define typed context available to all routes
- **Note**: Root route does NOT support code splitting

### @tanstack/react-start

#### Critical Understanding: Loaders are Isomorphic
> "All code in TanStack Start is isomorphic by default"

- **Loaders run on BOTH server (SSR) and client (navigation)**
- **Server functions (`createServerFn`) are server-only, callable from anywhere**
- **Anti-pattern**: Accessing `process.env` secrets directly in loaders (exposes to client!)

#### Recommended Pattern
```typescript
// Server function (server-only)
const getSecureData = createServerFn().handler(() => {
  const secret = process.env.SECRET // Safe
  return db.query()
})

// Loader (isomorphic - calls server function)
loader: () => getSecureData()
```

#### API Routes
- **Pattern**: `server.handlers` with HTTP methods is correct
- **Middleware**: Applied via `server.middleware: [...]` array
- **Context**: Handlers receive `{ request, context }` object
- **Response**: Return standard `Response` objects or use `json()` helper

#### Middleware Composition
- **Principle**: "All middleware is composable"
- **Order**: Dependency-first (global → function-specific)
- **Must call `next()`** to continue chain
- **Context inheritance**: Parent middleware context flows to children

#### Cloudflare Workers Considerations
- Bindings may not be accessible in SSR pipeline (known issue #3468)
- Workaround: Access bindings through middleware context
- Test with `preview` before deploying

---

## 2. Current Usage Analysis

### Route Files Analyzed

| File | Pattern | beforeLoad | loader | queryClient |
|------|---------|------------|--------|-------------|
| `__root.tsx` | `createRootRouteWithContext` | No | No | Defines context |
| `index.tsx` | `createFileRoute` | Yes (auth) | No | No |
| `login.tsx` | `createFileRoute` | Yes (auth) | No | No |
| `signup.tsx` | `createFileRoute` | Yes (auth) | No | No |
| `unauthorized.tsx` | `createFileRoute` | No | No | No |
| `dashboard.tsx` | `createFileRoute` | Yes (fetch) | Yes (validate) | No |
| `dashboard/index.tsx` | `createFileRoute` | No | Yes (unused) | No |
| `dashboard/new.tsx` | `createFileRoute` | No | Yes (check) | No |
| `dashboard/settings.tsx` | `createFileRoute` | No | Yes | **Yes** ✅ |
| `dashboard/models.tsx` | `createFileRoute` | No | Yes (auth+data) | No |
| `dashboard/c.$chatId.tsx` | `createFileRoute` | No | Yes | **Yes** ✅ |
| `api/chat.ts` | `createFileRoute` | No | No | N/A (API) |
| `api/auth/$.ts` | `createFileRoute` | No | No | N/A (API) |

### Auth Guard Patterns Found

**Pattern A: beforeLoad with client getSession()** (3 files)
```typescript
// index.tsx, login.tsx, signup.tsx
beforeLoad: async () => {
  const session = await getSession();
  if (session.data?.user) throw redirect({ to: "/dashboard" });
}
```
- Location: [index.tsx:6-13](src/routes/index.tsx#L6-L13), [login.tsx:15-20](src/routes/login.tsx#L15-L20), [signup.tsx:15-20](src/routes/signup.tsx#L15-L20)

**Pattern B: beforeLoad + loader combined** (1 file)
```typescript
// dashboard.tsx
beforeLoad: async () => {
  const data = await getUser(); // Server action
  return { user: data };
},
loader: async ({ context }) => {
  if (!context?.user) throw redirect({ to: "/login" });
  return { user: context.user };
}
```
- Location: [dashboard.tsx:8-21](src/routes/dashboard.tsx#L8-L21)

**Pattern C: Manual auth check in loader** (1 file)
```typescript
// dashboard/models.tsx
loader: async ({ context }) => {
  const userId = context.user?.id;
  if (!userId) throw redirect({ to: "/login" });
}
```
- Location: [dashboard/models.tsx:28-32](src/routes/dashboard/models.tsx#L28-L32)

**Pattern D: Inherit from parent** (4 files)
- `dashboard/index.tsx`, `dashboard/new.tsx`, `dashboard/settings.tsx`, `dashboard/c.$chatId.tsx`
- Rely on parent `/dashboard` route for auth

### Component Naming Analysis

| Name Type | Count | Files |
|-----------|-------|-------|
| Generic `RouteComponent` | 4 | login, signup, dashboard, unauthorized |
| Descriptive | 5 | DashboardIndex, ChatView, NewChatView, ModelsView, SettingsView |
| Other (`App`) | 1 | index.tsx |

---

## 3. Gap Analysis

### Patterns We Use That ARE Recommended ✅

1. **`createFileRoute` for all routes** - Correct
2. **`createRootRouteWithContext` for root** - Correct with QueryClient context
3. **`throw redirect()` for auth guards** - Correct
4. **`throw notFound()` in loader** - Correct (only in c.$chatId.tsx)
5. **`server.handlers` for API routes** - Correct
6. **Middleware composition** - Correct (global → protected chain)
7. **`Route.useLoaderData()` in components** - Correct
8. **`context.queryClient.ensureQueryData()`** - Correct in 2 routes

### Patterns We Use That Are NOT Recommended ⚠️

1. **Double auth check in dashboard.tsx**
   - `beforeLoad` fetches user, `loader` validates
   - Should consolidate: either `beforeLoad` only or `loader` only
   - Location: [dashboard.tsx:8-21](src/routes/dashboard.tsx#L8-L21)

2. **Redundant auth check in child route**
   - `dashboard/models.tsx` checks auth when parent already does
   - Location: [dashboard/models.tsx:28-32](src/routes/dashboard/models.tsx#L28-L32)

3. **Inconsistent component naming**
   - Mix of `RouteComponent` and descriptive names
   - Should standardize on descriptive names

4. **Dead code in index.tsx**
   - Component never renders (all paths redirect)
   - Location: [index.tsx:16-46](src/routes/index.tsx#L16-L46)

5. **Unused loader data in dashboard/index.tsx**
   - Returns `{ hasChats: false }` but never accessed
   - Location: [dashboard/index.tsx:16](src/routes/dashboard/index.tsx#L16)

### Recommended Patterns We DON'T Use Yet 📝

1. **Consistent queryClient integration**
   - Only 2/7 routes with loaders use queryClient
   - Others call server actions directly
   - Recommendation: Use queryClient for cacheable data

2. **`useSuspenseQuery` in components**
   - Routes use `useLoaderData()` but not suspense queries
   - Consider for components that need fresh data

3. **`getRouteApi()` for deep components**
   - Not currently used
   - Would help avoid circular imports in large components

4. **Code splitting with `.lazy.tsx`**
   - Not currently used
   - Could improve bundle size for large routes

### Anti-Patterns We're Currently Using ❌

1. **Debug console.log in production** ([api/chat.ts:35](src/routes/api/chat.ts#L35))
   ```typescript
   console.log(body); // Should be removed
   ```

2. **Heavy useEffect initialization** ([dashboard/new.tsx:44-85](src/routes/dashboard/new.tsx#L44-L85))
   - Complex async logic should be in loader
   - Uses ref guard for strict mode - code smell

3. **Type assertions for AI SDK** ([dashboard/c.$chatId.tsx:32-36](src/routes/dashboard/c.$chatId.tsx#L32-L36))
   - Multiple `as` casts to work around type issues
   - Documented with comments, but not ideal

4. **Duplicate streamText logic** ([api/chat.ts:121-182](src/routes/api/chat.ts#L121-L182))
   - Three nearly identical code blocks
   - Should be extracted to helper

---

## 4. Recommendations

### Critical Changes (Blocking Standardization)

1. **Standardize auth guard pattern**
   - Recommendation: Use `beforeLoad` in layout routes only, children inherit
   - Remove redundant checks in `dashboard/models.tsx`
   - Simplify `dashboard.tsx` to either beforeLoad OR loader

2. **Remove dead/unused code**
   - Remove unreachable component in `index.tsx`
   - Remove unused loader in `dashboard/index.tsx` or use the data

3. **Fix debug code**
   - Remove `console.log(body)` from `api/chat.ts`

### Suggested Improvements (Nice to Have)

1. **Standardize component naming**
   - Use descriptive names: `LoginView`, `SignupView`, `DashboardLayout`
   - Update all `RouteComponent` references

2. **Consistent queryClient usage**
   - Migrate `dashboard/models.tsx` to use queryClient pattern
   - Add query keys for server action calls

3. **Extract API route helpers**
   - Create shared `streamText` wrapper in `api/chat.ts`
   - Reduce code duplication

4. **Move initialization logic**
   - Move `dashboard/new.tsx` useEffect logic to loader
   - Remove ref guard

### Patterns to Keep As-Is (Validated) ✅

1. `createFileRoute` pattern for all routes
2. `createRootRouteWithContext` with QueryClient
3. `server.handlers` with middleware arrays
4. `throw redirect()` and `throw notFound()` patterns
5. Middleware composition (global → auth → protected)
6. `Route.useLoaderData()` in components
7. `context.queryClient.ensureQueryData()` where used

---

## 5. Research Questions - Answers

### Original Questions

1. **Is `createFileRoute` recommended for all routes?**
   - ✅ Yes, confirmed by official docs

2. **`beforeLoad` vs `loader` vs both?**
   - `beforeLoad`: Auth guards, context injection (serial, blocking)
   - `loader`: Data fetching (parallel)
   - Both: Only when `beforeLoad` provides context needed by `loader`

3. **Best practice for TanStack Query integration?**
   - `ensureQueryData` in loaders + `useSuspenseQuery` in components
   - Define `queryOptions` objects for reuse

4. **How to handle `notFound()` and `redirect()`?**
   - Both should be **thrown**
   - `notFound()` in `loader` (not `beforeLoad`)
   - `redirect()` in either, `beforeLoad` for auth

5. **Is `server.handlers` pattern recommended?**
   - ✅ Yes, official pattern for API routes

6. **Should components use `Route.useLoaderData()`?**
   - ✅ Yes, primary pattern
   - Alternative: `getRouteApi()` for deep components

### New Questions Emerged

1. **Should we migrate all loaders to use queryClient?**
   - Trade-off: More boilerplate vs better caching
   - Answer: Yes for cacheable data, no for one-off fetches

2. **How to handle AI SDK type incompatibilities?**
   - Current: Type assertions with comments
   - Need: Better solution or upstream fix

3. **Should we use `.lazy.tsx` code splitting?**
   - Would reduce initial bundle
   - Consider for large route components

### Questions Needing Human Input

1. **Preferred auth guard pattern?**
   - Option A: `beforeLoad` in layout routes only (current partial)
   - Option B: Protected middleware on all routes
   - Option C: Per-route auth checks

2. **Component naming convention?**
   - Option A: `RouteComponent` (generic, shorter)
   - Option B: Descriptive names like `SettingsView` (clearer, longer)

3. **queryClient usage requirement?**
   - Option A: Required for all data loading
   - Option B: Optional, use when caching beneficial
   - Option C: Only for routes with React Query hooks

---

## 6. Files Reference

### Routes Analyzed
- [src/routes/__root.tsx](src/routes/__root.tsx)
- [src/routes/index.tsx](src/routes/index.tsx)
- [src/routes/login.tsx](src/routes/login.tsx)
- [src/routes/signup.tsx](src/routes/signup.tsx)
- [src/routes/unauthorized.tsx](src/routes/unauthorized.tsx)
- [src/routes/dashboard.tsx](src/routes/dashboard.tsx)
- [src/routes/dashboard/index.tsx](src/routes/dashboard/index.tsx)
- [src/routes/dashboard/new.tsx](src/routes/dashboard/new.tsx)
- [src/routes/dashboard/settings.tsx](src/routes/dashboard/settings.tsx)
- [src/routes/dashboard/models.tsx](src/routes/dashboard/models.tsx)
- [src/routes/dashboard/c.$chatId.tsx](src/routes/dashboard/c.$chatId.tsx)
- [src/routes/api/chat.ts](src/routes/api/chat.ts)
- [src/routes/api/auth/$.ts](src/routes/api/auth/$.ts)

### Documentation Sources
- [TanStack Router - File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing)
- [TanStack Router - Data Loading](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading)
- [TanStack Router - Authenticated Routes](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes)
- [TanStack Router - Query Integration](https://tanstack.com/router/latest/docs/integrations/query)
- [TanStack Router - Not Found Errors](https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors)
- [TanStack Router - Router Context](https://tanstack.com/router/latest/docs/framework/react/guide/router-context)
- [TanStack Start - Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [TanStack Start - Server Routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [TanStack Start - Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [Cloudflare Workers - TanStack Start Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)

---

## Next Steps

1. **Phase 2: Code Audit** - Document specific issues with severity ratings
2. **Phase 3: Remediation** - Fix issues identified above
3. **Phase 4: Pattern Finalization** - Update DOMAIN-PATTERNS.md with validated patterns

---

*Report generated by AI research agents on 2025-11-28*
