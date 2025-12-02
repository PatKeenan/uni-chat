# Implementation Plan: User Memories Feature

## Overview

A privacy-first, folder-level memories feature that extracts important context from conversations and allows users to inject this context into future chats. Memories are stored entirely client-side (PGlite), fully transparent, and user-editable. This differentiates from hidden LLM provider memories by giving users complete control over their AI experience.

## Research Summary

Based on codebase analysis:
- **Client database pattern**: PGlite schema in [client-only.ts](src/client/db/schema/client-only.ts) with Drizzle ORM
- **Folder structure**: Folders already exist with `folder` table, chats reference via `folderId`
- **Settings pattern**: localStorage utilities in [src/client/storage/](src/client/storage/) + Settings UI in [settings.tsx](src/routes/dashboard/settings.tsx)
- **Chat input**: [chat-input.tsx](src/components/chat/chat-input.tsx) uses Zustand store, no existing `@` mention system
- **Chat streaming**: [api/chat.ts](src/routes/api/chat.ts) with inline system prompts, would need agent abstraction for summarization
- **Sidebar folders**: [nav-folders.tsx](src/components/nav/nav-folders.tsx) with collapsible folder items

## Key Design Decisions

1. **One memory document per folder** - Stored as structured JSON with blocks array
2. **Shared authorship** - Both LLM (`source: "llm"`) and user (`source: "user"`) can contribute blocks
3. **Intelligent merge** - LLM attempts to merge new context with existing blocks
4. **Uncategorized folder** - Created on first chat, all new chats default there
5. **Opt-in creation** - User triggers memory creation (never automatic)
6. **Global settings** - Memory threshold (default 20 messages), enable/disable toggle
7. **Diff/preview** - Show users what will change before updating memories

## Memory Document Schema

```typescript
interface MemoryBlock {
  id: string;
  source: "llm" | "user";
  content: string;
  generatedAt?: string;  // For LLM blocks
  editedAt?: string;     // For user blocks
}

interface FolderMemory {
  id: string;
  folderId: string;  // "uncategorized" for orphan chats
  userId: string;
  blocks: MemoryBlock[];
  lastProcessedChatId: string | null;
  lastProcessedMessageDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Phase 1: Foundation - Database Schema & Settings

**Goal**: Establish the data layer and global settings infrastructure

### Changes

1. **Create `src/client/db/schema/memory.ts`**
   - Define `folderMemory` table with JSONB `blocks` column
   - Follow pattern from [client-only.ts:63-75](src/client/db/schema/client-only.ts#L63-L75) (folder table)
   - Add relations to folder table

2. **Update `src/client/db/schema/index.ts`**
   - Export new memory schema
   - Add to client schema exports

3. **Create `src/client/storage/memory-settings.ts`**
   - Follow pattern from [default-model.ts](src/client/storage/default-model.ts)
   - Functions: `getMemorySettings()`, `setMemorySettings()`, `isMemoryEnabled()`
   - Default: `{ enabled: true, threshold: 20 }`

4. **Update `src/routes/dashboard/settings.tsx`**
   - Add new "Memories" tab after "Preferences"
   - Toggle switch for enable/disable
   - Number input for message threshold (5-100 range)
   - Info card explaining the feature

5. **Generate database migration**
   - Run `bun db:generate` to create migration file

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes
- [ ] Migration generates without errors

**Manual**:
- [ ] Settings tab shows memory options
- [ ] Toggle and threshold persist after page refresh

---

## Phase 2: Uncategorized Folder & Default Assignment

**Goal**: Ensure all chats have a folder, creating "Uncategorized" as default

### Changes

1. **Create `src/client/actions/uncategorized-folder.ts`**
   - Function `ensureUncategorizedFolder(userId)` - creates if not exists
   - Function `getUncategorizedFolderId(userId)` - returns ID
   - Mark with special identifier (e.g., `id: "uncategorized"` or `name: "Uncategorized"` with flag)

2. **Update `src/client/actions/chat-actions.ts`**
   - On chat creation, if no `folderId` specified, assign to uncategorized
   - Follow existing pattern in file

3. **Update `src/client/hooks/use-local-folders.ts`**
   - Ensure uncategorized folder is created on first access
   - Sort to always show uncategorized at bottom (or top, design decision)

4. **Update `src/components/nav/nav-folders.tsx`**
   - Show uncategorized folder with special styling
   - Cannot be deleted or renamed

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun test` passes

