# Memories Feature - Implementation Plan

## Task Summary

Implement a **folder-scoped memories system** that extracts and persists context from conversations, allowing users to:
- View and edit memories transparently
- Reference memories in chat via `@memories` syntax
- Generate memories on-demand or via auto-suggest
- Control all aspects of their memory experience (privacy-first)

### Core Principles
- **Client-side only** - All memory data stored in PGlite (IndexedDB)
- **User control** - Opt-in generation, editable content, configurable thresholds
- **Transparency** - Clear distinction between LLM-generated and user-edited content
- **Folder-scoped** - Memories organized by folder, including "uncategorized"

---

## Phase 1: Foundation

### 1.1 Database Schema

**File to create**: None (modify existing)
**File to modify**: `src/lib/client/db/schema/client-only.ts`

**Pattern source**: Existing `folder` table (lines 63-77)

```typescript
// Add after starredModel table (line 165)

// ==================== Memories ====================

/**
 * Memory Block
 *
 * Represents a single block of memory content with authorship tracking.
 */
export interface MemoryBlock {
  id: string;
  source: "llm" | "user";
  content: string;
  createdAt: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp, only for user edits
}

/**
 * Included Chat Reference
 *
 * Tracks which chats have been processed for memory generation.
 */
export interface IncludedChatRef {
  chatId: string;
  lastMessageDate: string; // ISO timestamp
  messageCount: number;
}

/**
 * Folder Memory
 *
 * Stores memory document for a folder (or uncategorized chats).
 * One document per folder with structured blocks for authorship tracking.
 */
export const folderMemory = pgTable(
  "folder_memory",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    folderId: text("folder_id").references(() => folder.id, {
      onDelete: "cascade",
    }), // null = uncategorized
    blocks: jsonb("blocks").$type<MemoryBlock[]>().default([]).notNull(),
    includedChats: jsonb("included_chats").$type<IncludedChatRef[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique().on(table.userId, table.folderId), // One memory per folder per user
    index("folder_memory_user_idx").on(table.userId),
  ]
);

export type DB_FolderMemory = typeof folderMemory.$inferSelect;
export type InsertDB_FolderMemory = typeof folderMemory.$inferInsert;
```

**Add relation** (after line 186):
```typescript
export const folderMemoryRelations = relations(folderMemory, ({ one }) => ({
  folder: one(folder, {
    fields: [folderMemory.folderId],
    references: [folder.id],
  }),
}));

// Update folderRelations to include memory
export const folderRelations = relations(folder, ({ many, one }) => ({
  chats: many(chat),
  memory: one(folderMemory),
}));
```

### 1.2 User Settings (localStorage)

**File to create**: `src/lib/client/storage/memory-settings.ts`

**Pattern source**: `src/lib/client/storage/default-model.ts`

```typescript
/**
 * Memory Settings Storage
 *
 * Manages user preferences for the memories feature.
 * Stored in localStorage for quick access.
 */

const MEMORY_ENABLED_KEY = "memory_enabled";
const MEMORY_AUTO_SUGGEST_THRESHOLD_KEY = "memory_auto_suggest_threshold";

const DEFAULT_THRESHOLD = 20;

/**
 * Check if memories feature is enabled
 */
export function isMemoryEnabled(): boolean {
  if (typeof window === "undefined") return true; // Default enabled
  const value = localStorage.getItem(MEMORY_ENABLED_KEY);
  return value === null ? true : value === "true";
}

/**
 * Enable or disable memories feature
 */
export function setMemoryEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMORY_ENABLED_KEY, String(enabled));
}

/**
 * Get auto-suggest threshold (number of messages)
 * Returns 0 if auto-suggest is disabled
 */
export function getAutoSuggestThreshold(): number {
  if (typeof window === "undefined") return DEFAULT_THRESHOLD;
  const value = localStorage.getItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY);
  if (value === null) return DEFAULT_THRESHOLD;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? DEFAULT_THRESHOLD : parsed;
}

/**
 * Set auto-suggest threshold
 * Set to 0 to disable auto-suggest
 */
export function setAutoSuggestThreshold(threshold: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY, String(threshold));
}

/**
 * Check if auto-suggest is enabled
 */
export function isAutoSuggestEnabled(): boolean {
  return getAutoSuggestThreshold() > 0;
}
```

