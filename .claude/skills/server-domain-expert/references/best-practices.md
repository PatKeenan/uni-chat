# Server Domain Best Practices Guide

> **Status:** Validated
> **Last Updated:** 2025-01-26
> **Domain Path:** `src/server/`
> **Maintainer:** AI Gatekeeper Agent

This document defines the canonical patterns, coding standards, and best practices for the Server domain. It serves as the **source of truth** for all server-side code and is used by AI coding agents for implementation and by the senior AI gatekeeper agent for code review validation.

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [Directory Structure](#2-directory-structure)
3. [Core Principles](#3-core-principles)
4. [Server Functions](#4-server-functions)
5. [Middleware](#5-middleware)
6. [Database Patterns](#6-database-patterns)
7. [Authentication](#7-authentication)
8. [Input Validation](#8-input-validation)
9. [Error Handling](#9-error-handling)
10. [Schema Design](#10-schema-design)
11. [Security Checklist](#11-security-checklist)
12. [Anti-Patterns Reference](#12-anti-patterns-reference)
13. [Sources & References](#13-sources--references)

---

## 1. Domain Overview

The Server domain contains all server-side code including:
- **Server Functions** - RPC endpoints callable from client
- **Middleware** - Request processing chain
- **Database** - Drizzle ORM with PostgreSQL
- **Authentication** - Better Auth integration
- **Utilities** - Server-only helpers (encryption, etc.)

### Key Technologies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-start` | ^1.132.0 | Server functions, middleware |
| `drizzle-orm` | ^0.44.0 | Database ORM |
| `postgres` (postgres-js) | ^3.4.0 | PostgreSQL driver |
| `better-auth` | ^1.3.0 | Authentication |
| `zod` | ^4.0.0 | Input validation |
| `nanoid` | ^5.0.0 | ID generation |

---

## 2. Directory Structure

```
src/server/
├── actions/          # Server functions (createServerFn)
│   ├── auth-actions.ts
│   ├── chat-actions.ts
│   ├── folder-actions.ts
│   ├── message-actions.ts
│   ├── model-actions.ts
│   └── api-key-actions.ts
├── middleware/       # Request middleware chain
│   ├── global-middleware.ts
│   ├── auth-middleware.ts
│   └── protected-middleware.ts
├── db/              # Database layer
│   ├── index.ts     # createDb factory
│   └── schema.ts    # All table definitions
├── auth/            # Better Auth configuration
│   └── index.ts     # getAuth factory
├── utils/           # Server utilities
│   └── encryption.ts
└── config.ts        # Per-request config loader
```

### File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Actions | `{feature}-actions.ts` | `chat-actions.ts` |
| Middleware | `{purpose}-middleware.ts` | `auth-middleware.ts` |
| Schema | `schema.ts` | Single file for all tables |
| Utilities | `{purpose}.ts` | `encryption.ts` |

---

## 3. Core Principles

### 3.1 Per-Request Isolation (CRITICAL)

**Cloudflare Workers requires fresh instances per request.** Module-level singletons cause data leaks between requests.

```typescript
// ✅ GOOD: Per-request factory wrapped in createServerOnlyFn
export const loadConfig = createServerOnlyFn(() => {
  const db = createDb();
  const auth = getAuth(db);
  return { env: process.env, db, auth };
});

// ❌ BAD: Module-level singletons (DANGEROUS - causes data leaks)
const db = createDb();
const auth = getAuth(db);
export { db, auth };
```

**Why this matters:**
- Cloudflare Workers share module state across requests
- A database connection from Request A could leak to Request B
- User sessions could cross-contaminate
- Environment variables may not be available at module load time

### 3.2 Context Threading

All server-side data flows through middleware context:

```typescript
// ✅ GOOD: Access via context
.handler(async ({ context, data }) => {
  const { db } = context.config;
  const userId = context.user.id;
});

// ❌ BAD: Import db/auth directly
import { db } from "../db";
.handler(async ({ data }) => {
  // Using module-level db - WRONG
});
```

### 3.3 User Isolation

**Every database query MUST filter by user ID** to prevent unauthorized data access.

```typescript
// ✅ GOOD: Always filter by userId
await db.select().from(chat).where(eq(chat.userId, context.user.id));

// ❌ BAD: Missing user filter (security vulnerability)
await db.select().from(chat).where(eq(chat.id, chatId));
```

---

## 4. Server Functions

### 4.1 Canonical Pattern

Server functions follow this exact method chain order (TypeScript-enforced):

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { protectedMiddleware } from "../middleware/protected-middleware";

// Define schema at module level
const CreateChatSchema = z.object({
  modelId: z.string().min(1, "Model ID is required"),
  folderId: z.string().optional(),
  title: z.string().optional(),
});

// Export inferred type for reuse
export type CreateChatInput = z.infer<typeof CreateChatSchema>;

// ✅ GOOD: Canonical server function pattern
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(CreateChatSchema)
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    const newChat = {
      id: nanoid(),
      userId: context.user.id,
      modelId: data.modelId,
      folderId: data.folderId ?? null,
      title: data.title ?? "New Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(chat).values(newChat);

    return newChat;
  });
```

### 4.2 Method Chain Order

The chain MUST follow this order:

1. `createServerFn({ method?: "GET" | "POST" })` - Create function (POST is default)
2. `.middleware([...])` - Attach middleware (optional)
3. `.inputValidator(schema)` - Validate input (optional)
4. `.handler(async ({ context, data }) => {})` - Business logic (required)

```typescript
// ✅ GOOD: Correct order
createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(schema)
  .handler(async ({ context, data }) => {});

// ❌ BAD: Wrong order (TypeScript will error)
createServerFn()
  .handler(async () => {})
  .middleware([protectedMiddleware]);

// ❌ BAD: Validation after handler
createServerFn()
  .middleware([protectedMiddleware])
  .handler(async () => {})
  .inputValidator(schema);
```

### 4.3 HTTP Method Specification

```typescript
// ✅ GOOD: Specify GET for read operations
export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => context.user);

// ✅ GOOD: POST is default for mutations
export const createChat = createServerFn()  // POST by default
  .middleware([protectedMiddleware])
  .handler(async ({ context, data }) => {});
```

### 4.4 Middleware Selection

Choose the appropriate middleware based on authentication requirements:

| Middleware | Use Case | Context Provides |
|------------|----------|------------------|
| None | Public endpoints | Nothing |
| `authMiddleware` | Optional auth (user may be null) | `config`, `session`, `user?` |
| `protectedMiddleware` | Required auth (user guaranteed) | `config`, `session`, `user!` |

```typescript
// ✅ GOOD: Public endpoint (no middleware)
export const getPublicData = createServerFn()
  .handler(async () => {
    // No auth required
  });

// ✅ GOOD: Optional auth (user may be null)
export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return context.user; // May be null
  });

// ✅ GOOD: Required auth (user guaranteed non-null)
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id; // Guaranteed to exist
  });

// ❌ BAD: Redundant middleware (protectedMiddleware already includes global)
export const createChat = createServerFn()
  .middleware([globalMiddleware, protectedMiddleware])
  .handler(async ({ context }) => {});

// ❌ BAD: Manual auth check after protectedMiddleware (redundant)
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.id) {  // REDUNDANT - protected guarantees user
      throw new Error("User not found");
    }
  });
```

### 4.5 Return Patterns

```typescript
// ✅ GOOD: Return data directly (auto-serialized)
export const getChats = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;
    return db.select().from(chat).where(eq(chat.userId, context.user.id));
  });

// ✅ GOOD: Return success indicator for mutations
export const deleteChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ chatId: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;
    await db.delete(chat).where(
      and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id))
    );
    return { success: true };
  });

