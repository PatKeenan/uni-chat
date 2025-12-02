# Implementation Plan: User Memories Feature

## Overview

A transparent, user-controlled memories system that stores context summaries at the folder level. Users can view, edit, and reference memories in conversations. Memories are stored 100% client-side in PGlite, with LLM-generated summaries using a dedicated summarization agent (Claude Haiku). The feature emphasizes user control and privacy.

## Research Summary

Based on codebase analysis:
- **Pattern to follow**: Folder CRUD in `src/client/actions/folder-actions.ts`, settings in `src/client/storage/`
- **Integration points**: Chat input (`src/components/chat/chat-input.tsx`), sidebar (`src/components/nav/nav-folders.tsx`), settings page (`src/routes/dashboard/settings.tsx`)
- **Files involved**: PGlite schema, client actions/hooks, new route, new components, server action for summarization

## Data Model

### Memory Document Structure
```typescript
interface MemoryBlock {
  id: string;
  source: "llm" | "user";
  content: string;
  createdAt: string;      // ISO timestamp
  updatedAt?: string;     // Only for edits
}

interface IncludedChatRef {
  chatId: string;
  lastMessageDate: string;
  messageCount: number;
}

// Stored in folder_memory table
interface FolderMemory {
  id: string;
  userId: string;
  folderId: string | null;  // null = uncategorized
  blocks: MemoryBlock[];
  includedChats: IncludedChatRef[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Settings (localStorage)
- `memory_enabled`: boolean (default: true)
- `memory_auto_suggest_threshold`: number (default: 20, 0 = disabled)

---

## Phase 1: Database Schema & Core Infrastructure

**Goal**: Establish the data layer for memories

### Changes

1. **Modify `src/client/db/schema/client-only.ts`**
   - Add `folderMemory` table with JSONB columns for blocks and includedChats
   - Add unique constraint on (userId, folderId)
   - Follow pattern from `message` table (lines 117-134) for JSONB typing

2. **Create `src/types/memory.ts`**
   - Define `MemoryBlock`, `IncludedChatRef`, `FolderMemory` types
   - Export from `src/types/index.ts`

3. **Create `src/client/storage/memory-settings.ts`**
   - Follow pattern from `src/client/storage/api-key.ts`
   - Functions: `getMemoryEnabled()`, `setMemoryEnabled()`, `getAutoSuggestThreshold()`, `setAutoSuggestThreshold()`

4. **Run migration**
   - Execute `bun db:generate:client` to generate migration SQL
   - Migration auto-applies on next db initialization

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Open app, check browser DevTools → Application → IndexedDB → `uni-chat-local` → verify `folder_memory` table exists

---

## Phase 2: Memory CRUD Operations

**Goal**: Implement client-side memory data operations

### Changes

1. **Create `src/client/actions/memory-actions.ts`**
   - Follow pattern from `src/client/actions/folder-actions.ts`
   - Functions:
     - `createFolderMemory(userId, folderId)` - Create empty memory document
     - `getFolderMemory(userId, folderId)` - Get memory for folder (null = uncategorized)
     - `updateFolderMemoryBlocks(userId, folderId, blocks)` - Update blocks array
     - `addUserMemoryBlock(userId, folderId, content)` - Add user-authored block
     - `updateMemoryBlock(userId, folderId, blockId, content)` - Edit existing block
     - `deleteMemoryBlock(userId, folderId, blockId)` - Remove block
     - `updateIncludedChats(userId, folderId, chats)` - Track processed chats
     - `deleteFolderMemory(userId, folderId)` - Delete entire memory

2. **Create `src/client/hooks/use-memories.ts`**
   - Follow pattern from `src/client/hooks/use-local-folders.ts`
   - Export `memoryKeys` for query key management
   - Hooks:
     - `useFolderMemory(userId, folderId)` - Query single folder's memory
     - `useCreateFolderMemory(userId)` - Mutation to create
     - `useUpdateMemoryBlocks(userId)` - Mutation with optimistic updates
     - `useAddUserBlock(userId)` - Mutation to add user block
     - `useDeleteMemoryBlock(userId)` - Mutation to remove block

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun test` passes (add basic tests)
- [ ] `bun lint` passes

**Manual**:
- [ ] Can create/read/update/delete memories via browser console using exported functions

---

## Phase 3: Uncategorized Folder & Folder Homepage

**Goal**: Create default folder and folder detail page

### Changes

1. **Modify `src/client/actions/chat-actions.ts`**
   - In `createLocalChat()`, check if uncategorized folder exists for user
   - If not, create it with name "Uncategorized" before creating chat
   - Assign new chat to uncategorized folder if no folderId provided