### 1.3 Memory Actions (CRUD)

**File to create**: `src/lib/client/actions/memory-actions.ts`

**Pattern source**: `src/lib/client/actions/folder-actions.ts`

```typescript
/**
 * Memory Actions
 *
 * Client-side actions for managing folder memories.
 */

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getClientDb } from "../db";
import { folderMemory, type MemoryBlock, type IncludedChatRef } from "../db/schema";

// ==================== Read Operations ====================

export async function getMemoryByFolderId(
  userId: string,
  folderId: string | null
): Promise<typeof folderMemory.$inferSelect | null> {
  const db = await getClientDb();

  const condition = folderId === null
    ? and(eq(folderMemory.userId, userId), isNull(folderMemory.folderId))
    : and(eq(folderMemory.userId, userId), eq(folderMemory.folderId, folderId));

  const result = await db.query.folderMemory.findFirst({
    where: condition,
  });

  return result ?? null;
}

export async function getAllMemories(
  userId: string
): Promise<Array<typeof folderMemory.$inferSelect>> {
  const db = await getClientDb();
  return db.query.folderMemory.findMany({
    where: eq(folderMemory.userId, userId),
  });
}

// ==================== Write Operations ====================

export async function createMemory(data: {
  userId: string;
  folderId: string | null;
  blocks?: MemoryBlock[];
  includedChats?: IncludedChatRef[];
}): Promise<typeof folderMemory.$inferSelect> {
  const db = await getClientDb();

  const newMemory = {
    id: nanoid(),
    userId: data.userId,
    folderId: data.folderId,
    blocks: data.blocks ?? [],
    includedChats: data.includedChats ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [created] = await db.insert(folderMemory).values(newMemory).returning();
  return created;
}

export async function updateMemoryBlocks(
  memoryId: string,
  userId: string,
  blocks: MemoryBlock[]
): Promise<void> {
  const db = await getClientDb();
  await db
    .update(folderMemory)
    .set({ blocks, updatedAt: new Date() })
    .where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

export async function addMemoryBlock(
  memoryId: string,
  userId: string,
  block: MemoryBlock
): Promise<void> {
  const db = await getClientDb();
  const existing = await db.query.folderMemory.findFirst({
    where: and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)),
  });

  if (!existing) return;

  const updatedBlocks = [...existing.blocks, block];
  await updateMemoryBlocks(memoryId, userId, updatedBlocks);
}

export async function updateIncludedChats(
  memoryId: string,
  userId: string,
  includedChats: IncludedChatRef[]
): Promise<void> {
  const db = await getClientDb();
  await db
    .update(folderMemory)
    .set({ includedChats, updatedAt: new Date() })
    .where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

export async function deleteMemory(
  memoryId: string,
  userId: string
): Promise<void> {
  const db = await getClientDb();
  await db
    .delete(folderMemory)
    .where(and(eq(folderMemory.id, memoryId), eq(folderMemory.userId, userId)));
}

// ==================== Utility Operations ====================

export async function getOrCreateMemory(
  userId: string,
  folderId: string | null
): Promise<typeof folderMemory.$inferSelect> {
  const existing = await getMemoryByFolderId(userId, folderId);
  if (existing) return existing;
  return createMemory({ userId, folderId });
}

export async function hasNewConversations(
  userId: string,
  folderId: string | null,
  chats: Array<{ id: string; updatedAt: Date }>
): Promise<boolean> {
  const memory = await getMemoryByFolderId(userId, folderId);
  if (!memory) return chats.length > 0;

  const includedChatIds = new Set(memory.includedChats.map(c => c.chatId));

  return chats.some(chat => {
    if (!includedChatIds.has(chat.id)) return true;
    const included = memory.includedChats.find(c => c.chatId === chat.id);
    if (!included) return true;
    return new Date(chat.updatedAt) > new Date(included.lastMessageDate);
  });
}
```

