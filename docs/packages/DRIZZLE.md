# Drizzle ORM Documentation

**Package:** `drizzle-orm`
**Version:** 0.44.7
**Purpose:** TypeScript ORM for SQL databases
**Last Updated:** 2025-11-17

---

## Table of Contents
1. [Overview](#overview)
2. [Installation](#installation)
3. [Schema Definition](#schema-definition)
4. [Querying](#querying)
5. [Mutations](#mutations)
6. [Relations](#relations)
7. [Migrations](#migrations)
8. [Best Practices for Our Project](#best-practices-for-our-project)
9. [Common Patterns](#common-patterns)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Drizzle?

Drizzle ORM is a TypeScript ORM for SQL databases with:
- Full type safety
- SQL-like query API
- Zero runtime overhead
- Excellent performance
- Support for multiple databases (PostgreSQL, MySQL, SQLite)

### Why Drizzle for This Project?

**Key Advantages:**
1. **Same Schema, Multiple Databases:** Use identical schema definitions for both server (PostgreSQL) and client (PGlite)
2. **Type Safety:** Catch errors at compile time
3. **SQL-First:** Direct SQL mapping, no magic
4. **Performance:** Minimal overhead
5. **Developer Experience:** Autocomplete, inline docs

---

## Installation

```bash
# Core package
pnpm add drizzle-orm

# Database drivers
pnpm add postgres          # For server PostgreSQL
pnpm add @electric-sql/pglite  # For client PGlite

# Development tools
pnpm add -D drizzle-kit    # For migrations
```

---

## Schema Definition

### Basic Table Definition

```typescript
// src/lib/shared/db/schema/chat.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';

export const chat = pgTable('chat', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  folderId: text('folder_id'),
  title: text('title'),
  selectedModel: text('selected_model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  pinned: boolean('pinned').default(false).notNull(),
});
```

### Column Types

```typescript
import {
  text,
  integer,
  boolean,
  timestamp,
  json,
  numeric,
  serial,
} from 'drizzle-orm/pg-core';

// Text
id: text('id').primaryKey()
name: text('name').notNull()
email: text('email').unique()

// Numbers
age: integer('age')
count: serial('count')  // Auto-increment
price: numeric('price', { precision: 10, scale: 2 })

// Boolean
active: boolean('active').default(true)

// Timestamps
createdAt: timestamp('created_at').defaultNow()
updatedAt: timestamp('updated_at').$onUpdate(() => new Date())

// JSON
metadata: json('metadata').$type<Record<string, unknown>>()
```

### Foreign Keys

```typescript
export const message = pgTable('message', {
  id: text('id').primaryKey(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  order: integer('order').notNull(),
});
```

**Delete Behaviors:**
- `cascade` - Delete children when parent deleted
- `set null` - Set foreign key to null
- `set default` - Set to default value
- `restrict` - Prevent deletion if children exist
- `no action` - Database default behavior

### Indexes

```typescript
import { index } from 'drizzle-orm/pg-core';

export const chat = pgTable(
  'chat',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    folderId: text('folder_id'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    // Single column index
    index('chat_user_idx').on(table.userId),

    // Composite index
    index('chat_user_updated_idx').on(table.userId, table.updatedAt.desc()),

    // Composite with folder
    index('chat_user_folder_idx').on(table.userId, table.folderId),
  ]
);
```

### Unique Constraints

```typescript
import { unique } from 'drizzle-orm/pg-core';

export const starredModel = pgTable(
  'starred_model',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    modelId: text('model_id').notNull(),
  },
  (table) => [
    // Composite unique constraint
    unique().on(table.userId, table.modelId),
  ]
);
```

### Relations

```typescript
import { relations } from 'drizzle-orm';

// One-to-many
export const chatRelations = relations(chat, ({ one, many }) => ({
  // Many-to-one (chat belongs to user)
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),

  // One-to-many (chat has many messages)
  messages: many(message),

  // Optional one-to-one (chat might have a folder)
  folder: one(folder, {
    fields: [chat.folderId],
    references: [folder.id],
  }),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
  // Many-to-one
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),

  // One-to-many
  parts: many(messagePart),
}));
```

---

## Querying

### Drizzle Instance Setup

**Server (PostgreSQL):**
```typescript
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });
```

**Client (PGlite):**
```typescript
// src/lib/client/db/index.ts
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@/lib/shared/db/schema';

const client = await PGlite.create({ dataDir: 'idb://uni-chat' });
const db = drizzle({ client, schema });
```

### Query Builder

#### Select All

```typescript
// SELECT * FROM chat
const allChats = await db.select().from(chat);

// Or with query API (recommended)
const allChats = await db.query.chat.findMany();
```

#### Select with Where

```typescript
import { eq } from 'drizzle-orm';

// SELECT * FROM chat WHERE user_id = '123'
const userChats = await db.query.chat.findMany({
  where: (chat, { eq }) => eq(chat.userId, '123'),
});

// Or with select API
const userChats = await db
  .select()
  .from(chat)
  .where(eq(chat.userId, '123'));
```

#### Select Single Record

```typescript
// Find first match
const chat = await db.query.chat.findFirst({
  where: (chat, { eq }) => eq(chat.id, 'chat-123'),
});

// Or with select + limit
const [chat] = await db
  .select()
  .from(chat)
  .where(eq(chat.id, 'chat-123'))
  .limit(1);
```

### Filtering

```typescript
import { eq, ne, gt, gte, lt, lte, like, and, or, not, isNull, isNotNull } from 'drizzle-orm';

// Equals
where: (chat, { eq }) => eq(chat.userId, '123')

// Not equals
where: (chat, { ne }) => ne(chat.title, null)

// Greater than / less than
where: (message, { gt }) => gt(message.order, 0)
where: (message, { gte }) => gte(message.order, 0)
where: (message, { lt }) => lt(message.order, 100)
where: (message, { lte }) => lte(message.order, 100)

// Like (pattern matching)
where: (chat, { like }) => like(chat.title, '%search%')

// Null checks
where: (chat, { isNull }) => isNull(chat.folderId)
where: (chat, { isNotNull }) => isNotNull(chat.title)

// Multiple conditions (AND)
where: (chat, { eq, and }) => and(
  eq(chat.userId, '123'),
  eq(chat.pinned, true)
)

// Multiple conditions (OR)
where: (chat, { eq, or }) => or(
  eq(chat.folderId, 'folder-1'),
  eq(chat.folderId, 'folder-2')
)

// NOT
where: (chat, { eq, not }) => not(eq(chat.pinned, true))

// In array
import { inArray } from 'drizzle-orm';
where: (chat, { inArray }) => inArray(chat.id, ['id1', 'id2', 'id3'])
```

### Ordering

```typescript
import { desc, asc } from 'drizzle-orm';

// Single column ascending
const chats = await db.query.chat.findMany({
  orderBy: (chat, { asc }) => [asc(chat.title)],
});

// Single column descending
const chats = await db.query.chat.findMany({
  orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
});

// Multiple columns
const chats = await db.query.chat.findMany({
  orderBy: (chat, { desc, asc }) => [
    desc(chat.pinned),      // Pinned first
    desc(chat.updatedAt),   // Then by recent
  ],
});
```

### Limiting & Pagination

```typescript
// Limit results
const chats = await db.query.chat.findMany({
  limit: 10,
});

// Offset (pagination)
const chats = await db.query.chat.findMany({
  limit: 10,
  offset: 20, // Skip first 20
});

// Better pagination pattern
const page = 2;
const pageSize = 10;
const chats = await db.query.chat.findMany({
  limit: pageSize,
  offset: (page - 1) * pageSize,
});
```

### Relations (Eager Loading)

```typescript
// Load chat with messages
const chatWithMessages = await db.query.chat.findFirst({
  where: (chat, { eq }) => eq(chat.id, 'chat-123'),
  with: {
    messages: true,  // Load all messages
  },
});

// Load with nested relations
const chatWithDetails = await db.query.chat.findFirst({
  where: (chat, { eq }) => eq(chat.id, 'chat-123'),
  with: {
    messages: {
      with: {
        parts: true,  // Load message parts
      },
    },
    folder: true,  // Load folder
  },
});

// Limit related records
const chatWithRecentMessages = await db.query.chat.findFirst({
  where: (chat, { eq }) => eq(chat.id, 'chat-123'),
  with: {
    messages: {
      limit: 10,
      orderBy: (message, { desc }) => [desc(message.createdAt)],
    },
  },
});
```

---

## Mutations

### Insert

```typescript
import { nanoid } from 'nanoid';

// Insert single record
const [newChat] = await db.insert(chat).values({
  id: nanoid(),
  userId: '123',
  selectedModel: 'gpt-4',
  title: 'New Chat',
  pinned: false,
}).returning();

// Insert multiple records
const newChats = await db.insert(chat).values([
  { id: nanoid(), userId: '123', selectedModel: 'gpt-4' },
  { id: nanoid(), userId: '123', selectedModel: 'claude-3' },
]).returning();

// Insert without returning
await db.insert(chat).values({
  id: nanoid(),
  userId: '123',
  selectedModel: 'gpt-4',
});
```

### Update

```typescript
import { eq } from 'drizzle-orm';

// Update single record
await db.update(chat)
  .set({ title: 'Updated Title' })
  .where(eq(chat.id, 'chat-123'));

// Update with returning
const [updatedChat] = await db.update(chat)
  .set({ title: 'Updated Title', updatedAt: new Date() })
  .where(eq(chat.id, 'chat-123'))
  .returning();

// Update multiple records
await db.update(chat)
  .set({ pinned: false })
  .where(eq(chat.userId, '123'));

// Partial update
await db.update(chat)
  .set({ title: 'New Title' })  // Only update title
  .where(eq(chat.id, 'chat-123'));
```

### Delete

```typescript
import { eq } from 'drizzle-orm';

// Delete single record
await db.delete(chat)
  .where(eq(chat.id, 'chat-123'));

// Delete with returning
const [deletedChat] = await db.delete(chat)
  .where(eq(chat.id, 'chat-123'))
  .returning();

// Delete multiple records
await db.delete(message)
  .where(eq(message.chatId, 'chat-123'));

// Delete all (use with caution!)
await db.delete(chat);
```

### Upsert (Insert or Update)

```typescript
import { eq } from 'drizzle-orm';

// Insert or update on conflict
await db.insert(chat)
  .values({
    id: 'chat-123',
    userId: '123',
    selectedModel: 'gpt-4',
    title: 'My Chat',
  })
  .onConflictDoUpdate({
    target: chat.id,  // Conflict on primary key
    set: {
      title: 'Updated Title',
      updatedAt: new Date(),
    },
  });

// Ignore on conflict
await db.insert(chat)
  .values({ id: 'chat-123', userId: '123', selectedModel: 'gpt-4' })
  .onConflictDoNothing();
```

---

## Migrations

### Drizzle Kit Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Generate Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# This creates SQL files in drizzle/migrations/
```

### Apply Migrations

**Server (Node.js):**
```bash
pnpm db:migrate
```

**Client (Browser):**
See [PGLITE.md](./PGLITE.md#migrations) for browser migration pattern.

### Migration Best Practices

1. **Never modify existing migrations**
   ```bash
   # ✅ GOOD: Create new migration
   pnpm db:generate

   # ❌ BAD: Edit existing migration file
   ```

2. **Review generated SQL**
   ```bash
   # Always check migration files before applying
   cat drizzle/migrations/0001_migration.sql
   ```

3. **Test migrations locally first**
   ```bash
   # Test on local database before production
   pnpm db:migrate
   ```

4. **Use transactions** (Drizzle Kit does this automatically)
   ```sql
   BEGIN;
   -- Migration statements
   COMMIT;
   ```

---

## Best Practices for Our Project

### 1. Dual Database Schema Organization

```
src/lib/
├── server/db/
│   ├── index.ts              # Server Drizzle instance
│   └── schema/
│       └── server-only.ts    # Auth tables only
├── client/db/
│   ├── index.ts              # Client Drizzle instance
│   └── schema/
│       └── client-only.ts    # Chat tables only
└── shared/db/
    └── schema/
        ├── index.ts          # Re-exports all schemas
        └── types.ts          # Shared types
```

**Server-Only Schema:**
```typescript
// src/lib/server/db/schema/server-only.ts
export const user = pgTable('user', { /* ... */ });
export const session = pgTable('session', { /* ... */ });
export const account = pgTable('account', { /* ... */ });
export const apiKey = pgTable('api_key', { /* ... */ });
```

**Client-Only Schema:**
```typescript
// src/lib/client/db/schema/client-only.ts
export const chat = pgTable('chat', { /* ... */ });
export const message = pgTable('message', { /* ... */ });
export const folder = pgTable('folder', { /* ... */ });
```

### 2. Type-Safe IDs

```typescript
// Use text IDs with client-side generation
import { nanoid } from 'nanoid';

const newChat = {
  id: nanoid(),  // Generate on client
  userId: context.user.id,
  selectedModel: 'gpt-4',
};

await db.insert(chat).values(newChat);
```

### 3. Timestamps Pattern

```typescript
// Always include timestamps
createdAt: timestamp('created_at').defaultNow().notNull(),
updatedAt: timestamp('updated_at')
  .defaultNow()
  .$onUpdate(() => new Date())  // Auto-update on changes
  .notNull(),
```

### 4. Soft Deletes (Optional)

```typescript
// Add deletedAt for soft deletes
deletedAt: timestamp('deleted_at'),

// Query only non-deleted records
const chats = await db.query.chat.findMany({
  where: (chat, { isNull }) => isNull(chat.deletedAt),
});

// Soft delete
await db.update(chat)
  .set({ deletedAt: new Date() })
  .where(eq(chat.id, chatId));
```

### 5. Optimistic Updates

```typescript
// 1. Update UI immediately (optimistic)
const optimisticChat = { ...chat, title: newTitle };
setChats(prev => prev.map(c => c.id === chatId ? optimisticChat : c));

// 2. Update database
try {
  await db.update(chat)
    .set({ title: newTitle })
    .where(eq(chat.id, chatId));
} catch (error) {
  // 3. Revert on error
  setChats(prev => prev.map(c => c.id === chatId ? chat : c));
}
```

---

## Common Patterns

### Pattern 1: Upsert with Timestamp

```typescript
await db.insert(chat)
  .values({
    id: chatId,
    userId: userId,
    selectedModel: modelId,
    updatedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: chat.id,
    set: {
      selectedModel: modelId,
      updatedAt: new Date(),
    },
  });
```

### Pattern 2: Pagination

```typescript
export async function getPaginatedChats(
  userId: string,
  page: number = 1,
  pageSize: number = 20
) {
  const offset = (page - 1) * pageSize;

  const chats = await db.query.chat.findMany({
    where: (chat, { eq }) => eq(chat.userId, userId),
    limit: pageSize,
    offset: offset,
    orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
  });

  return chats;
}
```

### Pattern 3: Batch Insert

```typescript
// Insert multiple records efficiently
const messages = userMessages.map((msg, index) => ({
  id: nanoid(),
  chatId: chatId,
  role: msg.role,
  order: index,
}));

await db.insert(message).values(messages);
```

### Pattern 4: Conditional Query

```typescript
export async function getChats(userId: string, folderId?: string) {
  const conditions = [eq(chat.userId, userId)];

  if (folderId) {
    conditions.push(eq(chat.folderId, folderId));
  }

  return await db.query.chat.findMany({
    where: (chat, { and, eq }) => and(...conditions),
  });
}
```

### Pattern 5: Transaction

```typescript
// Server only (PGlite doesn't support transactions yet)
await db.transaction(async (tx) => {
  // Create chat
  const [newChat] = await tx.insert(chat)
    .values({ id: nanoid(), userId: userId, selectedModel: modelId })
    .returning();

  // Create initial message
  await tx.insert(message)
    .values({ id: nanoid(), chatId: newChat.id, role: 'user', order: 0 });

  return newChat;
});
```

---

## Troubleshooting

### Type Errors in Relations

**Problem:** TypeScript errors in `relations()` definitions

**Solution:** These are cosmetic warnings in Drizzle 0.44.7. Ignore them:
```typescript
// @ts-expect-error - Known Drizzle ORM type issue
export const chatRelations = relations(chat, ({ one, many }) => ({
  messages: many(message),
}));
```

### Third Parameter Must Return Array

**Problem:** Error about third parameter in `pgTable()`

**Solution:** Return array `[]`, not object `{}`:
```typescript
// ✅ GOOD
export const chat = pgTable(
  'chat',
  { /* columns */ },
  (table) => [
    index('idx').on(table.userId),
  ]
);

// ❌ BAD
export const chat = pgTable(
  'chat',
  { /* columns */ },
  (table) => ({
    userIndex: index('idx').on(table.userId),
  })
);
```

### Query Returns Undefined

**Problem:** `findFirst()` returns undefined

**Solution:** Check if record exists:
```typescript
const chat = await db.query.chat.findFirst({
  where: (chat, { eq }) => eq(chat.id, chatId),
});

if (!chat) {
  throw new Error('Chat not found');
}
```

### Slow Queries

**Problem:** Queries are slow

**Solutions:**
1. Add indexes
2. Use `.limit()` to reduce results
3. Avoid N+1 queries (use `with` for eager loading)
4. Check query plan (server only):
   ```sql
   EXPLAIN ANALYZE SELECT * FROM chat WHERE user_id = '123';
   ```

---

## Additional Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Discord](https://discord.gg/yfjTbVXMW4)
- [Drizzle GitHub](https://github.com/drizzle-team/drizzle-orm)
- [PGlite + Drizzle Guide](https://orm.drizzle.team/docs/connect-pglite)

---

**Last Updated:** 2025-11-17
**Status:** Complete
**Next:** See [TANSTACK-QUERY.md](./TANSTACK-QUERY.md) for React data fetching