// ✅ GOOD: Return created entity
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(CreateChatSchema)
  .handler(async ({ context, data }) => {
    const { db } = context.config;
    const newChat = { /* ... */ };
    await db.insert(chat).values(newChat);
    return newChat;
  });
```

---

## 5. Middleware

### 5.1 Middleware Chain Architecture

The middleware chain follows a composition pattern:

```
globalMiddleware (base)
    ↓
authMiddleware (extends global)
    ↓
protectedMiddleware (extends auth)
```

### 5.2 Global Middleware

Loads per-request configuration:

```typescript
// src/server/middleware/global-middleware.ts
import { createMiddleware } from "@tanstack/react-start";
import { loadConfig } from "../config";

export const globalMiddleware = createMiddleware().server(({ next }) => {
  const config = loadConfig();
  return next({
    context: {
      config,
    },
  });
});
```

**Context after global:** `{ config: { env, db, auth } }`

### 5.3 Auth Middleware

Fetches session and user (may be null):

```typescript
// src/server/middleware/auth-middleware.ts
import { createMiddleware } from "@tanstack/react-start";
import { globalMiddleware } from "./global-middleware";

export const authMiddleware = createMiddleware()
  .middleware([globalMiddleware])
  .server(async ({ next, request, context }) => {
    const data = await context.config.auth.api.getSession(request);

    return next({
      context: {
        session: data?.session ?? null,
        user: data?.user ?? null,
      },
    });
  });