### 1.4 React Hooks

**File to create**: `src/lib/client/hooks/use-memories.ts`

**Pattern source**: `src/lib/client/hooks/use-local-folders.ts`

```typescript
/**
 * Memory Hooks
 *
 * TanStack Query hooks for memory operations.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMemoryByFolderId,
  getAllMemories,
  createMemory,
  updateMemoryBlocks,
  addMemoryBlock,
  deleteMemory,
  getOrCreateMemory,
  hasNewConversations,
  type MemoryBlock,
} from "../actions/memory-actions";

// Query Keys
export const memoryKeys = {
  all: (userId: string) => ["memories", userId] as const,
  byFolder: (userId: string, folderId: string | null) =>
    [...memoryKeys.all(userId), "folder", folderId ?? "uncategorized"] as const,
  hasNew: (userId: string, folderId: string | null) =>
    [...memoryKeys.byFolder(userId, folderId), "has-new"] as const,
};

// ==================== Query Hooks ====================

export function useMemory(userId: string, folderId: string | null) {
  return useQuery({
    queryKey: memoryKeys.byFolder(userId, folderId),
    queryFn: () => getMemoryByFolderId(userId, folderId),
    enabled: !!userId,
  });
}

export function useAllMemories(userId: string) {
  return useQuery({
    queryKey: memoryKeys.all(userId),
    queryFn: () => getAllMemories(userId),
    enabled: !!userId,
  });
}

export function useHasNewConversations(
  userId: string,
  folderId: string | null,
  chats: Array<{ id: string; updatedAt: Date }>
) {
  return useQuery({
    queryKey: memoryKeys.hasNew(userId, folderId),
    queryFn: () => hasNewConversations(userId, folderId, chats),
    enabled: !!userId && chats.length > 0,
  });
}

// ==================== Mutation Hooks ====================

export function useCreateMemory(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { folderId: string | null; blocks?: MemoryBlock[] }) =>
      createMemory({ userId, ...data }),
    onSuccess: (memory) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
      queryClient.setQueryData(
        memoryKeys.byFolder(userId, memory.folderId),
        memory
      );
    },
  });
}

export function useUpdateMemoryBlocks(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { memoryId: string; blocks: MemoryBlock[] }) =>
      updateMemoryBlocks(data.memoryId, userId, data.blocks),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
    },
  });
}

export function useAddMemoryBlock(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { memoryId: string; block: MemoryBlock }) =>
      addMemoryBlock(data.memoryId, userId, data.block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
    },
  });
}

export function useDeleteMemory(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoryId: string) => deleteMemory(memoryId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all(userId) });
    },
  });
}

export function useGetOrCreateMemory(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderId: string | null) => getOrCreateMemory(userId, folderId),
    onSuccess: (memory) => {
      queryClient.setQueryData(
        memoryKeys.byFolder(userId, memory.folderId),
        memory
      );
    },
  });
}
```

### 1.5 Folder Homepage Route

**File to create**: `src/routes/dashboard/folder.$folderId.tsx`

**Pattern source**: `src/routes/dashboard/c.$chatId.tsx`

