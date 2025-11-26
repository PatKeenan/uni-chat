# Domain Migration Tracker

This document tracks progress on reorganizing the codebase into the domain structure defined in `DOMAIN-ARCHITECTURE.md`.

**Important:** This is a living document. Update it as work progresses so any agent can pick up where work stopped.

---

## Current Status

| Domain | Status | Progress |
|--------|--------|----------|
| Routing | No changes needed | N/A |
| Server | COMPLETE | 100% |
| Client | COMPLETE | 100% |
| Components | COMPLETE | 100% |
| Integrations | COMPLETE | 100% |
| Types | PARTIAL | 50% |
| Testing | No changes needed | N/A |

**Last Updated:** 2025-11-26

---

## Migration Order

Work through domains in this order:

1. [Server](#phase-1-server-domain)
2. [Client](#phase-2-client-domain)
3. [Components](#phase-3-components-domain)
4. [Integrations](#phase-4-integrations-domain)
5. [Types](#phase-5-types-domain)

---

## Phase 1: Server Domain

**Goal:** Move `src/lib/server/` → `src/server/`

### Tasks

- [x] Create `src/server/` directory
- [x] Move `src/lib/server/actions/` → `src/server/actions/`
- [x] Move `src/lib/server/middleware/` → `src/server/middleware/`
- [x] Move `src/lib/server/db/` → `src/server/db/`
- [x] Move `src/lib/server/auth/` → `src/server/auth/`
- [x] Move `src/lib/server/utils/` → `src/server/utils/`
- [x] Move `src/lib/server/loadConfig.ts` → `src/server/config.ts`
- [x] Move AI tools: `src/lib/server/ai-tools/` → `src/integrations/tavily/`
- [x] Update all imports across codebase
- [x] Verify build passes
- [x] Verify tests pass
- [x] Delete empty `src/lib/server/` directory

### Files to Move

| Source | Destination | Status |
|--------|-------------|--------|
| `src/lib/server/actions/auth-actions.ts` | `src/server/actions/auth-actions.ts` | [x] |
| `src/lib/server/actions/chat-actions.ts` | `src/server/actions/chat-actions.ts` | [x] |
| `src/lib/server/actions/message-actions.ts` | `src/server/actions/message-actions.ts` | [x] |
| `src/lib/server/actions/folder-actions.ts` | `src/server/actions/folder-actions.ts` | [x] |
| `src/lib/server/actions/model-actions.ts` | `src/server/actions/model-actions.ts` | [x] |
| `src/lib/server/actions/api-key-actions.ts` | `src/server/actions/api-key-actions.ts` | [x] |
| `src/lib/server/middleware/global-middleware.ts` | `src/server/middleware/global-middleware.ts` | [x] |
| `src/lib/server/middleware/auth-middleware.ts` | `src/server/middleware/auth-middleware.ts` | [x] |
| `src/lib/server/middleware/protected-middleware.ts` | `src/server/middleware/protected-middleware.ts` | [x] |
| `src/lib/server/db/index.ts` | `src/server/db/index.ts` | [x] |
| `src/lib/server/db/schema.ts` | `src/server/db/schema.ts` | [x] |
| `src/lib/server/db/schema/index.ts` | `src/server/db/schema/index.ts` | [x] |
| `src/lib/server/db/schema/server-only.ts` | `src/server/db/schema/server-only.ts` | [x] |
| `src/lib/server/auth/index.ts` | `src/server/auth/index.ts` | [x] |
| `src/lib/server/utils/encryption.ts` | `src/server/utils/encryption.ts` | [x] |
| `src/lib/server/utils/encryption.test.ts` | `src/server/utils/encryption.test.ts` | [x] |
| `src/lib/server/loadConfig.ts` | `src/server/config.ts` | [x] |
| `src/lib/server/ai-tools/web-search.ts` | `src/integrations/tavily/web-search.ts` | [x] |

### Import Updates Required

After moving files, update imports in these locations:

- [x] `src/routes/api/auth/$.ts` - middleware imports
- [x] `src/routes/api/chat.ts` - middleware, actions imports
- [x] `src/routes/dashboard.tsx` - auth actions
- [x] `src/routes/dashboard/new.tsx` - server actions
- [x] `src/routes/dashboard/settings.tsx` - server actions
- [x] `src/routes/dashboard/c.$chatId.tsx` - server actions (no changes needed)
- [x] `src/routes/dashboard/models.tsx` - server actions
- [x] `src/routes/login.tsx` - if any server imports (no changes needed)
- [x] `src/routes/signup.tsx` - if any server imports (no changes needed)
- [x] Internal server file imports (middleware chain, etc.)
- [x] `src/lib/client/queries/auth-queries.ts` - auth actions
- [x] `src/lib/client/hooks/use-models.ts` - model actions
- [x] `src/components/nav-starred-models.tsx` - model actions
- [x] `src/test/utils/test-helpers.ts` - schema imports

### Verification

- [x] `bun run build` succeeds
- [x] `bun test` passes (34 tests passing)
- [ ] App runs locally without errors
- [ ] Auth flow works (login, logout)
- [ ] Chat creation works
- [ ] Chat streaming works

---

## Phase 2: Client Domain

**Goal:** Move `src/lib/client/` → `src/client/` and consolidate scattered client files

### Tasks

- [x] Create `src/client/` directory structure
- [x] Move `src/lib/client/hooks/` → `src/client/hooks/`
- [x] Move `src/lib/client/actions/` → `src/client/actions/`
- [x] Move `src/lib/client/queries/` → `src/client/queries/`
- [x] Move `src/lib/client/db/` → `src/client/db/`
- [x] Move `src/lib/client/storage/` → `src/client/storage/`
- [x] Move `src/lib/client/utils/` → `src/client/utils/`
- [x] Move `src/lib/client/auth-client.ts` → `src/client/auth.ts`
- [x] Move `src/lib/client/types.ts` → `src/types/models.ts` (consolidate)
- [x] Create `src/client/stores/` directory
- [x] Move `src/chat-store.ts` → `src/client/stores/chat-store.ts`
- [x] Consolidate hooks: Delete duplicate `src/hooks/use-mobile.ts`, move `src/components/hooks/use-mobile.ts` → `src/client/hooks/`
- [x] Update all imports across codebase
- [x] Delete empty directories (`src/lib/client/`, `src/hooks/`, `src/components/hooks/`)
- [x] Verify build and tests

### Files to Move

| Source | Destination | Status |
|--------|-------------|--------|
| `src/lib/client/hooks/use-chat-stream.ts` | `src/client/hooks/use-chat-stream.ts` | [x] |
| `src/lib/client/hooks/use-local-chats.ts` | `src/client/hooks/use-local-chats.ts` | [x] |
| `src/lib/client/hooks/use-local-folders.ts` | `src/client/hooks/use-local-folders.ts` | [x] |
| `src/lib/client/hooks/use-local-messages.ts` | `src/client/hooks/use-local-messages.ts` | [x] |
| `src/lib/client/hooks/use-models.ts` | `src/client/hooks/use-models.ts` | [x] |
| `src/lib/client/hooks/use-data-management.ts` | `src/client/hooks/use-data-management.ts` | [x] |
| `src/lib/client/actions/chat-actions.ts` | `src/client/actions/chat-actions.ts` | [x] |
| `src/lib/client/actions/message-actions.ts` | `src/client/actions/message-actions.ts` | [x] |
| `src/lib/client/actions/folder-actions.ts` | `src/client/actions/folder-actions.ts` | [x] |
| `src/lib/client/actions/model-actions.ts` | `src/client/actions/model-actions.ts` | [x] |
| `src/lib/client/actions/data-actions.ts` | `src/client/actions/data-actions.ts` | [x] |
| `src/lib/client/queries/auth-queries.ts` | `src/client/queries/auth-queries.ts` | [x] |
| `src/lib/client/queries/data-queries.ts` | `src/client/queries/data-queries.ts` | [x] |
| `src/lib/client/db/index.ts` | `src/client/db/index.ts` | [x] |
| `src/lib/client/db/migrations.ts` | `src/client/db/migrations.ts` | [x] |
| `src/lib/client/db/schema/index.ts` | `src/client/db/schema/index.ts` | [x] |
| `src/lib/client/db/schema/client-only.ts` | `src/client/db/schema/client-only.ts` | [x] |
| `src/lib/client/storage/api-key.ts` | `src/client/storage/api-key.ts` | [x] |
| `src/lib/client/storage/default-model.ts` | `src/client/storage/default-model.ts` | [x] |
| `src/lib/client/utils/generate-chat-title.ts` | `src/client/utils/generate-chat-title.ts` | [x] |
| `src/lib/client/utils/to-ui-message.ts` | `src/client/utils/to-ui-message.ts` | [x] |
| `src/lib/client/auth-client.ts` | `src/client/auth.ts` | [x] |
| `src/lib/client/types.ts` | `src/types/models.ts` | [x] |
| `src/chat-store.ts` | `src/client/stores/chat-store.ts` | [x] |
| `src/hooks/use-mobile.ts` | DELETE (duplicate) | [x] |
| `src/components/hooks/use-mobile.ts` | `src/client/hooks/use-mobile.ts` | [x] |

### Verification

- [x] `bun run build` succeeds
- [x] `bun test` passes (34 tests)
- [ ] Chat input works
- [ ] Model selection works
- [ ] Local storage persists
- [ ] Mobile responsive works

---

## Phase 3: Components Domain

**Goal:** Organize components into feature subdirectories

### Tasks

- [x] Create `src/components/chat/` directory
- [x] Create `src/components/nav/` directory
- [x] Create `src/components/shared/` directory
- [x] Move chat components to `chat/`
- [x] Move nav components to `nav/`
- [x] Move utility components to `shared/`
- [x] Delete empty `src/components/hooks/` (hooks moved to client in Phase 2)
- [x] Update all imports
- [x] Verify build and tests

### Files to Move

| Source | Destination | Status |
|--------|-------------|--------|
| `src/components/chat-view-content.tsx` | `src/components/chat/chat-view-content.tsx` | [x] |
| `src/components/chat-header.tsx` | `src/components/chat/chat-header.tsx` | [x] |
| `src/components/chat-message.tsx` | `src/components/chat/chat-message.tsx` | [x] |
| `src/components/chat-message-list.tsx` | `src/components/chat/chat-message-list.tsx` | [x] |
| `src/components/chat-input.tsx` | `src/components/chat/chat-input.tsx` | [x] |
| `src/components/chat-empty-state.tsx` | `src/components/chat/chat-empty-state.tsx` | [x] |
| `src/components/code-block.tsx` | `src/components/chat/code-block.tsx` | [x] |
| `src/components/app-sidebar.tsx` | `src/components/nav/app-sidebar.tsx` | [x] |
| `src/components/nav-folders.tsx` | `src/components/nav/nav-folders.tsx` | [x] |
| `src/components/nav-user.tsx` | `src/components/nav/nav-user.tsx` | [x] |
| `src/components/nav-main.tsx` | `src/components/nav/nav-main.tsx` | [x] |
| `src/components/nav-projects.tsx` | `src/components/nav/nav-projects.tsx` | [x] |
| `src/components/nav-starred-models.tsx` | `src/components/nav/nav-starred-models.tsx` | [x] |
| `src/components/default-catch-boundary.tsx` | `src/components/shared/default-catch-boundary.tsx` | [x] |
| `src/components/not-found.tsx` | `src/components/shared/not-found.tsx` | [x] |
| `src/components/hooks/use-mobile.ts` | DELETE (moved to client in Phase 2) | [x] |

### Verification

- [x] `bun run build` succeeds
- [ ] All pages render correctly
- [ ] Sidebar works
- [ ] Chat interface works

---

## Phase 4: Integrations Domain

**Goal:** Consolidate third-party integrations into dedicated directory

### Tasks

- [x] Create `src/integrations/` directory
- [x] Create `src/integrations/openrouter/` directory
- [x] Create `src/integrations/tavily/` directory
- [x] Move OpenRouter client
- [x] Move Tavily web search tool (moved during Phase 1)
- [x] Update imports for Tavily
- [x] Update imports for OpenRouter
- [x] Verify build and tests

### Files to Move

| Source | Destination | Status |
|--------|-------------|--------|
| `src/lib/openrouter/client.ts` | `src/integrations/openrouter/client.ts` | [x] |
| `src/lib/server/ai-tools/web-search.ts` | `src/integrations/tavily/web-search.ts` | [x] |

### Import Updates Required

- [x] `src/routes/api/chat.ts` - OpenRouter client import
- [x] `src/routes/dashboard/models.tsx` - OpenRouterModel type import
- [x] `src/server/actions/model-actions.ts` - fetchOpenRouterModels import
- [x] `src/server/actions/api-key-actions.ts` - fetchOpenRouterModels import
- [x] `src/client/actions/model-actions.ts` - fetchOpenRouterModels import

### Verification

- [x] `bun run build` succeeds
- [x] `bun test` passes (34 tests)
- [ ] Model fetching works
- [ ] Web search tool works in chat

---

## Phase 5: Types Domain

**Goal:** Consolidate scattered type definitions

### Tasks

- [ ] Review `src/types/chat.ts` - keep as is
- [x] Move `src/lib/client/types.ts` → `src/types/models.ts` (done in Phase 2)
- [ ] Create `src/types/index.ts` for re-exports
- [x] Update imports (done in Phase 2)
- [ ] Verify build

### Files to Move/Create

| Source | Destination | Status |
|--------|-------------|--------|
| `src/types/chat.ts` | Keep | [ ] |
| `src/lib/client/types.ts` | `src/types/models.ts` | [x] |
| (new file) | `src/types/index.ts` | [ ] |

### Verification

- [x] `bun run build` succeeds
- [ ] Type checking passes

---

## Final Cleanup

After all phases complete:

- [ ] Delete `src/lib/` directory (should be empty) - Note: still contains `utils.ts` and `utils.test.ts` (used by 27 files)
- [x] Delete `src/hooks/` directory (done in Phase 2)
- [ ] Update `tsconfig.json` with new path aliases
- [ ] Update any documentation referencing old paths
- [x] Full test suite passes (34 tests)
- [ ] Manual smoke test of all features

---

## Notes

Add notes here as work progresses:

- Tavily web-search was moved to `src/integrations/tavily/` during Phase 1 (Server domain migration) for logical consistency, since it's an integration rather than core server code.
- `src/lib/utils.ts` remains in place - it's a shared utility (`cn` function) used by 27 files (mostly shadcn/ui components). This is not an integration and shouldn't be moved as part of Phase 4. Consider keeping it in `src/lib/` or moving to a shared utilities location in a future cleanup.

---

## Completed Work Log

Record completed work here with dates:

| Date | Phase | Work Completed | Agent/Person |
|------|-------|----------------|--------------|
| 2025-11-26 | Phase 1 (Server) | Migrated all server files from `src/lib/server/` to `src/server/`, updated 18 files, all imports updated, build and tests passing | Claude (Opus 4.5) |
| 2025-11-26 | Phase 2 (Client) | Migrated all client files from `src/lib/client/` to `src/client/`, moved `chat-store.ts` to `src/client/stores/`, consolidated `use-mobile.ts` hooks, moved `types.ts` to `src/types/models.ts`, updated 27+ files, all imports updated, build and 34 tests passing | Claude (Opus 4.5) |
| 2025-11-26 | Phase 3 (Components) | Organized components into feature subdirectories: 7 chat components → `src/components/chat/`, 6 nav components → `src/components/nav/`, 2 shared components → `src/components/shared/`. Updated imports in 4 files. Build and 34 tests passing | Claude (Opus 4.5) |
| 2025-11-26 | Phase 4 (Integrations) | Migrated OpenRouter client from `src/lib/openrouter/client.ts` → `src/integrations/openrouter/client.ts`. Updated imports in 5 files. Deleted empty `src/lib/openrouter/` directory. `src/lib/` still contains `utils.ts` (shared utility used by 27 files). Build and 34 tests passing | Claude (Opus 4.5) |