**Manual**:
- [ ] New user sees "Uncategorized" folder automatically
- [ ] New chats appear in Uncategorized if not assigned
- [ ] Cannot delete/rename Uncategorized folder

---

## Phase 3: Memory CRUD Operations

**Goal**: Core memory data access layer

### Changes

1. **Create `src/client/actions/memory-actions.ts`**
   - `getFolderMemory(folderId, userId)` - get memory document
   - `createFolderMemory(folderId, userId, blocks)` - create new
   - `updateFolderMemory(memoryId, blocks)` - update existing
   - `deleteFolderMemory(memoryId)` - delete memory
   - `addMemoryBlock(memoryId, block)` - add single block
   - `updateMemoryBlock(memoryId, blockId, content)` - edit block
   - `deleteMemoryBlock(memoryId, blockId)` - remove block

2. **Create `src/client/hooks/use-folder-memory.ts`**
   - `useFolderMemory(folderId, userId)` - TanStack Query hook
   - `useCreateFolderMemory()` - mutation hook
   - `useUpdateFolderMemory()` - mutation hook
   - Follow pattern from [use-local-folders.ts](src/client/hooks/use-local-folders.ts)

3. **Create `src/client/queries/memory-queries.ts`**
   - Query key factory: `memoryKeys.folder(folderId)`
   - Query functions for React Query

4. **Create `src/types/memory.ts`**
   - Export `MemoryBlock`, `FolderMemory`, `MemorySettings` types
   - Update `src/types/index.ts` to re-export

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun test` passes (add basic tests)

**Manual**:
- [ ] Can create/read/update/delete memories via console/tests

---

## Phase 4: Summarization Agent

**Goal**: Backend agent for generating memory summaries from conversations

### Changes

1. **Create `src/server/agents/prompts.ts`**
   - Export `getAgentSystemPrompt(agentType, context)`
   - Agent types: `"chat"` (default), `"summarize"`
   - Summarization prompt focuses on extracting key context, preferences, facts

2. **Create `src/server/agents/summarize.ts`**
   - Factory function for summarization configuration
   - Defines expected output format (structured JSON blocks)
   - Uses a reliable summarization model (can be configured)

3. **Create `src/routes/api/summarize.ts`**
   - POST endpoint for memory generation
   - Accepts: `{ messages, existingMemory?, folderId }`
   - Returns: `{ blocks: MemoryBlock[], diff?: MemoryDiff }`
   - Uses `protectedMiddleware` for auth
   - Override model selection for summarization quality

4. **Update `src/routes/api/chat.ts`**
   - Refactor inline system prompts to use `getAgentSystemPrompt()`
   - Maintain backward compatibility

5. **Create `src/types/agents.ts`**
   - Type definitions for agent system

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun test` passes

**Manual**:
- [ ] API endpoint generates coherent memory blocks from sample messages
- [ ] Existing chat functionality unchanged

---

## Phase 5: Folder Memory UI - View & Edit

**Goal**: UI for viewing and editing folder memories

### Changes

1. **Create `src/routes/dashboard/folder.$folderId.tsx`**
   - Folder detail/homepage route
   - Shows: folder name, chat count, memory editor
   - Accessible by clicking folder name in sidebar

2. **Create `src/components/memory/memory-editor.tsx`**
   - Display memory blocks with source indicators (LLM/User badges)
   - Inline editing for user blocks
   - Add new block button
   - Delete block button
   - Timestamps shown

3. **Create `src/components/memory/memory-block.tsx`**
   - Individual block component
   - Different styling for LLM vs user blocks
   - Edit/delete actions on hover

