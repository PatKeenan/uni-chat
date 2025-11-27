---
name: server-domain-expert
description: Server domain expert for code review and validation. Use this skill when reviewing pull requests that touch src/server/, when analyzing server functions, middleware, database queries, or authentication code, when detecting Cloudflare Workers compatibility issues, or when a senior AI agent needs to validate code against Server domain best practices. Provides automated violation detection and actionable PR comments.
---

# Server Domain Expert

Expert reviewer for the Server domain (`src/server/`). Validates code against documented best practices and detects violations for pull request reviews.

## When This Skill Activates

- PR touches files in `src/server/`
- PR adds/modifies server functions (`createServerFn`)
- PR adds/modifies middleware (`createMiddleware`)
- PR adds/modifies database queries or schema
- PR touches authentication code
- Senior agent requests server domain validation
- Code review needs Cloudflare Workers compatibility assessment

## Review Workflow

### Step 1: Run Automated Detection

Execute the violation detection script on changed files:

```bash
# For specific files (PR review)
bash .claude/skills/server-domain-expert/scripts/detect_violations.sh --files <file1> <file2> --format pr

# For full server domain scan
bash .claude/skills/server-domain-expert/scripts/detect_violations.sh --all --format pr

# Human-readable output
bash .claude/skills/server-domain-expert/scripts/detect_violations.sh --all --format text
```

The script detects these violations automatically:

| Rule | Severity | Description |
|------|----------|-------------|
| S001 | error | Module-level database/auth instance |
| S002 | error | Missing user ownership filter in query |
| S003 | warning | Redundant middleware array |
| S004 | warning | Redundant user check after protectedMiddleware |
| S005 | error | Inline type validation (not Zod) |
| S006 | warning | Missing input validation |
| S007 | error | Direct db/auth import (not via context) |
| S008 | warning | Missing transaction for multi-insert |
| S009 | error | createServerFn not assigned to variable |

### Step 2: Security Review (Manual)

Check for security-critical patterns:

1. **User Isolation**: Every query filters by `context.user.id`
   ```bash
   # Find queries without user filter
   grep -n "\.where(" src/server/actions/*.ts | grep -v "userId\|user\.id\|context\.user"
   ```

2. **Ownership in Updates/Deletes**:
   ```bash
   # Find update/delete without user check
   grep -n "\.update\|\.delete" src/server/actions/*.ts | grep -v "and("
   ```

3. **No Secrets in Response**:
   ```bash
   # Check return statements for sensitive fields
   grep -n "return {" src/server/actions/*.ts | grep -i "key\|secret\|password\|token"
   ```

### Step 3: Generate PR Comments

The `--format pr` output provides JSON ready for PR comments:

```json
{
  "summary": "Found 3 server domain violations",
  "comments": [
    {
      "path": "server/actions/chat.ts",
      "line": 12,
      "severity": "error",
      "body": "**S001: Module-level instance**\n\n..."
    }
  ]
}
```

## Quick Reference: Server Function Pattern

```typescript
// Define schema at module level
const CreateChatSchema = z.object({
  modelId: z.string(),
  folderId: z.string().optional(),
});

export type CreateChatInput = z.infer<typeof CreateChatSchema>;

// Canonical server function
export const createChat = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(CreateChatSchema)
  .handler(async ({ context, data }) => {
    const { db } = context.config;
    // ... implementation
  });
```

## Quick Reference: Middleware Selection

| Middleware | Use Case | Context |
|------------|----------|---------|
| None | Public endpoints | - |
| `authMiddleware` | Optional auth | `user?` (nullable) |
| `protectedMiddleware` | Required auth | `user!` (guaranteed) |

## Quick Reference: Database Queries

```typescript
// ALWAYS include user filter
await db.select().from(chat).where(
  and(eq(chat.id, chatId), eq(chat.userId, context.user.id))
);

// ALWAYS use and() for update/delete ownership
await db.delete(chat).where(
  and(eq(chat.id, chatId), eq(chat.userId, context.user.id))
);
```

## Quick Reference: Validation

```typescript
// CORRECT: Zod schema
.inputValidator(z.object({ chatId: z.string() }))

// WRONG: Inline type (no runtime validation)
.inputValidator((data: { chatId: string }) => data)
```

## Detailed Documentation

For full rules, examples, and rationale:
- [references/best-practices.md](references/best-practices.md) - Complete best practices guide
- [docs/architecture/domains/server.md](/docs/architecture/domains/server.md) - Source documentation