2. **Create `src/routes/dashboard/folder.$folderId.tsx`**
   - Follow pattern from `src/routes/dashboard/c.$chatId.tsx`
   - Loader fetches folder, chats in folder, folder memory
   - Special handling for `folderId === "uncategorized"` (null folderId)

3. **Create `src/components/folder/folder-view.tsx`**
   - Display folder name, chat count
   - List of chats in folder (clickable to navigate)
   - Memory section with editor (Phase 5)
   - "Generate Memories" or "Update Memories" button placeholder

4. **Modify `src/components/nav/nav-folders.tsx`**
   - Make folder names clickable → navigate to `/dashboard/folder/:folderId`
   - Add visual indicator if folder has memories (small icon)
   - Show "Uncategorized" folder in list (filter for folderId === null chats)

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Create new chat → uncategorized folder created automatically
- [ ] Click folder name in sidebar → navigates to folder page
- [ ] Folder page shows chat count and list of chats

---

## Phase 4: Memory Generation (Summarization Agent)

**Goal**: Implement server-side LLM summarization

### Changes

1. **Create `src/integrations/openrouter/memory-agent.ts`**
   - Factory function `createMemoryAgent(apiKey)`
   - Uses `anthropic/claude-3-haiku` via OpenRouter
   - Function `generateMemorySummary(messages, existingBlocks)`:
     - Takes conversation messages and existing memory blocks
     - Returns new blocks (preserving user-authored ones)
     - Intelligent merging: avoids duplicating user content

2. **Create `src/server/actions/memory-actions.ts`**
   - `generateMemory` server action with `protectedMiddleware`
   - Input: chatIds to summarize, existing memory blocks, apiKey
   - Fetches messages for specified chats (client sends them)
   - Calls memory agent
   - Returns proposed new blocks (client decides to save)

3. **Create `src/types/memory-agent.ts`**
   - Request/response types for memory generation
   - Prompt templates as constants

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Call server action with test messages → returns summarized blocks
- [ ] Existing user blocks preserved in output

---

## Phase 5: Memory Editor UI

**Goal**: Build the memory viewing and editing interface

### Changes

1. **Create `src/components/folder/memory-editor.tsx`**
   - Display memory blocks with authorship badges (LLM vs User)
   - Inline editing for each block (click to edit, blur to save)
   - Add new user block button
   - Delete block button (with confirmation)
   - Empty state: "No memories yet. Generate from conversations or add your own."

2. **Create `src/components/folder/memory-diff-preview.tsx`**
   - Shows "What's Changed" summary before applying updates
   - Lists: blocks added, blocks modified, blocks preserved
   - Approve / Cancel buttons
   - Uses dialog/modal pattern from `src/components/ui/dialog.tsx`

3. **Update `src/components/folder/folder-view.tsx`**
   - Integrate memory editor
   - Add "Generate Memories" button (if no memory exists)
   - Add "Update Memories" button (if memory exists, shows new chat count)
   - Button triggers generation → shows diff preview → user approves → saves

4. **Create `src/client/hooks/use-memory-generation.ts`**
   - Hook to manage generation flow
   - Tracks: isGenerating, proposedBlocks, error
   - Functions: generateFromChats(), applyProposed(), discardProposed()

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Can view memory blocks on folder page
- [ ] Can add/edit/delete user blocks
- [ ] Can generate memory from conversations
- [ ] Diff preview shows before applying changes

---

## Phase 6: Memory Reference Syntax (`@memories`)

**Goal**: Enable referencing memories in chat input

### Changes

1. **Create `src/client/hooks/use-memory-references.ts`**
   - Parse input for `@memories` and `@memories:folder-name` patterns
   - Return: `{ references: MemoryReference[], cleanedInput: string }`
   - Handle multiple references in single message

2. **Modify `src/components/chat/chat-input.tsx`**
   - On submit, parse for memory references
   - Fetch referenced memories
   - Pass memory context to chat submission

3. **Create `src/components/chat/memory-injection-message.tsx`**
   - Special message component for displaying injected memories
   - Styled distinctly (e.g., subtle background, 📚 icon)
   - Collapsible to show/hide full content
   - Shows which folder(s) memories came from

4. **Modify `src/routes/api/chat.ts`**
   - Accept `memoryContext` in request body
   - Prepend memory content to system prompt or as system message
   - Format: "Context from memories: [folder name]\n[memory content]"

5. **Modify `src/components/chat/chat-message-list.tsx`**
   - Render memory injection messages at appropriate position
   - Show before user's message that triggered injection

