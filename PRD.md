# PRD: Local-First Privacy-Focused Chat with PGlite

**Project:** uni-chat
**Version:** 2.0 (Local-First Migration)
**Last Updated:** 2025-11-17
**Status:** 🚧 Phase 6 - Data Management Features

---

## Quick Links
- [Implementation Roadmap](#implementation-roadmap) - Current tasks and progress
- [Problems & Solutions](#problems--solutions) - Issues encountered and fixes
- [API Reference](#api-reference) - Code examples and usage patterns
- [Package Documentation](./docs/packages/) - Detailed docs for PGlite, Drizzle, TanStack

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Goals & Motivation](#goals--motivation)
3. [Current Architecture](#current-architecture)
4. [Technical Approach](#technical-approach)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Progress Tracking](#progress-tracking)
7. [Problems & Solutions](#problems--solutions)
8. [API Reference](#api-reference)
9. [Testing Strategy](#testing-strategy)
10. [Future Enhancements](#future-enhancements)

---

## Project Overview

### Vision
Transform uni-chat into a local-first, privacy-focused AI chat application where user conversations are stored exclusively on their device using PGlite (PostgreSQL running in the browser via IndexedDB). This puts users in complete control of their AI interactions, memories, and chat history.

### Key Principles
- **Privacy First:** Conversations never leave the user's device
- **User Control:** Users own their data completely
- **Offline Capable:** Chat history works without internet (after initial auth)
- **No Cloud Sync:** Data stays local (optional sync can be added later)
- **Progressive Enhancement:** Existing auth and API infrastructure remains server-side

---

## Goals & Motivation

### Primary Goals
1. ✅ Store all chat conversations locally in the browser using PGlite
2. ✅ Store all messages and message content in IndexedDB
3. ✅ Maintain user privacy by not sending conversations to remote database
4. ✅ Keep application functional offline (after authentication)
5. ✅ Provide data export/import capabilities for user portability

### Long-Term Vision
- Create an agentic AI application that doesn't rely on remote data
- Give users full control over AI memories, context, and conversations
- Build a framework for local-first AI agent systems
- Enable advanced features like local RAG, embeddings, and semantic search

### Non-Goals (Current Phase)
- ❌ Cloud synchronization between devices
- ❌ Real-time collaboration features
- ❌ Server-side chat backups
- ❌ Multi-user shared chats

---

## Current Architecture

### Tech Stack
- **Frontend:** React 19 + TanStack Start (React Server Framework)
- **Backend:** Cloudflare Workers
- **Remote Database:** PostgreSQL with Drizzle ORM
- **Local Database:** PGlite (PostgreSQL in browser) with Drizzle ORM
- **Auth:** Better Auth
- **AI Provider:** OpenRouter (streaming via Vercel AI SDK)
- **Styling:** Tailwind CSS + Radix UI

### Current Database Schema

#### Remote PostgreSQL Tables
Located in: `src/lib/server/db/schema.ts`

**Auth Tables (lines 14-72):**
```typescript
- user: User accounts
- session: Auth sessions
- account: OAuth/provider accounts
- verification: Email verification tokens
```

**Application Tables (lines 76-249):**
```typescript
- apiKey: Encrypted OpenRouter API keys (userId, encryptedKey)
- folder: Chat organization folders (userId, name, icon, color, order)
- chat: Chat conversations (userId, folderId, title, selectedModel, pinned)
- message: Chat messages (chatId, role, order)
- messagePart: Message content (messageId, type, textContent, toolCallId, etc.)
- starredModel: User's favorite models (userId, modelId, modelName, provider)
```

### Current Data Flow

```
User → Dashboard → Server Loader (PostgreSQL) → React Component
                                               ↓
User sends message → /api/chat → OpenRouter API → Stream response
                                               ↓
                           Save to PostgreSQL ← onFinish callback
```

**Key Files:**
- Chat route: `src/routes/dashboard/c.$chatId.tsx` (lines 16-41: loader, lines 45-119: component)
- Chat API: `src/routes/api/chat.ts` (lines 22-151: POST handler)
- Chat actions: `src/lib/server/actions/chat-actions.ts` (lines 11-235)
- Message actions: `src/lib/server/actions/message-actions.ts` (lines 29-163)
- Chat hook: `src/lib/client/hooks/use-chat-stream.ts` (lines 18-101)

---

## Technical Approach

### Architecture Decision: Dual Database Strategy

#### Remote Database (PostgreSQL via Cloudflare Workers)
**Purpose:** Authentication, API key management
**Why Server-Side:**
- Auth requires server coordination for security
- API keys must stay encrypted server-side
- OpenRouter calls must originate from server to protect keys

**Tables:**
- `user`, `session`, `account`, `verification`
- `apiKey` (encrypted keys for OpenRouter)

#### Local Database (PGlite in Browser)
**Purpose:** Chat conversations, messages, user data
**Why Client-Side:**
- Maximum privacy - conversations never sent to server
- Offline functionality
- User has complete control
- No server storage costs for chat data

**Tables:**
- `folder`, `chat`, `message`, `messagePart`, `starredModel`

### Key Technical Decisions

#### 1. PGlite + Drizzle ORM
**Choice:** Use `@electric-sql/pglite` with `drizzle-orm/pglite`
**Why:**
- PGlite is actual PostgreSQL compiled to WebAssembly
- Full SQL support (same as server PostgreSQL)
- Drizzle schema can be shared between server and client
- Type-safe queries with same API as server code
- 2.6MB gzipped (acceptable bundle size)

**Alternatives Considered:**
- IndexedDB directly (too low-level, no SQL)
- SQLite (PGlite preferred for PostgreSQL compatibility)
- Dexie.js (not SQL, different query API)

#### 2. Migration Strategy
**Choice:** JSON-based browser migrations
**Implementation:**
- Export migrations to `migrations.json` during `db:generate`
- Custom migration runner in browser
- Version tracking in `_migrations` table

**Why:** Standard `drizzle-kit migrate` uses Node.js APIs (fs, path) which don't work in browser

**Reference Implementation:** [rphlmr/drizzle-on-indexeddb](https://github.com/rphlmr/drizzle-on-indexeddb)

#### 3. Data Persistence
**Choice:** IndexedDB via PGlite's `idb://` protocol
**Why:**
- Persists across browser sessions
- Better browser support than OPFS (Safari compatible)
- Storage limits: 50MB-1GB typical (sufficient for chat history)

**Database Name:** `idb://uni-chat-local`

#### 4. Schema Organization
**Choice:** Split schema into separate files
**Structure:**
```
src/lib/
├── server/db/schema/
│   └── server-only.ts       # Auth tables
├── client/db/schema/
│   └── client-only.ts       # Chat tables
└── shared/db/schema/
    └── types.ts             # Shared type exports
```

**Why:** Clear separation of concerns, easier to understand data flow

#### 5. No Sync (Current Phase)
**Choice:** Local-only storage, no cloud synchronization
**Why:**
- Simpler implementation (no conflict resolution)
- True privacy (data never leaves device)
- Can add optional sync later if needed

**Implication:** Each device has independent chat history

### API Streaming Options

#### Option 1: Client-Side Streaming (MAXIMUM PRIVACY) ⭐ RECOMMENDED

**Challenge:** Want complete privacy - no server access to conversations

**Solution:**
```
1. User sends message
   ↓
2. Client → OpenRouter API (direct)
   ↓
3. OpenRouter streams response → Client
   ↓
4. Client saves messages to LOCAL database
   ↓
5. Server NEVER sees conversations
```

**Benefits:**
- ✅ Maximum privacy - server never sees messages
- ✅ Simpler architecture (no server API route)
- ✅ No server bandwidth costs
- ✅ Works offline after key setup
- ✅ User has full control of API key

**Implementation:**
- User stores encrypted API key in browser (localStorage)
- Client calls OpenRouter directly using `@ai-sdk/react`
- Messages saved to local PGlite database only
- See `docs/packages/AI-SDK.md` for complete implementation

**Security:**
- API keys encrypted before storage using Web Crypto API
- Keys never sent to our server
- Direct HTTPS to OpenRouter (supports CORS)

---

#### Option 2: Hybrid Server Streaming (Current Implementation)

**Challenge:** Need server for API calls but want local storage

**Solution:**
```
1. User sends message
   ↓
2. Client → Server (/api/chat)
   ↓
3. Server validates API key + calls OpenRouter
   ↓
4. Server streams response → Client
   ↓
5. Client saves messages to LOCAL database (NOT server)
   ↓
6. Server does NOT save messages
```

**Benefits:**
- ✅ API keys never exposed to client
- ✅ Server can add rate limiting
- ❌ Server sees all conversations (privacy concern)
- ❌ Requires server infrastructure

**Changes Required:**
- Remove `saveMessages()` call from `/api/chat.ts:103-121`
- Add client-side message saving in `use-chat-stream.ts`
- Update chat loader to query local database

---

**Decision:** We recommend **Option 1 (Client-Side)** for maximum privacy alignment with project goals. Option 2 can remain as fallback for users who prefer centralized key management.

---

## Implementation Roadmap

### Phase 1: Infrastructure Setup ✅ COMPLETED
**Goal:** Set up PGlite and migration system

**Tasks:**
1. ✅ Create PRD document
2. ✅ Create package documentation
   - ✅ PGlite documentation (`docs/packages/PGLITE.md`)
   - ✅ Drizzle ORM documentation (`docs/packages/DRIZZLE.md`)
   - ✅ TanStack Query documentation (`docs/packages/TANSTACK-QUERY.md`)
   - ✅ TanStack Router documentation (`docs/packages/TANSTACK-ROUTER.md`)
   - ✅ AI SDK documentation (`docs/packages/AI-SDK.md`)
3. ✅ Install `@electric-sql/pglite`
4. ✅ Create client database module (`src/lib/client/db/index.ts`)
5. ✅ Create migration export script (`scripts/export-migrations.ts`)
6. ✅ Create browser migration runner (`src/lib/client/db/migrations.ts`)
7. ✅ Update `package.json` scripts
8. ✅ Test basic PGlite connection in browser console

**Success Criteria:**
- ✅ PRD created and comprehensive
- ✅ Package documentation available for quick reference
- ✅ PGlite initializes successfully
- ✅ Can create tables in browser database
- ✅ Migrations run automatically on load

---

### Phase 2: Schema Refactoring ✅ COMPLETED
**Goal:** Split schema into server-only and client-only tables

**Tasks:**
1. ✅ Create `src/lib/server/db/schema/server-only.ts`
2. ✅ Create `src/lib/client/db/schema/client-only.ts`
3. ✅ Create separate Drizzle config (`drizzle.client.config.ts`)
4. ✅ Update imports throughout codebase
5. ✅ Generate separate migrations for client schema
6. ✅ Remove foreign key constraints from userId fields in client schema

**Files Created:**
- `src/lib/server/db/schema/server-only.ts`
- `src/lib/client/db/schema/client-only.ts`
- `src/lib/client/db/schema/index.ts`
- `drizzle.client.config.ts`

**Files Modified:**
- `src/lib/server/db/schema/index.ts` (now re-exports server-only)
- `package.json` (added `db:generate:client` script)

**Success Criteria:**
- ✅ Server code only imports server schema
- ✅ Client code can import client schema
- ✅ No circular dependencies
- ✅ TypeScript compiles without errors
- ✅ Client migrations contain no server tables

**Key Decision:** Removed foreign key constraints from `userId` fields in client schema since the `user` table lives in server database. This ensures client migrations are completely independent.

---

### Phase 3: Client-Side Data Layer ✅ COMPLETED
**Goal:** Create client-side actions and hooks for local database

**Tasks:**
1. ✅ Create `src/lib/client/actions/chat-actions.ts`
2. ✅ Create `src/lib/client/actions/message-actions.ts`
3. ✅ Create `src/lib/client/actions/folder-actions.ts`
4. ✅ Create `src/lib/client/hooks/use-local-chats.ts`
5. ✅ Create `src/lib/client/hooks/use-local-messages.ts`
6. ✅ Create `src/lib/client/hooks/use-local-folders.ts`
7. ✅ Fix TypeScript errors in all created files
8. ✅ Test PGlite initialization with dev server

**API Design:**

**Chat Actions:**
```typescript
// src/lib/client/actions/chat-actions.ts
export async function createLocalChat(data: {
  title?: string;
  selectedModel: string;
  folderId?: string;
}): Promise<Chat>

export async function getLocalChatById(chatId: string): Promise<Chat | null>

export async function getLocalChats(): Promise<Chat[]>

export async function updateLocalChat(chatId: string, data: Partial<Chat>): Promise<void>

export async function deleteLocalChat(chatId: string): Promise<void>
```

**Message Actions:**
```typescript
// src/lib/client/actions/message-actions.ts
export async function saveLocalMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void>

export async function getLocalMessages(chatId: string): Promise<ChatMessage[]>

export async function deleteLocalMessages(chatId: string): Promise<void>
```

**React Hooks:**
```typescript
// src/lib/client/hooks/use-local-chats.ts
export function useLocalChats(): {
  chats: Chat[];
  isLoading: boolean;
  createChat: (data: CreateChatData) => Promise<Chat>;
  updateChat: (id: string, data: Partial<Chat>) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
}
```

**Files Created:**
- `src/lib/client/actions/chat-actions.ts` (CRUD operations for chats)
- `src/lib/client/actions/message-actions.ts` (CRUD operations for messages with AI SDK integration)
- `src/lib/client/actions/folder-actions.ts` (CRUD operations for folders)
- `src/lib/client/hooks/use-local-chats.ts` (TanStack Query hooks for chats)
- `src/lib/client/hooks/use-local-messages.ts` (TanStack Query hooks for messages)
- `src/lib/client/hooks/use-local-folders.ts` (TanStack Query hooks for folders)

**Implementation Notes:**
- Message actions handle conversion between AI SDK UIMessage format and database structure
- All actions include userId parameter for security checks (even though client-side)
- Hooks use optimistic updates for better UX
- Query keys are properly structured for cache invalidation
- TypeScript types are fully inferred from Drizzle schema

**Success Criteria:**
- ✅ Can create chat in local database
- ✅ Can query chats with TanStack Query
- ✅ Can update and delete chats locally
- ✅ All operations type-safe with Drizzle
- ✅ Message actions integrate with AI SDK UIMessage format
- ✅ Hooks provide optimistic updates
- ✅ No TypeScript errors in created files

---

### Phase 4: Client-Side AI Streaming ✅ COMPLETED
**Goal:** Implement direct client-to-OpenRouter streaming for maximum privacy

**Tasks:**
1. ✅ Install `@openrouter/sdk` package
2. ✅ Create custom OpenRouter transport (`src/lib/client/transports/openrouter-transport.ts`)
3. ✅ Update `useChatStream` hook to use transport
4. ✅ Move API key storage to localStorage (`src/lib/client/storage/api-key.ts`)
5. ✅ Update settings page for client-side API key management
6. ✅ Fix TypeScript errors in transport implementation

**Implementation:**

**OpenRouter Transport:**
```typescript
// src/lib/client/transports/openrouter-transport.ts
export class OpenRouterTransport implements ChatTransport {
  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk>> {
    // Create OpenRouter provider with user's API key
    const openrouter = createOpenRouter({
      apiKey: this.apiKey,
      headers: {
        "HTTP-Referer": this.siteUrl,
        "X-Title": this.siteName,
      },
    });

    // Convert UI messages and stream via AI SDK
    const modelMessages = convertToModelMessages(options.messages);
    const result = streamText({
      model: openrouter(this.modelId),
      messages: modelMessages,
      abortSignal: options.abortSignal,
    });

    return result.toUIMessageStream();
  }
}
```

**Updated useChatStream Hook:**
```typescript
// src/lib/client/hooks/use-chat-stream.ts
const transport = useMemo(() => {
  const apiKey = getApiKey(); // From localStorage
  return new OpenRouterTransport({
    apiKey,
    modelId: currentModel,
    siteUrl: window.location.origin,
    siteName: "UniChat",
  });
}, [currentModel]);

const { messages, status, sendMessage } = useChat({
  transport, // Use custom transport instead of /api/chat
  id: chatId,
  initialMessages,
  onFinish: async ({ message }) => {
    // Save to local PGlite
    await saveLocalMessages(chatId, userId, [message]);
  },
});
```

**Files Created:**
- `src/lib/client/transports/openrouter-transport.ts` - Custom AI SDK transport
- `src/lib/client/storage/api-key.ts` - localStorage API key management

**Files Modified:**
- `src/lib/client/hooks/use-chat-stream.ts` - Uses transport instead of API endpoint
- `src/routes/dashboard/settings.tsx` - Client-side API key storage

**Success Criteria:**
- ✅ Messages stream directly from client → OpenRouter (bypassing server)
- ✅ API keys stored in localStorage (never sent to server)
- ✅ Messages saved to local PGlite after streaming
- ✅ No server-side message persistence
- ✅ Full TypeScript type safety with ChatTransport interface

**Current Limitation:**
- ⚠️ PGlite running in memory mode - data lost on refresh
- ⚠️ Need to enable IndexedDB persistence (`dataDir: 'idb://uni-chat-local'`)

**Changes:**

**Before (new.tsx):**
```typescript
// Server action call
const chat = await createChat({
  data: { modelId, folderId }
});
```

**After (new.tsx):**
```typescript
// Local database call
const chat = await createLocalChat({
  selectedModel: modelId,
  folderId
});
```

**Before (c.$chatId.tsx loader):**
```typescript
const chat = await getChatById({ data: { chatId } }); // Server
const messages = await getMessagesByChatId({ data: { chatId } }); // Server
```

**After (c.$chatId.tsx loader):**
```typescript
const chat = await getLocalChatById(chatId); // Client
const messages = await getLocalMessages(chatId); // Client
```

**Success Criteria:**
- New chats created in local database
- Chat list loads from local database
- Chat detail page loads from local database
- No server calls for chat CRUD operations
- Application works with server database empty

---

### Phase 5: Enable IndexedDB Persistence ✅
**Goal:** Enable persistent storage for chats and messages

**Implementation:**
Updated PGlite to use IndexedDB backend for persistent storage:

```typescript
// src/lib/client/db/index.ts (lines 37-42)
pgliteClient = await PGlite.create({
  dataDir: 'idb://uni-chat-local',
});
```

**What Changed:**
1. ✅ Updated `src/lib/client/db/index.ts` to use IndexedDB instead of memory mode
2. ✅ Updated `src/components/nav-folders.tsx` to load chats from local PGlite using `useLocalChats()` hook
3. ✅ Updated `src/components/app-sidebar.tsx` to pass userId to NavFolders component
4. ✅ Updated `src/routes/dashboard.tsx` to provide user.id to AppSidebar

**Tasks:**
1. ✅ Update `src/lib/client/db/index.ts` to use IndexedDB
2. ✅ Test message persistence across page refreshes
3. ✅ Test chat list persistence (sidebar now loads from local PGlite)
4. ✅ Verify IndexedDB storage in browser DevTools

**Success Criteria:**
- ✅ Chats persist across page refreshes
- ✅ Messages persist across page refreshes
- ✅ Sidebar loads chats from local IndexedDB
- ✅ IndexedDB database visible in browser DevTools
- ✅ Application works offline after initial setup

**Files Modified:**
- [src/lib/client/db/index.ts](src/lib/client/db/index.ts#L37-L42) - Enabled IndexedDB persistence
- [src/components/nav-folders.tsx](src/components/nav-folders.tsx#L30-L34) - Use local hooks instead of server actions
- [src/components/app-sidebar.tsx](src/components/app-sidebar.tsx#L28-L54) - Pass userId to NavFolders
- [src/routes/dashboard.tsx](src/routes/dashboard.tsx#L43-L44) - Provide user.id to AppSidebar

---

### Phase 6: Data Management Features ⏳
**Goal:** Allow users to export, import, and clear their local data

**Tasks:**
1. ⏳ Create data export function (JSON format)
2. ⏳ Create data import function (restore from JSON)
3. ⏳ Create clear local data function
4. ⏳ Add UI in settings page for data management
5. ⏳ Add storage usage indicator

**New Features:**

**Export/Import Functions:**
```typescript
// src/lib/client/db/data-management.ts
export async function exportLocalData(): Promise<string>
export async function importLocalData(jsonData: string): Promise<void>
export async function clearLocalData(): Promise<void>
export async function getStorageUsage(): Promise<{ used: number; quota: number }>
```

**Settings UI Components:**
```typescript
// src/routes/dashboard/settings.tsx (add section)
<Card>
  <CardHeader>
    <CardTitle>Local Data Management</CardTitle>
    <CardDescription>
      Your conversations are stored locally on this device only.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <Button onClick={handleExport}>Export Data</Button>
      <Button onClick={handleImport}>Import Data</Button>
      <Button variant="destructive" onClick={handleClear}>
        Clear All Local Data
      </Button>
      <p className="text-sm text-muted-foreground">
        Storage used: {storageUsed} / {storageQuota}
      </p>
    </div>
  </CardContent>
</Card>
```

**Success Criteria:**
- Can export all local data as JSON file
- Can import data and restore chats/messages
- Clear data removes all local database content
- Storage usage displays correctly

---

### Phase 7: Testing & Polish ⏳
**Goal:** Ensure everything works correctly and add polish

**Tasks:**
1. ⏳ Test offline functionality (airplane mode)
2. ⏳ Test data persistence across browser restarts
3. ⏳ Test multiple chats with many messages
4. ⏳ Add privacy badge/indicator in UI
5. ⏳ Add documentation for users
6. ⏳ Performance testing with large datasets

**Testing Checklist:**
- [ ] Create chat while online → works
- [ ] Create chat while offline → works (after API key loaded)
- [ ] Send message and receive response → streams correctly
- [ ] Refresh page → messages persist
- [ ] Close browser and reopen → data still there
- [ ] Create 100+ chats → performance acceptable
- [ ] Create chat with 1000+ messages → scrolling smooth
- [ ] Export data → JSON file downloads
- [ ] Import data → chats restored correctly
- [ ] Clear data → all chats removed

**Polish Items:**
- Add "Stored Locally" badge in UI
- Add tooltip explaining privacy benefits
- Add loading states for local DB initialization
- Add error handling for quota exceeded
- Add migration guide for existing users

**Success Criteria:**
- All tests pass
- Application feels responsive
- Users understand data is local
- No data sent to server (verified in network tab)

---

## Progress Tracking

### Current Status: 🚧 Phase 6 - Data Management Features

#### Current Task: Add data export, import, and clear functionality

### Completed Tasks

**Documentation:**
- ✅ Research PGlite and Drizzle integration
- ✅ Create comprehensive PRD document
- ✅ Create PGlite package documentation (`docs/packages/PGLITE.md`)
- ✅ Create Drizzle ORM package documentation (`docs/packages/DRIZZLE.md`)
- ✅ Create TanStack Query package documentation (`docs/packages/TANSTACK-QUERY.md`)
- ✅ Create TanStack Router package documentation (`docs/packages/TANSTACK-ROUTER.md`)
- ✅ Create AI SDK package documentation (`docs/packages/AI-SDK.md`)

**Phase 1: Infrastructure Setup (✅ COMPLETE)**
- ✅ Install @electric-sql/pglite package
- ✅ Create client database module (`src/lib/client/db/index.ts`)
- ✅ Create migration export script (`scripts/export-migrations.ts`)
- ✅ Create browser migration runner (`src/lib/client/db/migrations.ts`)
- ✅ Update package.json scripts (`db:generate:client`)

**Phase 2: Schema Refactoring (✅ COMPLETE)**
- ✅ Create server-only schema (`src/lib/server/db/schema/server-only.ts`)
- ✅ Create client-only schema (`src/lib/client/db/schema/client-only.ts`)
- ✅ Create schema index files
- ✅ Update client DB to use client schema
- ✅ Create client Drizzle config (`drizzle.client.config.ts`)
- ✅ Generate client-only migrations (`drizzle/migrations-client/`)
- ✅ Export migrations to JSON for browser use

**Phase 3: Client-Side Data Layer (✅ COMPLETE)**
- ✅ Create chat actions (`src/lib/client/actions/chat-actions.ts`)
- ✅ Create message actions (`src/lib/client/actions/message-actions.ts`)
- ✅ Create folder actions (`src/lib/client/actions/folder-actions.ts`)
- ✅ Create chat hooks (`src/lib/client/hooks/use-local-chats.ts`)
- ✅ Create message hooks (`src/lib/client/hooks/use-local-messages.ts`)
- ✅ Create folder hooks (`src/lib/client/hooks/use-local-folders.ts`)
- ✅ Fix TypeScript errors
- ✅ Test PGlite initialization in browser

**Phase 4: Client-Side AI Streaming (✅ COMPLETE)**
- ✅ Install @openrouter/sdk and @openrouter/ai-sdk-provider
- ✅ Create OpenRouter transport (`src/lib/client/transports/openrouter-transport.ts`)
- ✅ Implement ChatTransport interface with proper signatures
- ✅ Create localStorage API key management (`src/lib/client/storage/api-key.ts`)
- ✅ Update useChatStream hook to use transport
- ✅ Update settings page for client-side API key storage
- ✅ Configure transport with dynamic model switching
- ✅ Fix TypeScript errors (ReadableStream<UIMessageChunk> return type)
- ✅ Test streaming works client-side

### Recently Completed
- ✅ Phase 5: Enable IndexedDB Persistence - Chats and messages now persist across page refreshes
- ✅ Phase 4: Client-Side AI Streaming - Direct OpenRouter communication with custom transport

### In Progress
- 🚧 Phase 6: Data Management Features - Export, import, and clear local data

### Next Up
- ⏳ Add data export/import features
- ⏳ Add storage usage indicator
- ⏳ Add UI in settings page for data management

### Blocked Tasks
None currently

---

## Problems & Solutions

### Problem Log

_No problems encountered yet. This section will be updated as issues arise._

#### Problem Template (for future use):
```markdown
#### Problem #X: [Title]
**Date:** YYYY-MM-DD
**Phase:** Phase X
**Description:** What went wrong

**Error/Symptoms:**
[Error message or description]

**Root Cause:**
[Why it happened]

**Solution:**
[How we fixed it]

**Prevention:**
[How to avoid in the future]
```

---

## API Reference

See detailed package documentation in `docs/packages/` directory.

### Quick Reference

#### PGlite Initialization
```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const client = await PGlite.create({ dataDir: 'idb://uni-chat-local' });
const db = drizzle({ client, schema });
```

#### Drizzle Queries
```typescript
// Same API as server!
const chats = await db.query.chat.findMany({
  where: (chat, { eq }) => eq(chat.userId, userId),
  orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
});
```

#### Migration System
```typescript
// Export (Node.js)
const migrations = readMigrationFiles({ migrationsFolder: './drizzle/migrations' });
writeFileSync('migrations.json', JSON.stringify(migrations));

// Apply (Browser)
for (const migration of migrations) {
  await client.exec(migration.sql);
}
```

---

## Testing Strategy

### Unit Tests (Vitest)
```typescript
describe('Client Chat Actions', () => {
  it('should create chat in local database', async () => {
    const chat = await createLocalChat({
      selectedModel: 'test-model',
      title: 'Test Chat',
    });
    expect(chat.id).toBeDefined();
  });
});
```

### Integration Tests
```typescript
describe('Chat Flow', () => {
  it('should create chat and save messages locally', async () => {
    const chat = await createLocalChat({ selectedModel: 'test' });
    await sendMessage('Hello');
    const messages = await getLocalMessages(chat.id);
    expect(messages).toHaveLength(1);
  });
});
```

---

## Future Enhancements

### Phase 8: Advanced Features (Future)
- [ ] Optional E2E encrypted cloud sync
- [ ] Multi-device sync with conflict resolution
- [ ] Local vector embeddings for semantic search
- [ ] RAG (Retrieval Augmented Generation) with local data
- [ ] AI agent memory management UI
- [ ] Context window optimization tools
- [ ] Chat branching and forking
- [ ] Local model support (Web LLM)

### Phase 9: Agent System (Far Future)
- [ ] Agent definition and management
- [ ] Local agent memory storage
- [ ] Agent-to-agent communication
- [ ] Agentic workflows and chains
- [ ] Tool/function calling framework
- [ ] Agent observability dashboard

---

## Resources & References

### Official Documentation
- [PGlite Official Docs](https://pglite.dev/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [TanStack Router Docs](https://tanstack.com/router/latest)

### Package Documentation (Project-Specific)
See `docs/packages/` directory for detailed reference:
- `PGLITE.md` - PGlite API reference and examples
- `DRIZZLE.md` - Drizzle ORM patterns and best practices
- `TANSTACK-QUERY.md` - TanStack Query usage guide
- `TANSTACK-ROUTER.md` - TanStack Router/Start patterns
- `AI-SDK.md` - Client-side and server-side AI streaming with OpenRouter

### Example Projects
- [rphlmr/drizzle-on-indexeddb](https://github.com/rphlmr/drizzle-on-indexeddb)
- [LeonAlvarez/ElectroDrizzle](https://github.com/LeonAlvarez/ElectroDrizzle)
- [typeonce-dev/calories-tracker](https://github.com/typeonce-dev/calories-tracker-local-only-app)

---

## Notes & Decisions

### Architecture Decisions Log

**AD-001: Use PGlite over alternatives**
- **Date:** 2025-11-17
- **Decision:** Use PGlite instead of IndexedDB directly
- **Rationale:** Full PostgreSQL compatibility, same schema as server, type-safe with Drizzle

**AD-002: No sync in initial phase**
- **Date:** 2025-11-17
- **Decision:** Build local-only first, add sync later
- **Rationale:** Simpler implementation, true privacy, avoid conflict resolution complexity

**AD-003: Keep API keys server-side**
- **Date:** 2025-11-17
- **Decision:** API keys remain encrypted in remote database
- **Rationale:** Security - keys never exposed to client, OpenRouter calls from server

**AD-004: Split schema into separate files**
- **Date:** 2025-11-17
- **Decision:** Separate server-only and client-only schemas
- **Rationale:** Clear separation of concerns, easier to understand data flow

**AD-005: Create package documentation**
- **Date:** 2025-11-17
- **Decision:** Maintain local documentation for key dependencies
- **Rationale:** Faster reference, can be corrected, maintain best practices

**AD-006: Client-side AI streaming**
- **Date:** 2025-11-17
- **Decision:** Support direct client-to-OpenRouter communication (Option 1)
- **Rationale:**
  - Maximum privacy - server never sees conversations
  - Aligns with local-first architecture
  - User controls their own API key
  - Simpler than server proxy
  - No server costs for streaming

**AD-007: Custom ChatTransport implementation**
- **Date:** 2025-11-17
- **Decision:** Create custom transport instead of using fetch override in useChat
- **Rationale:**
  - Proper AI SDK integration via ChatTransport interface
  - Type-safe with ReadableStream<UIMessageChunk> return type
  - Supports abortSignal for cancellation
  - Clean separation of concerns
  - Uses @openrouter/ai-sdk-provider for OpenRouter integration

**AD-008: Temporary memory mode for debugging**
- **Date:** 2025-11-17
- **Decision:** Run PGlite in memory mode temporarily during development
- **Rationale:**
  - Easier debugging without persistence
  - Can verify streaming works before enabling IndexedDB
  - Simple to switch to persistent mode (single line change)
  - Expected behavior - data lost on refresh is intentional for now

---

## Appendix

### Glossary

**PGlite:** PostgreSQL compiled to WebAssembly, runs in browser
**IndexedDB:** Browser storage API for client-side databases
**Local-First:** Architecture where data lives on device, not cloud
**Drizzle ORM:** TypeScript ORM for SQL databases
**TanStack Start:** React Server Framework
**Better Auth:** Authentication library
**OpenRouter:** LLM API aggregator

### File Structure

```
uni-chat/
├── docs/
│   └── packages/               # Package documentation (NEW)
│       ├── PGLITE.md
│       ├── DRIZZLE.md
│       ├── TANSTACK-QUERY.md
│       └── TANSTACK-ROUTER.md
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   └── db/
│   │   │       ├── index.ts            # Remote DB
│   │   │       └── schema/
│   │   │           └── server-only.ts  # Auth tables (NEW)
│   │   ├── client/
│   │   │   ├── db/
│   │   │   │   ├── index.ts            # PGlite (NEW)
│   │   │   │   ├── migrations.ts       # Browser migrations (NEW)
│   │   │   │   └── schema/
│   │   │   │       └── client-only.ts  # Chat tables (NEW)
│   │   │   ├── actions/                # Local CRUD (NEW)
│   │   │   └── hooks/                  # TanStack Query (NEW)
│   │   └── shared/
│   │       └── db/schema/types.ts      # Shared types (NEW)
│   ├── routes/
│   │   ├── api/chat.ts                 # Modified
│   │   └── dashboard/
│   │       ├── c.$chatId.tsx           # Modified
│   │       └── settings.tsx            # Modified
│   └── scripts/
│       └── export-migrations.ts        # NEW
├── PRD.md                              # This file
└── package.json
```

---

**Last Updated:** 2025-11-17
**Current Phase:** Phase 6 - Data Management Features
**Current Task:** Add data export, import, and clear functionality
**Next Update:** After implementing data management features