```typescript
/**
 * Folder Homepage Route
 *
 * Displays folder overview with chat count and memory editor.
 */

import { createFileRoute, notFound } from "@tanstack/react-router";
import { getLocalFolderById } from "@/lib/client/actions/folder-actions";
import { getLocalChats } from "@/lib/client/actions/chat-actions";
import { getMemoryByFolderId } from "@/lib/client/actions/memory-actions";
import { FolderView } from "@/components/folder/folder-view";

export const Route = createFileRoute("/dashboard/folder/$folderId")({
  component: FolderViewPage,

  loader: async ({ params, context }) => {
    const userId = context.user?.id ?? "";
    const folderId = params.folderId === "uncategorized" ? null : params.folderId;

    const [folder, chats, memory] = await Promise.all([
      folderId ? context.queryClient.ensureQueryData({
        queryKey: ["folder", params.folderId],
        queryFn: () => getLocalFolderById(params.folderId, userId),
      }) : null,
      context.queryClient.ensureQueryData({
        queryKey: ["local-chats", userId, { folderId }],
        queryFn: () => getLocalChats(userId, { folderId }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["memories", userId, "folder", folderId ?? "uncategorized"],
        queryFn: () => getMemoryByFolderId(userId, folderId),
      }),
    ]);

    // Only throw notFound for non-uncategorized folders that don't exist
    if (folderId && !folder) {
      throw notFound();
    }

    return {
      folder,
      folderId,
      chats,
      memory,
      userId,
      isUncategorized: folderId === null,
    };
  },
});

function FolderViewPage() {
  const data = Route.useLoaderData();
  return <FolderView {...data} />;
}
```

### 1.6 Folder View Component

**File to create**: `src/components/folder/folder-view.tsx`

```typescript
/**
 * Folder View Component
 *
 * Displays folder overview with memory editor.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Folder, MessageSquare, Brain, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MemoryEditor } from "./memory-editor";
import { useMemory, useGetOrCreateMemory } from "@/lib/client/hooks/use-memories";
import type { DB_Folder, DB_Chat, DB_FolderMemory } from "@/lib/client/db/schema";

interface FolderViewProps {
  folder: DB_Folder | null;
  folderId: string | null;
  chats: DB_Chat[];
  memory: DB_FolderMemory | null;
  userId: string;
  isUncategorized: boolean;
}

export function FolderView({
  folder,
  folderId,
  chats,
  memory: initialMemory,
  userId,
  isUncategorized,
}: FolderViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { data: memory } = useMemory(userId, folderId);
  const getOrCreateMemory = useGetOrCreateMemory(userId);

  const currentMemory = memory ?? initialMemory;
  const hasMemory = currentMemory && currentMemory.blocks.length > 0;

  const handleGenerateMemory = async () => {
    await getOrCreateMemory.mutateAsync(folderId);
    setIsEditing(true);
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Folder className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">
            {isUncategorized ? "Uncategorized" : folder?.name}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {chats.length} {chats.length === 1 ? "chat" : "chats"} in this folder
        </p>
      </div>

      {/* Memory Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>Folder Memory</CardTitle>
            </div>
            {hasMemory ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {isEditing ? "Done Editing" : "Edit Memory"}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleGenerateMemory}
                disabled={getOrCreateMemory.isPending || chats.length === 0}
              >
                <Brain className="h-4 w-4 mr-2" />
                {getOrCreateMemory.isPending ? "Creating..." : "Generate Memory"}
              </Button>
            )}
          </div>
          <CardDescription>
            {hasMemory
              ? "Context extracted from conversations in this folder"
              : chats.length === 0
                ? "Add chats to this folder to generate memories"
                : "Generate memories from your conversations to maintain context across chats"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasMemory && currentMemory ? (
            <MemoryEditor
              memory={currentMemory}
              userId={userId}
              isEditing={isEditing}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No memories yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Chats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chats
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No chats in this folder
            </p>
          ) : (
            <div className="space-y-2">
              {chats.slice(0, 10).map((chat) => (
                <Link
                  key={chat.id}
                  to="/dashboard/c/$chatId"
                  params={{ chatId: chat.id }}
                  className="block p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="font-medium">
                    {chat.title || "Untitled Chat"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
              {chats.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {chats.length - 10} more...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 1.7 Memory Editor Component

**File to create**: `src/components/folder/memory-editor.tsx`

```typescript
/**
 * Memory Editor Component
 *
 * Displays and allows editing of memory blocks with authorship tracking.
 */