6. **Create `src/components/chat/memory-reference-autocomplete.tsx`**
   - Dropdown that appears when user types `@`
   - Shows: `@memories` (current folder), `@memories:FolderName` for each folder
   - Keyboard navigation support

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Type `@memories` → autocomplete appears
- [ ] Submit message with `@memories` → memory shown in chat UI
- [ ] LLM response references information from memories
- [ ] Multiple `@memories:folder1 @memories:folder2` both inject

---

## Phase 7: Auto-Suggest & `@create-memory`

**Goal**: Implement proactive memory creation suggestions

### Changes

1. **Create `src/client/hooks/use-memory-auto-suggest.ts`**
   - Track message count in current chat
   - Compare against threshold from settings
   - Check if chat already included in folder's memory
   - Return: `{ shouldSuggest: boolean, dismiss: () => void }`

2. **Create `src/components/chat/memory-suggest-banner.tsx`**
   - Non-intrusive banner below chat input
   - "💡 This conversation has valuable context. Create a memory?"
   - Buttons: "Create Memory" / "Dismiss" / "Don't ask again for this chat"

3. **Modify `src/components/chat/chat-input.tsx`**
   - Integrate auto-suggest hook
   - Show banner when `shouldSuggest` is true
   - Handle `@create-memory` in input (after message sent, trigger generation)

4. **Create `src/client/actions/memory-suggest-actions.ts`**
   - `dismissSuggestion(chatId)` - Mark chat as dismissed for this session
   - `createMemoryFromChat(userId, chatId)` - Trigger generation flow

5. **Modify `src/components/chat/chat-view-content.tsx`**
   - Integrate suggest banner component
   - Position below input area

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] After 20 messages, suggestion banner appears
- [ ] Clicking "Create Memory" generates and shows diff preview
- [ ] Dismissing hides banner for session
- [ ] Type `@create-memory` in message → after send, generation triggers

---

## Phase 8: Settings Integration

**Goal**: Add memory settings to settings page and data management

### Changes

1. **Modify `src/routes/dashboard/settings.tsx`**
   - Add "Memories" section to Preferences tab
   - Toggle: "Enable memories feature"
   - Number input: "Auto-suggest after N messages" (0 to disable)

2. **Modify Data Management section**
   - Add "Memories" row showing storage used
   - Add "Clear All Memories" button with confirmation
   - Update total storage calculation to include memories

3. **Create `src/client/hooks/use-memory-stats.ts`**
   - Calculate total memory storage across all folders
   - Count of folders with memories
   - Total blocks count

4. **Create `src/client/actions/memory-data-actions.ts`**
   - `clearAllMemories(userId)` - Delete all folder_memory records
   - `getMemoryStorageStats(userId)` - Calculate storage used

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Can toggle memories on/off in settings
- [ ] Can adjust auto-suggest threshold
- [ ] Can see memory storage usage
- [ ] Can clear all memories

---

## Phase 9: Polish & Edge Cases

**Goal**: Handle edge cases and improve UX

### Changes

1. **Handle folder deletion**
   - When folder deleted, also delete its memory
   - Modify `src/client/actions/folder-actions.ts` `deleteLocalFolder()`

2. **Handle chat moving between folders**
   - When chat moved, update `includedChats` in both source and destination memories
   - Or: regenerate affected memories (simpler)

3. **Handle empty states**
   - Folder with no chats: "Add chats to this folder to generate memories"
   - Memories disabled: Hide all memory UI elements

4. **Loading states**
   - Skeleton loaders for memory editor
   - Spinner during generation
   - Progress indicator for multi-chat generation

5. **Error handling**
   - API key missing: Prompt to add in settings
   - Generation failed: Show error with retry button
   - Network error: Show offline indicator

6. **Accessibility**
   - Keyboard navigation for memory editor
   - ARIA labels for memory blocks
   - Screen reader announcements for generation status

### Success Criteria

**Automated**:
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Delete folder → memory also deleted
- [ ] Move chat → memories update appropriately
- [ ] All loading states display correctly
- [ ] Error states show helpful messages

---

## Notes

### Patterns Used
- PGlite JSONB columns for flexible block storage
- TanStack Query for data fetching with optimistic updates
- localStorage for settings (SSR-safe pattern)
- Server actions with middleware for LLM calls
- Component composition for memory UI

### Not In Scope
- On-device summarization model (future enhancement)
- Memory sharing between users
- Memory export/import
- Memory search within content
- Memory versioning/history

### Future Considerations
- **On-device model**: Could swap `memory-agent.ts` to use TensorFlow.js or similar
- **Memory templates**: Pre-defined memory structures for different use cases
- **Smart suggestions**: AI-powered suggestions for what to add to memories
- **Cross-folder memories**: Global memories that apply everywhere
