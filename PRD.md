# Uni-Chat: Multi-Model AI Chat Application - PRD

## Project Overview

**Project Name:** Uni-Chat
**Description:** A ChatGPT-style AI chat application with the ability to toggle between dozens of models from multiple providers using OpenRouter as the model router.
**Tech Stack:** TanStack Start (React Server Framework), Cloudflare Workers, PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, Radix UI (shadcn), Vercel AI SDK, OpenRouter
**Repository:** `/Users/pat/Code/uni-chat`

## Key Features

1. **Multi-Model Support**: Users can switch between dozens of AI models from various providers (Anthropic, OpenAI, Meta, etc.) via OpenRouter
2. **Personal API Key**: Users add their own OpenRouter API key via the frontend (encrypted storage)
3. **Folder Organization**: Chats can be organized into user-created folders (vs. flat list)
4. **Inline Model Selection**: Model selector appears in the chat input area for quick switching
5. **Model Browsing & Starring**: Users can browse all available models and star favorites for quick access
6. **Persistent Chat History**: All conversations saved to PostgreSQL with proper message formatting
7. **Real-time Streaming**: AI responses stream in real-time using Vercel AI SDK

## Technical Architecture

### Routing Structure
```
/                           → Landing page (redirects to /dashboard)
/login                      → Authentication
/signup                     → User registration
/dashboard                  → Layout route with sidebar (uses <Outlet />)
  ├── /dashboard            → Default view (latest chat or empty state)
  ├── /dashboard/c/:chatId  → Individual chat conversation
  ├── /dashboard/new        → New chat with model selection
  ├── /dashboard/models     → Model browser with search/filter/star
  └── /dashboard/settings   → User settings (API key, preferences)
```

### Database Schema

**Existing Tables (Better Auth):**
- `user` - User accounts (id, name, email, emailVerified, image, timestamps)
- `session` - Auth sessions
- `account` - OAuth/provider accounts
- `verification` - Email verification tokens

**New Tables (AI Chat):**
1. **`api_key`** - Encrypted OpenRouter API keys
   - id (PK), userId (FK), encryptedKey, createdAt, lastUsedAt
   - Unique constraint on userId (one key per user)

2. **`folder`** - Chat folder organization
   - id (PK), userId (FK), name, icon, color, order, timestamps

3. **`chat`** - Conversations
   - id (PK), userId (FK), folderId (FK nullable), title, selectedModel, pinned, timestamps
   - Indexes: (userId, updatedAt DESC), (userId, folderId)

4. **`message`** - Chat messages (UIMessage format per AI SDK v5)
   - id (PK), chatId (FK), role, order, createdAt
   - Indexes: (chatId, order), (chatId, createdAt)

5. **`message_part`** - Message content parts (normalized structure)
   - id (PK), messageId (FK), type, order, createdAt
   - Sparse columns: textContent, toolCallId, toolCallName, toolCallArgs (jsonb), toolResultId, toolResultContent (jsonb), providerMetadata (jsonb)
   - Index: (messageId, order)

6. **`starred_model`** - User's favorited models
   - id (PK), userId (FK), modelId, modelName, provider, contextLength, pricingPrompt, pricingCompletion, order, createdAt
   - Unique constraint: (userId, modelId)

**Relations:**
- User → one-to-one → ApiKey
- User → one-to-many → Folders, Chats, StarredModels
- Folder → one-to-many → Chats
- Chat → one-to-many → Messages
- Message → one-to-many → MessageParts

### AI SDK Integration (v5 Best Practices)

**Message Storage Pattern:**
- Store messages in **UIMessage format** (not JSONB)
- Normalized relational structure for data integrity
- Server-side ID generation using `experimental_generateMessageId: () => nanoid()`
- Persist via `onFinish` callback in `streamText()`
- Call `result.consumeStream()` to ensure completion even on client disconnect

**OpenRouter Integration:**
- Official provider: `@openrouter/ai-sdk-provider`
- Model selection via `createOpenRouter({ apiKey })(modelId)`
- Model listing via OpenRouter API: `GET https://openrouter.ai/api/v1/models`

### Key Architectural Patterns

1. **Cloudflare Workers I/O Isolation:**
   - Always use `loadConfig()` for per-request db/auth instances
   - Never export module-level database or auth instances
   - Use `createServerFn()` with middleware for server actions

2. **Middleware Stack:**
   - `globalMiddleware` → loads config (db, auth, env)
   - `authMiddleware` → fetches session/user
   - `protectedMiddleware` → enforces authentication

3. **File-Based Routing:**
   - Layout routes use `<Outlet />` for nested children
   - Third parameter of `pgTable()` returns array `[]` not object `{}`
   - Component files in `-components/` folders are ignored by router

## Implementation Plan

### ✅ Phase 1: Dependencies & Setup (COMPLETED)
- [x] Install `@openrouter/ai-sdk-provider`, `ai`, `nanoid`
- [x] Install shadcn components: dialog, popover, scroll-area, badge, command, textarea, select, alert, tabs, switch