import { useState } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUpdateMemoryBlocks, useAddMemoryBlock } from "@/lib/client/hooks/use-memories";
import type { DB_FolderMemory, MemoryBlock } from "@/lib/client/db/schema";

interface MemoryEditorProps {
  memory: DB_FolderMemory;
  userId: string;
  isEditing: boolean;
}

export function MemoryEditor({ memory, userId, isEditing }: MemoryEditorProps) {
  const [editedBlocks, setEditedBlocks] = useState<MemoryBlock[]>(memory.blocks);
  const [newBlockContent, setNewBlockContent] = useState("");

  const updateBlocks = useUpdateMemoryBlocks(userId);
  const addBlock = useAddMemoryBlock(userId);

  const handleBlockChange = (index: number, content: string) => {
    const updated = [...editedBlocks];
    updated[index] = {
      ...updated[index],
      content,
      updatedAt: new Date().toISOString(),
    };
    setEditedBlocks(updated);
  };

  const handleSave = async () => {
    await updateBlocks.mutateAsync({
      memoryId: memory.id,
      blocks: editedBlocks,
    });
  };

  const handleDeleteBlock = async (index: number) => {
    const updated = editedBlocks.filter((_, i) => i !== index);
    setEditedBlocks(updated);
    await updateBlocks.mutateAsync({
      memoryId: memory.id,
      blocks: updated,
    });
  };

  const handleAddBlock = async () => {
    if (!newBlockContent.trim()) return;

    const newBlock: MemoryBlock = {
      id: nanoid(),
      source: "user",
      content: newBlockContent.trim(),
      createdAt: new Date().toISOString(),
    };

    await addBlock.mutateAsync({
      memoryId: memory.id,
      block: newBlock,
    });

    setEditedBlocks([...editedBlocks, newBlock]);
    setNewBlockContent("");
  };

  if (!isEditing) {
    // Read-only view
    return (
      <div className="space-y-4">
        {editedBlocks.map((block, index) => (
          <div key={block.id} className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              {block.source === "llm" ? (
                <Badge variant="secondary" className="gap-1">
                  <Bot className="h-3 w-3" />
                  AI Generated
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <User className="h-3 w-3" />
                  User Added
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(block.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{block.content}</p>
          </div>
        ))}
      </div>
    );
  }

  // Editing view
  return (
    <div className="space-y-4">
      {editedBlocks.map((block, index) => (
        <div key={block.id} className="p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {block.source === "llm" ? (
                <Badge variant="secondary" className="gap-1">
                  <Bot className="h-3 w-3" />
                  AI Generated
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <User className="h-3 w-3" />
                  User Added
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteBlock(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Textarea
            value={block.content}
            onChange={(e) => handleBlockChange(index, e.target.value)}
            onBlur={handleSave}
            className="min-h-[100px]"
          />
        </div>
      ))}

      {/* Add new block */}
      <div className="p-4 rounded-lg border border-dashed">
        <Textarea
          value={newBlockContent}
          onChange={(e) => setNewBlockContent(e.target.value)}
          placeholder="Add your own memory note..."
          className="min-h-[80px] mb-2"
        />
        <Button
          onClick={handleAddBlock}
          disabled={!newBlockContent.trim() || addBlock.isPending}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Memory
        </Button>
      </div>
    </div>
  );
}
```

---

## Phase 2: Memory Generation

### 2.1 Memory Agent (Server-side)

**File to create**: `src/lib/server/ai-tools/memory-agent.ts`

**Pattern source**: `src/lib/server/ai-tools/web-search.ts`

```typescript
/**
 * Memory Agent
 *
 * Isolated agent for conversation summarization.
 * Uses a dedicated model optimized for summarization tasks.
 * Designed to be swappable with on-device model later.
 */

import { createOpenRouterClient } from "@/lib/openrouter/client";
import { generateText } from "ai";

// Hardcoded model for summarization (can be swapped later)
const SUMMARIZATION_MODEL = "anthropic/claude-3-haiku"; // Fast and good at summarization

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface SummarizationResult {
  summary: string;
  keyPoints: string[];
}

const SYSTEM_PROMPT = `You are a memory extraction assistant. Your job is to extract important context and facts from conversations that would be useful to remember for future conversations.

Focus on:
- User preferences and working style
- Technical decisions and reasoning
- Project context and goals
- Important facts mentioned
- Recurring topics or concerns

Output format:
Provide a concise summary followed by bullet points of key facts.
Keep the tone neutral and factual.
Prioritize information that would help an AI assistant be more helpful in future conversations.`;

const PRESERVE_USER_PROMPT = `The following are existing memories that include USER-ADDED content that MUST be preserved verbatim. When generating new memories, integrate new insights but NEVER modify or remove user-added sections.

EXISTING MEMORIES (preserve user-added content):
{existingMemories}

NEW CONVERSATIONS TO PROCESS:
{newConversations}

Generate updated memories that:
1. Preserve ALL user-added content exactly as written
2. Update or expand AI-generated content with new insights
3. Add new relevant information from the conversations`;

export async function summarizeConversations(
  apiKey: string,
  conversations: Array<{
    title: string;
    messages: ConversationMessage[];
  }>,
  existingMemory?: string
): Promise<string> {
  const openrouter = createOpenRouterClient(apiKey);

  const conversationText = conversations
    .map((conv) => {
      const messageText = conv.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      return `### ${conv.title}\n${messageText}`;
    })
    .join("\n\n---\n\n");

  const prompt = existingMemory
    ? PRESERVE_USER_PROMPT
        .replace("{existingMemories}", existingMemory)
        .replace("{newConversations}", conversationText)
    : `Extract memories from these conversations:\n\n${conversationText}`;

  const result = await generateText({
    model: openrouter(SUMMARIZATION_MODEL),
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 1000,
  });

  return result.text;
}
```

### 2.2 Memory Generation Server Action

**File to create**: `src/lib/server/actions/memory-actions.ts`

**Pattern source**: `src/lib/server/actions/model-actions.ts`

```typescript
/**
 * Memory Server Actions
 *
 * Server-side actions for memory generation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { protectedMiddleware } from "../middleware";
import { summarizeConversations } from "../ai-tools/memory-agent";

export const generateMemorySummary = createServerFn()
  .middleware([protectedMiddleware])
  .input(
    z.object({
      apiKey: z.string(),
      conversations: z.array(
        z.object({
          title: z.string(),
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          ),
        })
      ),
      existingMemory: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const summary = await summarizeConversations(
      data.apiKey,
      data.conversations,
      data.existingMemory
    );

    return { summary };
  });
```

### 2.3 Auto-Suggest Hook

**File to create**: `src/lib/client/hooks/use-memory-auto-suggest.ts`

```typescript
/**
 * Memory Auto-Suggest Hook
 *
 * Monitors message count and suggests memory creation.
 */

import { useState, useEffect } from "react";
import {
  getAutoSuggestThreshold,
  isMemoryEnabled,
  isAutoSuggestEnabled,
} from "../storage/memory-settings";
import { getMemoryByFolderId } from "../actions/memory-actions";

interface UseMemoryAutoSuggestOptions {
  chatId: string;
  userId: string;
  folderId: string | null;
  messageCount: number;
}

export function useMemoryAutoSuggest({
  chatId,
  userId,
  folderId,
  messageCount,
}: UseMemoryAutoSuggestOptions) {
  const [shouldSuggest, setShouldSuggest] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (!isMemoryEnabled() || !isAutoSuggestEnabled()) {
      setShouldSuggest(false);
      return;
    }

    const threshold = getAutoSuggestThreshold();
    if (messageCount > 0 && messageCount % threshold === 0) {
      // Check if this chat is already in memory
      getMemoryByFolderId(userId, folderId).then((memory) => {
        if (!memory) {
          setShouldSuggest(true);
        } else {
          const isIncluded = memory.includedChats.some((c) => c.chatId === chatId);
          if (!isIncluded) {
            setShouldSuggest(true);
          }
        }
      });
    }
  }, [messageCount, chatId, userId, folderId, dismissed]);

  const dismiss = () => {
    setDismissed(true);
    setShouldSuggest(false);
  };

  return {
    shouldSuggest,
    dismiss,
  };
}
```

---

## Phase 3: @ References

### 3.1 @ Mention Parser

**File to create**: `src/lib/client/utils/memory-parser.ts`

```typescript
/**
 * Memory Parser
 *
 * Parses @ mentions in chat input for memory references.
 */

export interface ParsedMemoryReference {
  type: "memories" | "create-memory";
  folderId: string | null; // null = current folder or uncategorized
  folderName?: string; // For @memories:folder-name syntax
  originalText: string;
}

export interface ParseResult {
  cleanText: string;
  references: ParsedMemoryReference[];
}

const MEMORY_PATTERN = /@memories(?::([a-zA-Z0-9_-]+))?/g;
const CREATE_MEMORY_PATTERN = /@create-memory/g;

export function parseMemoryReferences(input: string): ParseResult {
  const references: ParsedMemoryReference[] = [];
  let cleanText = input;

  // Parse @memories and @memories:folder-name
  let match;
  while ((match = MEMORY_PATTERN.exec(input)) !== null) {
    const folderName = match[1] || null;
    references.push({
      type: "memories",
      folderId: null, // Will be resolved by caller
      folderName: folderName || undefined,
      originalText: match[0],
    });
  }

  // Parse @create-memory
  if (CREATE_MEMORY_PATTERN.test(input)) {
    references.push({
      type: "create-memory",
      folderId: null,
      originalText: "@create-memory",
    });
  }

  // Remove references from text
  cleanText = cleanText
    .replace(MEMORY_PATTERN, "")
    .replace(CREATE_MEMORY_PATTERN, "")
    .trim();

  return { cleanText, references };
}
```

### 3.2 Context Injection

**File to modify**: `src/lib/client/hooks/use-chat-stream.ts`

Add memory context injection before sending message (around line 97-101):

```typescript
// Import at top
import { parseMemoryReferences } from "../utils/memory-parser";
import { getMemoryByFolderId } from "../actions/memory-actions";
import { getLocalFolderByName } from "../actions/folder-actions";

// In handleSubmit, before creating userMessage:
const { cleanText, references } = parseMemoryReferences(input);

// Resolve folder references and build context
let memoryContext = "";
for (const ref of references) {
  if (ref.type === "memories") {
    let targetFolderId = currentFolderId; // From chat context

    if (ref.folderName) {
      const folder = await getLocalFolderByName(userId, ref.folderName);
      targetFolderId = folder?.id ?? null;
    }

    const memory = await getMemoryByFolderId(userId, targetFolderId);
    if (memory && memory.blocks.length > 0) {
      const memoryText = memory.blocks.map((b) => b.content).join("\n\n");
      memoryContext += `\n\n[Memory Context]\n${memoryText}\n[/Memory Context]`;
    }
  }
}

// Prepend memory context to user message if present
const userMessageText = memoryContext
  ? `${memoryContext}\n\n${cleanText}`
  : cleanText;
```

---

## Phase 4: Settings UI

### 4.1 Memory Settings Tab

**File to modify**: `src/routes/dashboard/settings.tsx`

Add new tab for memory settings:

```typescript
// Add to TabsList
<TabsTrigger value="memory">Memory</TabsTrigger>

// Add TabsContent
<TabsContent value="memory" className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Memory Settings</CardTitle>
      <CardDescription>
        Control how memories are generated and suggested
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Enable Memories</Label>
          <p className="text-sm text-muted-foreground">
            Allow memory generation from conversations
          </p>
        </div>
        <Switch
          checked={memoryEnabled}
          onCheckedChange={handleMemoryEnabledChange}
        />
      </div>

      {/* Auto-suggest Threshold */}
      <div className="space-y-2">
        <Label>Auto-suggest Threshold</Label>
        <p className="text-sm text-muted-foreground">
          Suggest creating memory after this many messages (0 to disable)
        </p>
        <Input
          type="number"
          min={0}
          max={100}
          value={autoSuggestThreshold}
          onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
          disabled={!memoryEnabled}
        />
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

---

## Domains Affected

| Domain | Changes |
|--------|---------|
| **Client DB** | New `folderMemory` table, relations, types |
| **Client Storage** | New `memory-settings.ts` for localStorage prefs |
| **Client Actions** | New `memory-actions.ts` for CRUD operations |
| **Client Hooks** | New `use-memories.ts`, `use-memory-auto-suggest.ts` |
| **Client Utils** | New `memory-parser.ts` for @ syntax |
| **Server AI Tools** | New `memory-agent.ts` for summarization |
| **Server Actions** | New `memory-actions.ts` for generation endpoint |
| **Routes** | New `folder.$folderId.tsx` for folder homepage |
| **Components** | New `folder/` directory with view and editor |

---

## Files to Create

1. `src/lib/client/storage/memory-settings.ts`
2. `src/lib/client/actions/memory-actions.ts`
3. `src/lib/client/hooks/use-memories.ts`
4. `src/lib/client/hooks/use-memory-auto-suggest.ts`
5. `src/lib/client/utils/memory-parser.ts`
6. `src/lib/server/ai-tools/memory-agent.ts`
7. `src/lib/server/actions/memory-actions.ts`
8. `src/routes/dashboard/folder.$folderId.tsx`
9. `src/components/folder/folder-view.tsx`
10. `src/components/folder/memory-editor.tsx`

## Files to Modify

1. `src/lib/client/db/schema/client-only.ts` - Add folderMemory table
2. `src/lib/client/hooks/use-chat-stream.ts` - Add @ parsing and context injection
3. `src/routes/dashboard/settings.tsx` - Add memory settings tab
4. `src/components/nav-folders.tsx` - Add folder click handler to navigate to folder page

---

## Migration Steps

After modifying the schema:

```bash
bun db:generate:client
```

This will:
1. Generate new SQL migration in `drizzle/migrations-client/`
2. Export to `migrations.json` for browser consumption
3. Auto-apply on next app load via `runMigrations()`

---

## Commit Sequence

1. **feat(db): add folderMemory schema for client-side memories**
2. **feat(client): add memory settings localStorage utilities**
3. **feat(client): add memory CRUD actions and hooks**
4. **feat(routes): add folder homepage route**
5. **feat(components): add folder view and memory editor components**
6. **feat(server): add memory agent for conversation summarization**
7. **feat(client): add @ mention parsing for memory references**
8. **feat(client): integrate memory context injection in chat stream**
9. **feat(settings): add memory settings tab**
10. **feat(nav): add folder click navigation to folder homepage**

---

## Evidence Requirements for Review

- [ ] PGlite schema compiles and generates migration
- [ ] Memory CRUD operations work in isolation
- [ ] Folder homepage loads and displays correctly
- [ ] Memory editor saves/loads blocks properly
- [ ] @ parsing extracts references correctly
- [ ] Memory context injects into chat messages
- [ ] Settings persist across sessions
- [ ] Auto-suggest triggers at threshold
- [ ] TypeScript compiles with no errors
- [ ] No console errors in browser

---

## Open Questions for Implementation

1. **Folder sidebar navigation** - Should clicking folder name navigate to folder page, or should there be a separate icon?
2. **@ autocomplete** - Should we add autocomplete dropdown when typing `@`? (Can be Phase 2)
3. **Memory preview** - Should `@memories` show a preview of what will be injected?
4. **Summarization model** - Which model to use initially? (Suggested: claude-3-haiku for speed/cost)