```

**Context after auth:** `{ config, session: Session | null, user: User | null }`

### 5.4 Protected Middleware

Enforces authentication (throws if no user):

```typescript
// src/server/middleware/protected-middleware.ts
import { createMiddleware, json } from "@tanstack/react-start";
import { authMiddleware } from "./auth-middleware";

export const protectedMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user) {
      throw json({ error: "Unauthorized" }, { status: 401 });
    }

    return next({
      context: {
        ...context,
        user: context.user, // Type narrowed to non-null
      },
    });
  });
```

**Context after protected:** `{ config, session: Session, user: User }` (all non-null)

### 5.5 Middleware Patterns

```typescript
// ✅ GOOD: Proper middleware extension
export const customMiddleware = createMiddleware()
  .middleware([authMiddleware])  // Extend parent
  .server(async ({ next, context }) => {
    // context has parent's properties
    return next({
      context: {
        customProperty: "value",
      },
    });
  });

// ❌ BAD: Creating middleware without extension when needed
export const customMiddleware = createMiddleware()
  .server(async ({ next }) => {
    // No access to config, user, etc.
  });

// ❌ BAD: Duplicate context spreading (unnecessary)
export const customMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    return next({
      context: {
        ...context,  // Parent context is already inherited
        ...context,  // Duplicate spread
        customProperty: "value",
      },
    });
  });