4. **Update `src/components/nav/nav-folders.tsx`**
   - Make folder name clickable (links to folder page)
   - Add "Memories" indicator badge if memory exists

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Can navigate to folder page from sidebar
- [ ] Can view existing memory blocks
- [ ] Can add/edit/delete user blocks
- [ ] LLM blocks show as read-only with different styling

---

## Phase 6: Memory Generation Flow - Sidebar

**Goal**: Generate/update memories from folder sidebar actions

### Changes

1. **Create `src/components/memory/memory-generation-dialog.tsx`**
   - Dialog showing chats to include in memory generation
   - Checkbox list of chats (pre-selected: new since last generation)
   - Preview/diff view after generation
   - Confirm/cancel actions

2. **Create `src/client/hooks/use-memory-generation.ts`**
   - Hook for memory generation flow
   - Tracks: chats to process, generation state, preview
   - Calls summarization API

3. **Update `src/components/nav/nav-folders.tsx`**
   - Add dropdown menu item: "Generate Memories" (if no memory exists)
   - Add dropdown menu item: "Update Memories" (if memory exists)
   - Show indicator for new conversations since last update

4. **Create `src/components/memory/memory-diff-preview.tsx`**
   - Shows before/after comparison
   - Highlights new blocks, modified content
   - Accept/reject individual changes

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes

**Manual**:
- [ ] "Generate Memories" appears for folders without memories
- [ ] "Update Memories" appears for folders with memories
- [ ] Can select which chats to include
- [ ] Preview shows generated blocks before saving

---

## Phase 7: In-Chat Memory Trigger (`@create-memory`)

**Goal**: Allow users to trigger memory creation from within a chat

### Changes

1. **Create `src/components/chat/memory-suggestion.tsx`**
   - Suggestion banner shown after message threshold reached
   - "Create memory from this conversation?" with accept/dismiss
   - Remembers dismissal for current chat session

2. **Update `src/client/hooks/use-chat-stream.ts`**
   - Track message count in current session
   - Trigger suggestion after threshold (from settings)
   - Handle `@create-memory` command detection

3. **Update `src/components/chat/chat-input.tsx`**
   - Detect `@create-memory` in input
   - Show confirmation before sending
   - Trigger memory generation for current chat's folder

4. **Create `src/client/hooks/use-memory-suggestion.ts`**
   - Track whether to show suggestion
   - Handle dismissal state
   - Check message count vs threshold

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes

**Manual**:
- [ ] Suggestion appears after 20 messages (or configured threshold)
- [ ] Typing `@create-memory` triggers memory generation
- [ ] Memory is added to current folder's memory document

---

## Phase 8: Memory Reference Syntax (`@memories`)

**Goal**: Allow users to inject memories into chat context

### Changes

1. **Create `src/components/chat/mention-popover.tsx`**
   - Popover for `@` mentions
   - Shows: `@memories` (current folder), `@memories:folder-name` options
   - Autocomplete as user types

2. **Update `src/components/chat/chat-input.tsx`**
   - Detect `@` character to trigger popover
   - Parse `@memories` and `@memories:folder-name` syntax
   - Store selected memories in message metadata

3. **Update `src/client/hooks/use-chat-stream.ts`**
   - Extract memory references from message
   - Fetch referenced memories
   - Include in request body to API

4. **Update `src/routes/api/chat.ts`**
   - Accept `memories` in request body
   - Inject memory content into system prompt
   - Format: "User memories for context: ..."

5. **Create `src/components/chat/memory-badge.tsx`**
   - Visual indicator in input showing referenced memories
   - Removable chips for each memory reference

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes

**Manual**:
- [ ] Typing `@` shows mention popover
- [ ] `@memories` injects current folder's memory
- [ ] `@memories:FolderName` injects specific folder's memory
- [ ] Memory content visible in AI responses (contextually aware)

---

## Phase 9: Polish & Edge Cases