### ✅ Phase 2: Database Schema (COMPLETED)
- [x] Add 6 new tables with proper Drizzle relations
- [x] Generate migrations (`pnpm db:generate`)
- [x] Apply migrations (`pnpm db:migrate`)

### ✅ Phase 3: Dashboard Layout Update (COMPLETED)
- [x] Import `Outlet` from TanStack Router
- [x] Replace placeholder div with `<Outlet />`
- [x] Remove demo imports (getPunkSongs, useQuery)
- [x] Clean up breadcrumb (kept for now, will be dynamic per child route)

### ✅ Phase 4: Backend Infrastructure (COMPLETED)

**4.1 Utility Modules:**
- [x] `/src/lib/openrouter/client.ts` - OpenRouter client factory with model fetching
- [x] `/src/lib/server/utils/encryption.ts` - AES-256-GCM encryption via Web Crypto API
- [x] `/src/types/chat.ts` - UIMessage TypeScript types

**4.2 Server Actions:**
- [x] `/src/lib/server/actions/api-key-actions.ts`
  - `saveApiKey(apiKey)` - Encrypt and upsert
  - `getApiKey()` - Decrypt and return
  - `deleteApiKey()` - Remove key
  - `validateApiKey(apiKey)` - Test with OpenRouter
  - `hasApiKey()` - Check without decrypting

- [x] `/src/lib/server/actions/chat-actions.ts`
  - `createChat(modelId, folderId?, title?)`
  - `getChatById(chatId)`
  - `getUserChats()` - With folder joins
  - `getMostRecentChat()`
  - `updateChatTitle(chatId, title)`
  - `updateChatTimestamp(chatId)`
  - `moveChatToFolder(chatId, folderId)`
  - `deleteChat(chatId)`
  - `togglePinChat(chatId, pinned)`
  - `updateChatModel(chatId, modelId)`

- [x] `/src/lib/server/actions/message-actions.ts`
  - `saveMessages(chatId, messages: UIMessage[])` - Converts parts to storage format
  - `getMessagesByChatId(chatId)` - Reconstructs UIMessage[] from parts
  - `deleteMessagesForChat(chatId)` - Clear history

- [x] `/src/lib/server/actions/folder-actions.ts`
  - `createFolder(name, icon?, color?)`
  - `getUserFolders()` - Ordered by user preference
  - `updateFolder(folderId, updates)`
  - `deleteFolder(folderId)` - Sets chats to uncategorized
  - `reorderFolders(folderIds[])`

- [x] `/src/lib/server/actions/model-actions.ts`
  - `getOpenRouterModels()` - Fetches with user's API key
  - `starModel(modelData)`
  - `unstarModel(modelId)`
  - `getStarredModels()`
  - `reorderStarredModels(modelIds[])`
  - `isModelStarred(modelId)`

**4.3 Streaming Endpoint:**
- [x] `/src/routes/api/chat.ts` - POST handler with AI SDK streaming
  - Server-side ID generation with nanoid()
  - Converts UIMessage ↔ AI SDK format
  - Saves messages on stream completion
  - TODO: Fix auth context passing in API routes

### 🚧 Phase 5: Dashboard Child Routes (IN PROGRESS)

- [x] `/src/routes/dashboard/index.tsx` - Redirect to latest chat or show empty state
- [ ] `/src/routes/dashboard/c.$chatId.tsx` - Individual chat view
- [ ] `/src/routes/dashboard/new.tsx` - New chat with model picker
- [ ] `/src/routes/dashboard/models.tsx` - Model browser
- [ ] `/src/routes/dashboard/settings.tsx` - User settings

### 📋 Phase 6: Client Hooks (PENDING)

- [ ] `/src/lib/client/hooks/use-chat-stream.ts` - Wrapper around `useChat` from AI SDK
- [ ] `/src/lib/client/hooks/use-models.ts` - React Query hook for OpenRouter models

### 📋 Phase 7: Chat UI Components (PENDING)

**In `/src/routes/dashboard/-components/`:**
- [ ] `chat-header.tsx` - Model selector, breadcrumb, options menu
- [ ] `chat-input.tsx` - Textarea with inline model selector and send button
- [ ] `chat-message-list.tsx` - Scrollable message container with auto-scroll
- [ ] `chat-message.tsx` - Individual message bubble (user/AI styling)
- [ ] `model-selector-popover.tsx` - Popover with model search/filter
- [ ] `empty-state.tsx` - "Start a conversation" placeholder
- [ ] `api-key-prompt.tsx` - Prompt to add OpenRouter API key

### 📋 Phase 8: Sidebar Components (PENDING)

- [ ] Update `/src/components/app-sidebar.tsx` with new structure
- [ ] `/src/components/nav-folders.tsx` - Collapsible folder tree with chats
- [ ] `/src/components/nav-starred-models.tsx` - Quick access to favorite models