```

---

## 6. Database Patterns

### 6.1 Database Factory

```typescript
// src/server/db/index.ts
import { createServerOnlyFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const createDb = createServerOnlyFn(() => {
  const client = postgres(process.env.DATABASE_URL, {
    max: 1,              // One connection per request (Cloudflare Workers)
    idle_timeout: 20,    // Close idle connections after 20s
    connect_timeout: 10, // Fail fast if can't connect
  });
  return drizzle(client);
});
```

### 6.2 Query Patterns

#### SQL-Like Queries (Use for simple operations)

```typescript
// ✅ GOOD: Select with filtering
const chats = await db
  .select()
  .from(chat)
  .where(eq(chat.userId, context.user.id))
  .orderBy(desc(chat.updatedAt));

// ✅ GOOD: Select specific columns
const chatIds = await db
  .select({ id: chat.id, title: chat.title })
  .from(chat)
  .where(eq(chat.userId, context.user.id));

// ✅ GOOD: Multiple conditions with and()
const result = await db
  .select()
  .from(chat)
  .where(
    and(
      eq(chat.id, chatId),
      eq(chat.userId, context.user.id)
    )
  );

// ✅ GOOD: Left join for related data
const chatsWithFolders = await db
  .select({ chat, folder })
  .from(chat)
  .leftJoin(folder, eq(chat.folderId, folder.id))
  .where(eq(chat.userId, context.user.id));
```

#### Relational Queries (Use for nested data)

```typescript
// ✅ GOOD: Fetch nested relations in single query
const chatWithMessages = await db.query.chat.findFirst({
  where: (chats, { eq }) => eq(chats.id, chatId),
  with: {
    messages: {
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      with: {
        parts: true,
      },
    },
  },
});

// ✅ GOOD: Partial select to reduce payload
const chatList = await db.query.chat.findMany({
  where: (chats, { eq }) => eq(chats.userId, userId),
  columns: {
    id: true,
    title: true,
    updatedAt: true,
  },
  orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
});
```

#### When to Use Each

| Use Case | Pattern | Why |
|----------|---------|-----|
| Simple CRUD | `db.select().from()` | Straightforward, explicit |
| Nested relations | `db.query.*` | Single query, no N+1 |
| Aggregations (COUNT, SUM) | `db.select()` | Relational API doesn't support |
| Complex joins | `db.select()` | Full SQL control |
| Dynamic queries | `db.select().$dynamic()` | Runtime flexibility |

### 6.3 Insert Patterns

```typescript
// ✅ GOOD: Insert with nanoid
const newChat = {
  id: nanoid(),
  userId: context.user.id,
  title: data.title,
  createdAt: new Date(),
  updatedAt: new Date(),
};
await db.insert(chat).values(newChat);
return newChat;

// ✅ GOOD: Insert with returning
const [created] = await db
  .insert(chat)
  .values(newChat)
  .returning();
return created;

// ❌ BAD: Missing user ID
await db.insert(chat).values({
  id: nanoid(),
  title: data.title,  // Missing userId!
});

// ❌ BAD: Using auto-increment or UUID at DB level
// All IDs should be generated with nanoid() in application code
```

### 6.4 Update Patterns

```typescript
// ✅ GOOD: Update with user ownership check
await db
  .update(chat)
  .set({ title: data.title, updatedAt: new Date() })
  .where(
    and(
      eq(chat.id, data.chatId),
      eq(chat.userId, context.user.id)
    )
  );

// ❌ BAD: Missing user ownership check (security vulnerability)
await db
  .update(chat)
  .set({ title: data.title })
  .where(eq(chat.id, data.chatId));
```

### 6.5 Delete Patterns

```typescript
// ✅ GOOD: Delete with user ownership check
await db
  .delete(chat)
  .where(
    and(
      eq(chat.id, data.chatId),
      eq(chat.userId, context.user.id)
    )
  );

// ❌ BAD: Missing user ownership check
await db.delete(chat).where(eq(chat.id, data.chatId));
```

### 6.6 Transaction Patterns

```typescript
// ✅ GOOD: Atomic multi-table operation
const result = await db.transaction(async (tx) => {
  const [newChat] = await tx
    .insert(chat)
    .values({ id: nanoid(), userId, title })
    .returning();

  await tx.insert(message).values({
    id: nanoid(),
    chatId: newChat.id,
    role: "system",
    content: "Welcome!",
  });

  return newChat;
});

// ✅ GOOD: Transaction with rollback on error
await db.transaction(async (tx) => {
  const [user] = await tx
    .select({ credits: accounts.credits })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  if (user.credits < 100) {
    tx.rollback();  // Explicit rollback
    return;
  }

  await tx
    .update(accounts)
    .set({ credits: sql`${accounts.credits} - 100` })
    .where(eq(accounts.userId, userId));
});

// ❌ BAD: Related inserts without transaction
await db.insert(chat).values(newChat);
await db.insert(message).values(newMessage);  // If this fails, chat is orphaned
```

### 6.7 Batch Operations

```typescript
// ✅ GOOD: Batch fetch with inArray
const messageIds = messages.map((m) => m.id);
const allParts = await db
  .select()
  .from(messagePart)
  .where(inArray(messagePart.messageId, messageIds))
  .orderBy(asc(messagePart.order));

// ❌ BAD: N+1 query pattern
for (const message of messages) {
  const parts = await db
    .select()
    .from(messagePart)
    .where(eq(messagePart.messageId, message.id));
}
```

---

## 7. Authentication

### 7.1 Auth Factory Pattern

```typescript
// src/server/auth/index.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactStartCookies } from "better-auth/react-start";
import type { createDb } from "../db";
import * as schema from "../db/schema";

export const getAuth = (db: ReturnType<typeof createDb>) => {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { ...schema },
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      reactStartCookies(),  // Must be last plugin
    ],
    // Recommended: Enable joins for 2-3x performance
    experimental: {
      joins: true,
    },
  });
};
```

### 7.2 Session Handling

```typescript
// ✅ GOOD: Get session from request in middleware
const data = await context.config.auth.api.getSession(request);
const session = data?.session ?? null;
const user = data?.user ?? null;