**Goal**: Handle edge cases and improve UX

### Changes

1. **Empty states**
   - No memory yet: "Generate your first memory"
   - No chats in folder: "Start chatting to build memories"

2. **Error handling**
   - Summarization API errors: retry with exponential backoff
   - Storage quota warnings: alert user

3. **Update data management in settings**
   - Add memories to storage statistics
   - Add "Clear all memories" action

4. **Loading states**
   - Skeleton loaders for memory editor
   - Progress indicator during generation

5. **Accessibility**
   - Keyboard navigation for mention popover
   - ARIA labels for memory blocks
   - Screen reader announcements

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun test` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] All empty states display correctly
- [ ] Errors are handled gracefully
- [ ] Keyboard navigation works throughout

---

## Phase 10: (Future) On-Device Summarization Model

**Goal**: Replace server-side summarization with on-device model for full privacy

### Changes (Deferred)

1. Research on-device model options:
   - TensorFlow.js models
   - ONNX Runtime Web
   - Custom fine-tuned small model

2. Create `src/client/ml/summarizer.ts`
   - Load and run model in browser
   - Fallback to API if model unavailable

3. Update summarization flow to prefer on-device

### Notes
- This phase is intentionally deferred
- Current implementation uses configurable server-side model
- Architecture supports easy swap to on-device later

---

## Architecture Notes

### Data Flow

```
User Action (Sidebar/Chat)
    ↓
Memory Generation Hook
    ↓
Summarization API (POST /api/summarize)
    ↓
LLM Processing (OpenRouter with summarization model)
    ↓
Structured Response (MemoryBlock[])
    ↓
Preview/Diff UI
    ↓
User Confirmation
    ↓
PGlite Storage (folderMemory table)
```

### Memory Injection Flow

```
User types @memories
    ↓
Mention Popover (select folder)
    ↓
Memory fetched from PGlite
    ↓
Attached to message metadata
    ↓
Sent to /api/chat
    ↓
Injected into system prompt
    ↓
LLM receives context
```

### Files Created (Summary)

**Database & Types**:
- `src/client/db/schema/memory.ts`
- `src/types/memory.ts`
- `src/types/agents.ts`

**Storage & Settings**:
- `src/client/storage/memory-settings.ts`

**Actions & Hooks**:
- `src/client/actions/memory-actions.ts`
- `src/client/actions/uncategorized-folder.ts`
- `src/client/hooks/use-folder-memory.ts`
- `src/client/hooks/use-memory-generation.ts`
- `src/client/hooks/use-memory-suggestion.ts`
- `src/client/queries/memory-queries.ts`

**Server**:
- `src/server/agents/prompts.ts`
- `src/server/agents/summarize.ts`
- `src/routes/api/summarize.ts`

**Components**:
- `src/components/memory/memory-editor.tsx`
- `src/components/memory/memory-block.tsx`
- `src/components/memory/memory-generation-dialog.tsx`
- `src/components/memory/memory-diff-preview.tsx`
- `src/components/chat/memory-suggestion.tsx`
- `src/components/chat/mention-popover.tsx`
- `src/components/chat/memory-badge.tsx`

**Routes**:
- `src/routes/dashboard/folder.$folderId.tsx`

### Patterns Followed

- **Storage utilities**: Pattern from `src/client/storage/default-model.ts`
- **PGlite schema**: Pattern from `src/client/db/schema/client-only.ts`
- **Hooks**: Pattern from `src/client/hooks/use-local-folders.ts`
- **Settings UI**: Pattern from `src/routes/dashboard/settings.tsx`
- **Components**: shadcn/ui primitives from `src/components/ui/`

### Not In Scope

- Server-side memory storage (privacy-first = client-only)
- Cross-device sync (local-first architecture)
- Automatic memory generation (always user-initiated)
- Memory sharing between users

### Future Considerations

- Export/import memories (for backup/transfer)
- Memory templates (predefined context snippets)
- Memory categories/tags within a folder
- On-device summarization model (Phase 10)