### 📋 Phase 9: Additional Features (PENDING)

- [ ] Model detail dialog in models browser
- [ ] Drag-and-drop for folder/chat organization
- [ ] Settings page tabs (API Key, Preferences, Data, About)
- [ ] Export chat history functionality
- [ ] Keyboard shortcuts (Cmd+K for new chat)

### 📋 Phase 10: Cleanup & Testing (PENDING)

- [ ] Delete `/src/data/demo.punk-songs.ts`
- [ ] Remove demo data from existing components
- [ ] Update `/src/routes/index.tsx` (landing page)
- [ ] Test full flow: signup → add API key → create chat → stream response
- [ ] Test folder creation and organization
- [ ] Test model starring and selection
- [ ] Verify all database operations
- [ ] Check authentication redirects

## Current Progress

**Overall Completion:** ~50%

**Last Completed:**
- ✅ Phase 1: All dependencies installed
- ✅ Phase 2: Database schema with 6 new tables + relations
- ✅ Phase 3: Dashboard layout converted to use Outlet
- ✅ Phase 4: Complete backend infrastructure
  - OpenRouter client utilities
  - API key encryption (AES-256-GCM)
  - 5 server action files (api-key, chat, message, folder, model)
  - UIMessage TypeScript types
  - Streaming API endpoint with AI SDK v5
- ✅ Phase 5 (Partial): Dashboard index route

**Currently Working On:**
- Phase 5: Creating remaining dashboard child routes

**Next Steps:**
1. Create chat view route (`c.$chatId.tsx`)
2. Build client hooks (use-chat-stream, use-models)
3. Create chat UI components (header, input, message-list, message)
4. Build new chat route and models browser
5. Create settings page

## Development Commands

```bash
# Development
pnpm dev                    # Start dev server (port 3000)
pnpm build                  # Build for production
pnpm deploy                 # Build and deploy to Cloudflare

# Database
pnpm db:generate            # Generate migrations
pnpm db:migrate             # Apply migrations
pnpm db:studio              # Open Drizzle Studio

# Code Quality
pnpm typecheck              # TypeScript type checking
pnpm lint                   # Check with Biome
pnpm lint:fix               # Auto-fix issues
pnpm format                 # Format code
pnpm test                   # Run Vitest tests
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

## Important Technical Notes

1. **Drizzle ORM Version:** 0.44.7
   - Third parameter of `pgTable()` must return array `[]`, not object `{}`
   - Relations defined separately using `relations()` function
   - TypeScript warnings in relations are known issue, don't affect runtime

2. **AI SDK Pattern:**
   - Always store in UIMessage format
   - Use normalized tables (not JSONB) for message parts
   - Server-side ID generation with `nanoid()`
   - Persist in `onFinish` callback

3. **Cloudflare Workers:**
   - Never share DB/auth instances across requests
   - Always use `loadConfig()` for per-request instances
   - Available in middleware context as `context.config`

4. **Routing:**
   - `/dashboard.tsx` is layout route
   - Child routes in `/dashboard/` folder
   - Files in `-components/` ignored by router

5. **TanStack Start Server Functions:**
   - ✅ CORRECT: `createServerFn().middleware([...]).inputValidator(...).handler(...)`
   - ❌ INCORRECT: `createServerFn({ middleware: [...] }).validator(...).handler(...)`
   - Use `.middleware()` method, not options object
   - Use `.inputValidator()`, not `.validator()`
   - All server actions have been updated to use correct syntax

6. **Server Action Middleware Pattern:**
   - **Always use BOTH** `globalMiddleware` and `protectedMiddleware` together
   - `globalMiddleware` loads per-request config (db, auth, env)
   - `protectedMiddleware` enforces authentication
   - Access database via `context.config.db` (NOT `loadConfig()`)
   - Always check `context.user?.id` exists before proceeding
   - Example:
   ```typescript
   export const myAction = createServerFn()
     .middleware([globalMiddleware, protectedMiddleware])
     .inputValidator((data: DataType) => data)
     .handler(async ({ context, data }) => {
       if (!context.user?.id) {
         throw new Error("User not found");
       }
       const { db } = context.config;
       // ... rest of logic
     });
   ```

## API References

- **OpenRouter API:** https://openrouter.ai/docs
- **Vercel AI SDK:** https://ai-sdk.dev
- **Drizzle ORM:** https://orm.drizzle.team
- **TanStack Router:** https://tanstack.com/router
- **Better Auth:** https://better-auth.com

## Known Issues

- Drizzle ORM 0.44.7 has TypeScript warnings in relations definitions (cosmetic, doesn't affect runtime)
- Migrations work correctly despite TS errors

---

**Last Updated:** 2025-11-16 (Server Actions Middleware Pattern Documented)
**Version:** 0.1.0-alpha
**Status:** Active Development - 50% Complete