// ✅ GOOD: Access user in protected handler
export const getUserProfile = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    // context.user is guaranteed non-null
    return {
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
    };
  });
```

### 7.3 API Route Handler

```typescript
// src/routes/api/auth/$.ts
import { createFileRoute } from "@tanstack/react-router";
import { loadConfig } from "@/server/config";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { auth } = loadConfig();
        return auth.handler(request);
      },
      POST: async ({ request }) => {
        const { auth } = loadConfig();
        return auth.handler(request);
      },
    },
  },
});
```

---

## 8. Input Validation

### 8.1 Zod Schema Definition

**Always define schemas at module level and export inferred types:**

```typescript
// ✅ GOOD: Module-level schema with exported type
const CreateChatSchema = z.object({
  modelId: z.string().min(1, "Model ID is required"),
  folderId: z.string().optional(),
  title: z.string().max(200).optional(),
});

export type CreateChatInput = z.infer<typeof CreateChatSchema>;

export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(CreateChatSchema)
  .handler(async ({ context, data }) => {
    // data is typed as CreateChatInput
  });

// ❌ BAD: Inline schema (no type reuse)
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({
    modelId: z.string(),
    folderId: z.string().optional(),
  }))
  .handler(async ({ context, data }) => {});

// ❌ BAD: Inline type assertion (no runtime validation)
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator((data: { modelId: string }) => data)
  .handler(async ({ context, data }) => {});
```

### 8.2 Schema Patterns

```typescript
// Required string
z.string().min(1, "Required")

// Optional string (may be undefined)
z.string().optional()

// Nullable string (may be null - for DB NULL fields)
z.string().nullable()

// Optional OR nullable
z.string().nullish()

// String with constraints
z.string().min(1).max(200).email()

// Number
z.number().min(0).max(100)

// Boolean
z.boolean()

// Array
z.array(z.string())

// Object
z.object({
  field1: z.string(),
  field2: z.number().optional(),
})

// Enum
z.enum(["user", "assistant", "system"])
```

### 8.3 Optional vs Nullable

| Method | Accepts `undefined` | Accepts `null` | Use Case |
|--------|---------------------|----------------|----------|
| `.optional()` | ✅ | ❌ | Field may be omitted |
| `.nullable()` | ❌ | ✅ | Field can be SQL NULL |
| `.nullish()` | ✅ | ✅ | Either omitted or null |

```typescript
// ✅ GOOD: Match database schema
const MoveChatSchema = z.object({
  chatId: z.string(),
  folderId: z.string().nullable(),  // Can be null for "no folder"
});

// ✅ GOOD: Optional for truly optional fields
const UpdateChatSchema = z.object({
  chatId: z.string(),
  title: z.string().optional(),     // May not be provided
  modelId: z.string().optional(),
});
```

### 8.4 Custom Error Messages

```typescript
// ✅ GOOD: User-friendly error messages
const CreateUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
  name: z.string().min(1, "Name is required"),
});
```

---

## 9. Error Handling

### 9.1 Error Patterns

```typescript
// ✅ GOOD: Throw Error for business logic failures
export const getChatById = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ chatId: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    const result = await db
      .select()
      .from(chat)
      .where(
        and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id))
      )
      .limit(1);

    if (!result[0]) {
      throw new Error("Chat not found");
    }

    return result[0];
  });

// ✅ GOOD: throw json() for HTTP errors in middleware
if (!context.user) {
  throw json({ error: "Unauthorized" }, { status: 401 });
}

