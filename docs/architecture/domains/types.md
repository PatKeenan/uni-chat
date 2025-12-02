# Types Domain Best Practices Guide

> **Domain**: `src/types/`
> **Purpose**: Shared TypeScript type definitions used across multiple domains
> **Role**: Shared Kernel for cross-domain type contracts

This guide is the authoritative reference for the Types domain. It defines coding standards, patterns, and anti-patterns that must be followed. Use this guide for code reviews, PR validation, and ensuring consistency across the codebase.

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [When Types Belong Here](#2-when-types-belong-here)
3. [Type Definition Patterns](#3-type-definition-patterns)
4. [Import and Export Patterns](#4-import-and-export-patterns)
5. [Naming Conventions](#5-naming-conventions)
6. [External Library Types](#6-external-library-types)
7. [Type Derivation Patterns](#7-type-derivation-patterns)
8. [Circular Dependency Prevention](#8-circular-dependency-prevention)
9. [Cross-Domain Violation Detection](#9-cross-domain-violation-detection)
10. [File Organization](#10-file-organization)
11. [Checklist for PR Reviews](#11-checklist-for-pr-reviews)
12. [References](#12-references)

---

## 1. Domain Overview

### Purpose

The Types domain (`src/types/`) serves as the **Shared Kernel** - a centralized location for type definitions that are used across multiple domains. This follows Domain-Driven Design principles where shared concepts live in a dedicated bounded context.

### Current Structure

```
src/types/
├── index.ts     # Barrel export (single entry point)
├── models.ts    # Model, message, and DB type definitions
└── [future].ts  # Additional type files as needed
```

### What This Domain Contains

- Cross-domain entity types (Chat, Message, User references)
- Extended external library types (CustomUIMessage)
- Type aliases for commonly used patterns (ChatId, UserId)
- Re-exports of database types for cross-domain access

### What This Domain Does NOT Contain

- Zod validation schemas (live with their actions)
- Component prop interfaces (live with components)
- Domain-specific internal types (stay in their domain)
- Runtime code (types only, no values)

---

## 2. When Types Belong Here

### Decision Framework

Use this flowchart to determine where a type should live:

```
Is this type used by 3+ domains?
├─ YES → Put in src/types/
│
└─ NO → Is it a core domain entity (Chat, Message, User, Model)?
        ├─ YES → Put in src/types/ (even if currently used by 1-2 domains)
        │
        └─ NO → Is it an integration contract (API request/response)?
                ├─ YES → Put in src/types/
                │
                └─ NO → Keep in the domain that defines it
```

### Domain Count Rules

| Usage Pattern | Location | Rationale |
|--------------|----------|-----------|
| Used in 1 domain | Stay in that domain | No sharing needed |
| Used in 2 domains | Evaluate case-by-case | May indicate future sharing |
| Used in 3+ domains | **Must be in `src/types/`** | Clear cross-cutting concern |

### Examples by Type Category

| Type | Correct Location | Why |
|------|-----------------|-----|
| `CustomUIMessage` | `src/types/` | Used by client hooks, components, routes |
| `DB_Chat`, `DB_Message` | `src/types/` (re-exported) | Core entities, cross-domain |
| `Model`, `ModelName` | `src/types/` | Used across client, server, components |
| `SaveLocalMessagesInput` | `src/client/actions/` | Action-specific, co-located with Zod schema |
| `ChatInputProps` | `src/components/chat/` | Component-specific |
| `ServerContext` | `src/server/middleware/` | Server implementation detail |

---

## 3. Type Definition Patterns

### Rule 3.1: Use `interface` for Object Shapes

**Rationale**: Interfaces provide better error messages, IDE support, and can be extended/implemented.

```typescript
// ✅ GOOD: Interface for object shape
export interface Chat {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
}

// ❌ BAD: Type alias for simple object shape
export type Chat = {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
};
```

**Source**: [TypeScript Handbook - Types vs Interfaces](https://www.typescriptlang.org/play/typescript/language-extensions/types-vs-interfaces.ts.html)

### Rule 3.2: Use `type` for Unions, Intersections, and Utilities

**Rationale**: These constructs require `type` syntax and benefit from its flexibility.

```typescript
// ✅ GOOD: Type for union
export type MessageRole = "user" | "assistant" | "system";

// ✅ GOOD: Type for discriminated union
export type MessagePart = TextPart | ToolCallPart | ToolResultPart;

// ✅ GOOD: Type for intersection
export type ExtendedChat = Chat & { metadata: Record<string, unknown> };

// ✅ GOOD: Type for mapped/utility types
export type PartialChat = Partial<Chat>;
export type ChatUpdate = Pick<Chat, "id" | "title">;

// ❌ BAD: Interface for union (not possible, but attempted workarounds are wrong)
export interface MessageRole {} // Cannot represent "user" | "assistant"
```

### Rule 3.3: Use `type` for Function Signatures

```typescript
// ✅ GOOD: Type for function signature
export type ChatHandler = (message: Message) => Promise<void>;
export type MessageTransformer = (msg: DB_Message) => CustomUIMessage;

// ❌ BAD: Interface for function (works but unconventional)
export interface ChatHandler {
  (message: Message): Promise<void>;
}
```

### Rule 3.4: Use `type` for Derived/Inferred Types

```typescript
// ✅ GOOD: Type for derivation
type Models = Awaited<ReturnType<typeof getOpenRouterModels>>["data"];
type Model = Models[number];
type ModelName = Model["canonicalSlug"];

// ✅ GOOD: Type for Zod inference
type SaveInput = z.infer<typeof SaveSchema>;

// ❌ BAD: Interface cannot be used for derivation
interface Models extends Awaited<ReturnType<typeof fn>> {} // Syntax error
```

---

## 4. Import and Export Patterns

### Rule 4.1: Always Use `import type` for Type-Only Imports

**Rationale**: Prevents runtime dependencies and circular import issues.

```typescript
// ✅ GOOD: Type-only import
import type { Chat, Message } from "@/types";
import type { User } from "better-auth";

// ❌ BAD: Regular import for types
import { Chat, Message } from "@/types";
import { User } from "better-auth";
```

**Source**: [TypeScript Handbook - Type-Only Imports](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)

### Rule 4.2: Import from Barrel (`@/types`), Not Direct Files

**Rationale**: Consistent import paths, single entry point, easier refactoring.

```typescript
// ✅ GOOD: Import from barrel
import type { CustomUIMessage, DB_Chat, Model } from "@/types";

// ❌ BAD: Import from specific file
import type { CustomUIMessage } from "@/types/models";
import type { Model } from "@/types/models";

// ❌ BAD: Import DB types from source when available in @/types
import type { DB_Chat } from "@/client/db/schema";
// (Only acceptable if you also need the table object for queries)
```

**Exception**: When you need both the type AND the runtime table object:

```typescript
// ✅ ACCEPTABLE: Need table for queries + type
import { chat } from "@/client/db/schema";
import type { DB_Chat } from "@/types";

// Or use typeof inline
const result: typeof chat.$inferSelect = await db.query.chat.findFirst();
```

### Rule 4.3: Use Named Type Exports

**Rationale**: Explicit control over public API, better tree-shaking, consistent codebase style.

```typescript
// ✅ GOOD: Named type exports
export type {
  ChatId,
  UserId,
  Model,
  ModelName,
  CustomUIMessage,
};

// ✅ GOOD: Inline named export
export type MessageRole = "user" | "assistant" | "system";

// ❌ BAD: Default export (never use in this codebase)
export default interface Chat {}
```

### Rule 4.4: Barrel File Pattern for Types Domain Only

**Rationale**: Barrel files cause performance/circular dependency issues in application code, but are appropriate for type libraries.

```typescript
// ✅ GOOD: Single barrel in src/types/index.ts
export * from "./models";
export * from "./chat";  // Only if file exists and has exports

// ❌ BAD: Nested barrels in application domains
// src/components/chat/index.ts - DON'T CREATE THESE
export * from "./chat-message";
export * from "./chat-input";
```

**Source**: [TkDodo - Please Stop Using Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files)

---

## 5. Naming Conventions

### Rule 5.1: Database Type Prefix

**Pattern**: `DB_` prefix for Drizzle-inferred types

```typescript
// ✅ GOOD: DB_ prefix for database types
export type DB_Chat = typeof chat.$inferSelect;
export type DB_Message = typeof message.$inferSelect;
export type DB_Folder = typeof folder.$inferSelect;

// ✅ GOOD: InsertDB_ for insert types
export type InsertDB_Chat = typeof chat.$inferInsert;

// ❌ BAD: No prefix (ambiguous origin)
export type Chat = typeof chat.$inferSelect;

// ❌ BAD: Different prefix style
export type ChatRecord = typeof chat.$inferSelect;
export type ChatEntity = typeof chat.$inferSelect;
```

### Rule 5.2: Custom External Type Prefix

**Pattern**: `Custom` prefix for extended external library types

```typescript
// ✅ GOOD: Custom prefix for extended types
export type CustomUIMessage = UIMessage<CustomUIMessageData, CustomUIMessagePart, UITools>;
export type CustomUIMessageData = { modelName?: ModelName; supportsToolCalls?: boolean };
export type CustomUIMessagePart = UIMessagePart<UIDataTypes, UITools>;

// ❌ BAD: No indication it's a custom extension
export type AppMessage = UIMessage<...>;
export type ExtendedMessage = UIMessage<...>;

// ❌ BAD: Shadowing the original name
export type UIMessage = OriginalUIMessage<...>; // Confusing!
```

### Rule 5.3: ID Type Suffix

**Pattern**: `Id` suffix for identifier type aliases

```typescript
// ✅ GOOD: Id suffix for identifier types
export type ChatId = DB_Chat["id"];
export type UserId = User["id"];
export type MessageId = DB_Message["id"];

// ❌ BAD: No suffix (unclear it's an ID type)
export type Chat = DB_Chat["id"];

// ❌ BAD: Inconsistent suffix
export type ChatID = DB_Chat["id"];  // Use "Id" not "ID"
export type ChatIdentifier = DB_Chat["id"];
```

### Rule 5.4: Input/Output Type Suffix

**Pattern**: `Input` suffix for function input types, `Output` or `Result` for outputs

```typescript
// ✅ GOOD: Input suffix (typically with Zod schemas in action files)
export type SaveMessagesInput = z.infer<typeof SaveMessagesSchema>;
export type CreateChatInput = z.infer<typeof CreateChatSchema>;

// ✅ GOOD: Result suffix for operation results
export interface ClearDataResult {
  success: boolean;
  message: string;
  itemsDeleted?: number;
}

// ❌ BAD: No suffix (unclear purpose)
export type SaveMessages = z.infer<typeof SaveMessagesSchema>;

// ❌ BAD: Inconsistent suffixes
export type SaveMessagesParams = ...;
export type CreateChatArgs = ...;
export type DeleteChatOptions = ...;
```

### Naming Convention Summary Table

| Category | Prefix/Suffix | Example |
|----------|--------------|---------|
| Database select types | `DB_` prefix | `DB_Chat`, `DB_Message` |
| Database insert types | `InsertDB_` prefix | `InsertDB_Chat` |
| Extended external types | `Custom` prefix | `CustomUIMessage` |
| Identifier aliases | `Id` suffix | `ChatId`, `UserId` |
| Input types | `Input` suffix | `SaveMessagesInput` |
| Result types | `Result` suffix | `ClearDataResult` |
| Props interfaces | `Props` suffix | `ChatInputProps` |

---

## 6. External Library Types

### Rule 6.1: Import External Types Directly, Extend in Types Domain

**Rationale**: Keep external type imports explicit, centralize extensions.

```typescript
// ✅ GOOD: Import external, define custom extension
// src/types/models.ts
import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";
import type { User } from "better-auth";

// Extend with app-specific customization
type CustomUIMessageData = {
  modelName?: ModelName;
  supportsToolCalls?: boolean;
};

export type CustomUIMessage = UIMessage<
  CustomUIMessageData,
  UIMessagePart<UIDataTypes, UITools>,
  UITools
>;

// Re-export for convenience if used cross-domain
export type { User };
```

```typescript
// ❌ BAD: Re-implementing external types
// src/types/chat.ts
export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
}
// This duplicates @ai-sdk/react's UIMessage!
```

### Rule 6.2: Re-export Database Types Through Types Domain

**Rationale**: Single source of truth for cross-domain type imports.

```typescript
// ✅ GOOD: Re-export DB types from types domain
// src/types/models.ts
import type { DB_Chat, DB_Message, DB_Folder } from "@/client/db/schema";

export type {
  DB_Chat,
  DB_Message,
  DB_Folder,
};

// Consumer imports from @/types
import type { DB_Chat } from "@/types";
```

```typescript
// ❌ BAD: Components importing directly from client schema
// src/components/chat/chat-view.tsx
import type { DB_Chat } from "@/client/db/schema"; // Cross-domain violation!
```

### Rule 6.3: Don't Re-export Unstable/Internal Types

**Rationale**: Only re-export stable API types that won't break consumers.

```typescript
// ✅ GOOD: Re-export stable types
import type { User } from "better-auth";
export type { User };

// ❌ BAD: Re-exporting internal/unstable types
import type { InternalSessionState } from "better-auth/internal";
export type { InternalSessionState }; // May break in patch versions
```

---

## 7. Type Derivation Patterns

### Rule 7.1: Prefer Derivation Over Duplication

**Rationale**: Derived types stay in sync with source, reducing maintenance burden.

```typescript
// ✅ GOOD: Derive from source of truth
type Models = Awaited<ReturnType<typeof getOpenRouterModels>>["data"];
type Model = Models[number];
type ModelName = Model["canonicalSlug"];

// ❌ BAD: Manual type that can drift from implementation
interface Model {
  id: string;
  name: string;
  canonicalSlug: string;
  // ... 20 more fields that might get out of sync
}
```

### Rule 7.2: Use Standard Derivation Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `Awaited<ReturnType<typeof fn>>` | Async function returns | `Awaited<ReturnType<typeof fetchData>>` |
| `ReturnType<typeof fn>` | Sync function returns | `ReturnType<typeof createConfig>` |
| `Parameters<typeof fn>` | Function parameters | `Parameters<typeof handler>[0]` |
| `Type[number]` | Array element type | `Models[number]` |
| `Type["key"]` | Property type | `User["id"]` |
| `typeof table.$inferSelect` | Drizzle select type | `typeof chat.$inferSelect` |
| `typeof table.$inferInsert` | Drizzle insert type | `typeof chat.$inferInsert` |
| `z.infer<typeof schema>` | Zod schema type | `z.infer<typeof UserSchema>` |

### Rule 7.3: Chain Derivations Readably

```typescript
// ✅ GOOD: Step-by-step derivation with intermediate types
type GetModelsResponse = Awaited<ReturnType<typeof getOpenRouterModels>>;
type Models = GetModelsResponse["data"];
type Model = Models[number];
type ModelName = Model["canonicalSlug"];

// ✅ ACCEPTABLE: Inline for simple cases
type ModelName = Awaited<ReturnType<typeof getOpenRouterModels>>["data"][number]["canonicalSlug"];

// ❌ BAD: Overly complex inline derivation
type DeepType = Awaited<ReturnType<typeof getA>>["data"][number]["nested"]["items"][number]["value"];
// Break this into intermediate types!
```

### Rule 7.4: Document Non-Obvious Derivations

```typescript
// ✅ GOOD: Comment explaining derivation
/**
 * Single model from OpenRouter API response.
 * Derived from getOpenRouterModels server action return type.
 */
type Model = Models[number];

// ✅ GOOD: JSDoc for complex types
/**
 * Custom UI message with app-specific metadata.
 * Extends AI SDK's UIMessage with model info and capability flags.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message
 */
export type CustomUIMessage = UIMessage<CustomUIMessageData, CustomUIMessagePart, UITools>;
```

---

## 8. Circular Dependency Prevention

### Rule 8.1: Types Domain Should Not Import Runtime Code

**Rationale**: Types should be pure definitions, not dependent on implementation.

```typescript
// ✅ GOOD: Import type of function for derivation
import type { getOpenRouterModels } from "@/server/actions/model-actions";
type Models = Awaited<ReturnType<typeof getOpenRouterModels>>["data"];

// ⚠️ CAUTION: This creates a type-level dependency on server domain
// Consider if the type shape should be defined explicitly instead

// ❌ BAD: Import runtime value
import { getOpenRouterModels } from "@/server/actions/model-actions";
// Then use it at runtime - types domain should have NO runtime code
```

### Rule 8.2: Use `import type` to Break Circular Chains

**Rationale**: Type-only imports are erased at compile time, preventing runtime cycles.

```typescript
// ✅ GOOD: Type-only import prevents runtime cycle
// src/types/models.ts
import type { DB_Chat } from "@/client/db/schema";

// src/client/db/schema/client-only.ts
import type { CustomUIMessage } from "@/types";
// No runtime cycle - both are type-only!
```

```typescript
// ❌ BAD: Runtime imports can create cycles
// src/types/models.ts
import { chatTable } from "@/client/db/schema"; // Runtime import!

// src/client/db/schema/client-only.ts
import { CustomUIMessage } from "@/types"; // Runtime import!
// CYCLE: types → client/db → types
```

### Rule 8.3: Dependency Direction

Types domain should have this dependency flow:

```
External Libraries (ai, better-auth, drizzle)
         ↓
   src/types/ (Shared Kernel)
         ↓
src/client/, src/server/, src/components/, src/routes/
```

**Allowed imports INTO types domain:**
- External library types (`ai`, `better-auth`, etc.)
- Database schema types (`@/client/db/schema` - type-only)
- Server action types (`@/server/actions/*` - type-only, for ReturnType derivation)

**NOT allowed:**
- Component types
- Hook types
- Store types
- Any runtime code

---

## 9. Cross-Domain Violation Detection

This section helps identify when types are incorrectly placed in other domains.

### Violation Pattern 1: Type Exported from Wrong Domain

**Signal**: A type is defined in `src/server/`, `src/client/`, or `src/components/` but imported by multiple other domains.

```typescript
// 🚨 VIOLATION: Type in server domain used by client and components
// src/server/actions/chat-actions.ts
export type ChatResponse = { ... };

// src/client/hooks/use-chat.ts
import type { ChatResponse } from "@/server/actions/chat-actions"; // Cross-domain!

// src/components/chat/chat-view.tsx
import type { ChatResponse } from "@/server/actions/chat-actions"; // Cross-domain!

// ✅ FIX: Move to src/types/
// src/types/models.ts
export type ChatResponse = { ... };

// Then import from @/types everywhere
import type { ChatResponse } from "@/types";
```

### Violation Pattern 2: Duplicate Type Definitions

**Signal**: Same type shape defined in multiple files.

```typescript
// 🚨 VIOLATION: Same type defined twice
// src/client/hooks/use-chat.ts
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// src/components/chat/chat-message.tsx
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ✅ FIX: Define once in src/types/, import everywhere
// src/types/models.ts
export interface Message { ... }
```

### Violation Pattern 3: Component Importing from Client/Server Schema Directly

**Signal**: Components importing types from `@/client/db/schema` or `@/server/db/schema`.

```typescript
// 🚨 VIOLATION: Component importing from client schema
// src/components/chat/chat-list.tsx
import type { DB_Chat } from "@/client/db/schema";

// ✅ FIX: Import from @/types (which re-exports DB types)
import type { DB_Chat } from "@/types";
```

### Violation Pattern 4: Interface in Domain File Used 3+ Places

**Signal**: An interface exported from a domain file is imported in 3+ other files.

```typescript
// 🚨 VIOLATION: Interface should move to types domain
// src/client/stores/chat-store.ts
export interface ModelCapabilities {
  supportsToolCalls: boolean;
  supportsStreaming: boolean;
}

// Imported in: use-chat.ts, api/chat.ts, chat-header.tsx (3 places!)

// ✅ FIX: Move to src/types/
// src/types/models.ts
export interface ModelCapabilities { ... }
```

### Quick Detection Checklist

When reviewing a PR, check for:

| Check | Violation If True |
|-------|------------------|
| Type exported from `src/server/` imported by `src/client/` or `src/components/`? | Move to `src/types/` |
| Type exported from `src/client/` imported by `src/components/` (not hooks)? | Evaluate for `src/types/` |
| Same type interface in 2+ files? | Consolidate in `src/types/` |
| Type imported in 3+ files from non-types domain? | Move to `src/types/` |
| Component importing from `@/client/db/schema` or `@/server/db/schema`? | Import from `@/types` instead |
| `export interface` or `export type` in route file? | Move to appropriate domain |

---

## 10. File Organization

### Current Structure

```
src/types/
├── index.ts     # Barrel export - DO NOT add logic here
└── models.ts    # All current type definitions
```

### When to Create New Files

Create a new type file when:
- A logical grouping of 5+ related types emerges
- Types have different external dependencies
- Clear domain concept warrants separation (e.g., `api.ts` for API contracts)

```typescript
// ✅ GOOD: Logical grouping
src/types/
├── index.ts       # export * from "./models"; export * from "./api";
├── models.ts      # Domain entities, DB types
└── api.ts         # API request/response types (if needed)

// ❌ BAD: One type per file
src/types/
├── index.ts
├── chat.ts        # Just Chat type
├── message.ts     # Just Message type
├── user.ts        # Just UserId type
└── model.ts       # Just Model type
```

### Barrel File Rules

```typescript
// src/types/index.ts

// ✅ GOOD: Simple re-exports only
export * from "./models";

// ❌ BAD: Logic in barrel file
export * from "./models";
export const DEFAULT_MODEL = "gpt-4"; // No runtime code!

// ❌ BAD: Selective re-exports (makes API unclear)
export { Chat, Message } from "./models";
// Why are other types hidden?
```

---

## 11. Checklist for PR Reviews

Use this checklist when reviewing PRs that touch types or add new type definitions:

### Location Check

- [ ] Types used by 3+ domains are in `src/types/`
- [ ] Core domain entities (Chat, Message, User, Model) are in `src/types/`
- [ ] Component props stay in component files
- [ ] Zod schema types stay with their schemas
- [ ] No types exported from route files

### Pattern Check

- [ ] Object shapes use `interface`
- [ ] Unions/intersections use `type`
- [ ] Function signatures use `type`
- [ ] Derived types use `type`

### Naming Check

- [ ] Database types have `DB_` prefix
- [ ] Extended external types have `Custom` prefix
- [ ] ID types have `Id` suffix
- [ ] Input types have `Input` suffix

### Import Check

- [ ] All type imports use `import type`
- [ ] Cross-domain types imported from `@/types`, not `@/types/models`
- [ ] No components importing from `@/client/db/schema` for types
- [ ] No circular dependencies introduced

### Export Check

- [ ] Named exports only (no default exports)
- [ ] Types properly exported from barrel (`src/types/index.ts`)
- [ ] No runtime code in types domain

### Documentation Check

- [ ] Complex derived types have JSDoc comments
- [ ] Non-obvious type purposes are documented

---

## 12. References

### Official Documentation

- [TypeScript Handbook - Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript - Type vs Interface](https://www.typescriptlang.org/play/typescript/language-extensions/types-vs-interfaces.ts.html)
- [TypeScript - Type-Only Imports](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)
- [AI SDK - UIMessage Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message)
- [AI SDK - Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata)

### Style Guides

- [Microsoft TypeScript Coding Guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

### Best Practice Articles

- [TkDodo - Please Stop Using Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files)
- [Total TypeScript - Type vs Interface](https://www.totaltypescript.com/type-vs-interface-which-should-you-use)
- [Total TypeScript - satisfies Operator](https://www.totaltypescript.com/how-to-use-satisfies-operator)

### Domain-Driven Design

- [DevIQ - Shared Kernel](https://deviq.com/domain-driven-design/shared-kernel/)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2024-11-26 | Initial creation based on Phase 1 research | AI Agent |