// ✅ GOOD: Return error in response for validation
export const validateApiKey = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ apiKey: z.string() }))
  .handler(async ({ data }) => {
    try {
      await testApiKey(data.apiKey);
      return { valid: true, error: null };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid API key",
      };
    }
  });
```

### 9.2 Error Handling DON'Ts

```typescript
// ❌ BAD: Catching and re-throwing without reason
try {
  await db.insert(chat).values(newChat);
} catch (error) {
  throw error;  // Pointless
}

// ❌ BAD: Swallowing errors silently
try {
  await db.insert(chat).values(newChat);
} catch (error) {
  console.error(error);
  // Returns undefined - caller doesn't know it failed
}

// ❌ BAD: Generic error messages
throw new Error("An error occurred");  // Not helpful

// ✅ GOOD: Descriptive error messages
throw new Error(`Chat not found: ${chatId}`);
throw new Error("Failed to update chat: database constraint violation");
```

---

## 10. Schema Design

### 10.1 Table Definition Pattern

```typescript
// src/server/db/schema.ts
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const chat = pgTable(
  "chat",
  {
    // Primary key: text with nanoid
    id: text("id").primaryKey(),

    // Foreign key with cascade delete
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Optional foreign key
    folderId: text("folder_id").references(() => folder.id, {
      onDelete: "set null",
    }),

    // Required fields
    title: text("title").notNull(),
    modelId: text("model_id").notNull(),

    // Optional fields
    pinned: boolean("pinned").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Index foreign keys
    index("chat_user_idx").on(table.userId),
    index("chat_folder_idx").on(table.folderId),

    // Composite index for common queries
    index("chat_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);
```

### 10.2 Relations Definition

```typescript
export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
  folder: one(folder, {
    fields: [chat.folderId],
    references: [folder.id],
  }),
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),
  parts: many(messagePart),
}));
```

### 10.3 Index Guidelines

```typescript
// ✅ GOOD: Index foreign keys
index("chat_user_idx").on(table.userId)

// ✅ GOOD: Composite index for query patterns
index("chat_user_updated_idx").on(table.userId, table.updatedAt)

// ✅ GOOD: Unique constraint
unique("api_key_user_unique").on(table.userId)

// ❌ BAD: Index on primary key (already indexed)
index("chat_id_idx").on(table.id)

// ❌ BAD: Too many indexes (hurts write performance)
// Only index columns actually used in WHERE clauses
```

### 10.4 Timestamp Configuration

```typescript
// ✅ GOOD: Timestamps with timezone
createdAt: timestamp("created_at", {
  withTimezone: true,
  mode: "date",
}).defaultNow().notNull(),

updatedAt: timestamp("updated_at", {
  withTimezone: true,
  mode: "date",
}).defaultNow().$onUpdate(() => new Date()).notNull(),

// ❌ BAD: Timestamps without timezone
createdAt: timestamp("created_at").defaultNow()
```

---

## 11. Security Checklist

### Pre-Merge Validation

Every server action MUST be validated against this checklist:

- [ ] **User Isolation**: All queries filter by `context.user.id`
- [ ] **Authentication**: Uses appropriate middleware (`authMiddleware` or `protectedMiddleware`)
- [ ] **Input Validation**: Uses Zod schema in `.inputValidator()`
- [ ] **No Module Singletons**: No module-level `db`, `auth`, or other instances
- [ ] **Context Access**: Uses `context.config.db` not imported `db`
- [ ] **ID Generation**: Uses `nanoid()` for all IDs
- [ ] **Ownership Checks**: UPDATE/DELETE include user ownership in WHERE clause
- [ ] **Error Messages**: No sensitive data in error messages
- [ ] **No Secrets in Response**: API keys, tokens not returned to client

### Example Security Review

```typescript
// ❌ SECURITY VIOLATION: No user filter
await db.delete(chat).where(eq(chat.id, chatId));

// ✅ SECURE: Includes user ownership
await db.delete(chat).where(
  and(eq(chat.id, chatId), eq(chat.userId, context.user.id))
);

// ❌ SECURITY VIOLATION: Returns sensitive data
return { user: context.user, apiKey: decryptedKey };

// ✅ SECURE: Only returns necessary data
return { user: { id: context.user.id, name: context.user.name } };
```

---

## 12. Anti-Patterns Reference

### 12.1 Module-Level Instances

```typescript
// ❌ ANTI-PATTERN: Module-level database
const db = createDb();
export { db };

// ❌ ANTI-PATTERN: Module-level auth
const auth = getAuth(db);
export { auth };

// ✅ CORRECT: Factory functions
export const loadConfig = createServerOnlyFn(() => {
  const db = createDb();
  const auth = getAuth(db);
  return { db, auth };
});
```

### 12.2 Redundant Middleware

```typescript
// ❌ ANTI-PATTERN: Redundant middleware array
.middleware([globalMiddleware, authMiddleware, protectedMiddleware])

// ✅ CORRECT: Just use the leaf middleware
.middleware([protectedMiddleware])
```

### 12.3 Redundant User Checks

```typescript
// ❌ ANTI-PATTERN: Manual check after protectedMiddleware
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.id) {
      throw new Error("User not found");  // NEVER REACHED
    }
  });

// ✅ CORRECT: Trust the middleware
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    // context.user is guaranteed by protectedMiddleware
    const userId = context.user.id;
  });
```

### 12.4 Inline Type Validation

```typescript
// ❌ ANTI-PATTERN: Inline type (no runtime validation)
.inputValidator((data: { name: string }) => data)

// ✅ CORRECT: Zod schema
.inputValidator(z.object({ name: z.string().min(1) }))
```

### 12.5 Missing User Filter

```typescript
// ❌ ANTI-PATTERN: No user filter (security vulnerability)
await db.select().from(chat).where(eq(chat.id, chatId));

// ✅ CORRECT: Always include user filter
await db.select().from(chat).where(
  and(eq(chat.id, chatId), eq(chat.userId, context.user.id))
);
```

### 12.6 Sequential Updates

```typescript
// ❌ ANTI-PATTERN: N queries for N items
for (const id of folderIds) {
  await db.update(folder).set({ order: i }).where(eq(folder.id, id));
}

// ✅ CORRECT: Batch operation (when possible)
await db.transaction(async (tx) => {
  for (let i = 0; i < folderIds.length; i++) {
    await tx.update(folder)
      .set({ order: i })
      .where(and(eq(folder.id, folderIds[i]), eq(folder.userId, userId)));
  }
});
```

### 12.7 Missing Transactions

```typescript
// ❌ ANTI-PATTERN: Related inserts without transaction
await db.insert(chat).values(newChat);
await db.insert(message).values(newMessage);  // Chat orphaned if this fails

// ✅ CORRECT: Atomic transaction
await db.transaction(async (tx) => {
  const [chat] = await tx.insert(chatTable).values(newChat).returning();
  await tx.insert(messageTable).values({ ...newMessage, chatId: chat.id });
});
```

---

## 13. Sources & References

### Official Documentation

| Resource | URL |
|----------|-----|
| TanStack Start Server Functions | https://tanstack.com/start/latest/docs/framework/react/guide/server-functions |
| TanStack Start Middleware | https://tanstack.com/start/latest/docs/framework/react/guide/middleware |
| Drizzle ORM Queries | https://orm.drizzle.team/docs/rqb |
| Drizzle ORM Transactions | https://orm.drizzle.team/docs/transactions |
| Better Auth TanStack Integration | https://www.better-auth.com/docs/integrations/tanstack |
| Zod Documentation | https://zod.dev/basics |
| postgres-js | https://github.com/porsager/postgres |

### Cloudflare Workers

| Resource | URL |
|----------|-----|
| Cloudflare Workers PostgreSQL | https://developers.cloudflare.com/workers/tutorials/postgres/ |
| TanStack Start on Cloudflare | https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/ |

### Community Resources

| Resource | URL |
|----------|-----|
| TanStack Start Middleware Guide | https://frontendmasters.com/blog/introducing-tanstack-start-middleware/ |
| Drizzle PostgreSQL Best Practices | https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717 |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-01-26 | Initial version from Phase 1 research | AI Agent |
