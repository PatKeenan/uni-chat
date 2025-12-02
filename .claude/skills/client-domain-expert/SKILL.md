---
name: client-domain-expert
description: Client domain expert for code review and validation. Use this skill when reviewing pull requests that touch src/client/, when analyzing TanStack Query hooks, Zustand stores, PGlite database operations, or client actions, when detecting client domain violations (missing query guards, derived state in stores, improper db access), or when a senior AI agent needs to validate code against Client domain best practices. Provides automated violation detection and actionable PR comments.
---

# Client Domain Expert

Expert reviewer for the Client domain (`src/client/`). Validates code against documented best practices and detects violations for pull request reviews.

## When This Skill Activates

- PR touches files in `src/client/`
- PR adds/modifies TanStack Query hooks or mutations
- PR adds/modifies Zustand stores
- PR adds/modifies PGlite database operations
- PR adds imports from `@/client/*`
- Senior agent requests client domain validation
- Code review needs client-side patterns assessment

## Review Workflow

### Step 1: Run Automated Detection

Execute the violation detection script on changed files:

```bash
# For specific files (PR review)
bash .claude/skills/client-domain-expert/scripts/detect_violations.sh --files <file1> <file2> --format pr

# For full codebase scan
bash .claude/skills/client-domain-expert/scripts/detect_violations.sh --all --format pr

# Human-readable output
bash .claude/skills/client-domain-expert/scripts/detect_violations.sh --all --format text
```

The script detects these violations automatically:
- **C001**: Query hook missing `enabled` guard
- **C002**: Query key missing userId (user isolation)
- **C003**: Direct database instance (not using getClientDb)
- **C004**: Store destructure without selector
- **C005**: Derived state stored in Zustand
- **C006**: Missing SSR guard for localStorage
- **C007**: Server import in client domain
- **C008**: Default export (should be named)
- **C009**: Missing userId filter in database query

### Step 2: Manual Pattern Verification

Check for patterns the script cannot detect:

1. **Optimistic updates completeness** - If mutation uses `onMutate`:
   ```bash
   grep -n "onMutate" src/client/hooks/*.ts
   ```
   Verify all three phases present: `onMutate`, `onError`, `onSettled`

2. **Query key/queryFn param alignment**:
   - Query key params must match queryFn params
   - If filters in queryFn, must be in queryKey

3. **Cross-domain type leakage**:
   ```bash
   grep -rn "export type\|export interface" src/client/ --include="*.ts"
   ```
   Flag if type should be in `src/types/`

### Step 3: Generate PR Comments

The `--format pr` output provides JSON ready for PR comments:

```json
{
  "summary": "Found 3 client domain violations",
  "comments": [
    {
      "path": "client/hooks/use-feature.ts",
      "line": 42,
      "severity": "error",
      "body": "**C001: Query missing enabled guard**\n\n..."
    }
  ]
}
```

## Quick Reference: Query Patterns

| Pattern | Required |
|---------|----------|
| Query key factory | Yes - hierarchical with userId |
| `enabled` option | Yes - guard against null params |
| Key params match queryFn | Yes - for cache consistency |
| Mutation invalidation | Yes - in onSuccess or onSettled |

## Quick Reference: Zustand Patterns

| Pattern | Required |
|---------|----------|
| Selector access | Yes - `useStore(s => s.field)` |
| Separate State/Actions | Yes - two interfaces |
| Derived state | No - compute in hooks |
| Form state | No - use local state |

## Quick Reference: Database Patterns

| Pattern | Required |
|---------|----------|
| `await getClientDb()` | Yes - always |
| userId filter | Yes - all queries |
| `nanoid()` for IDs | Yes |
| Manual timestamps | Yes - `new Date()` |

## Quick Reference: Imports

```typescript
// ✅ CORRECT
import { getClientDb } from "@/client/db";
import { useFeatureStore } from "@/client/stores/feature-store";
const input = useFeatureStore((state) => state.input);

// ❌ WRONG: Server import in client
import { db } from "@/server/db";

// ❌ WRONG: Direct PGlite instance
const db = new PGlite("idb://my-db");

// ❌ WRONG: Store destructure
const { input } = useFeatureStore();
```

## Quick Reference: Key Packages

| Package | Version | Pattern |
|---------|---------|---------|
| `@tanstack/react-query` | v5 | Query key factories, enabled guards |
| `zustand` | v5 | Selectors, separate interfaces |
| `@electric-sql/pglite` | v0.3 | Singleton via getClientDb() |
| `better-auth/react` | v1 | Single createAuthClient instance |

## Detailed Documentation

For full rules, examples, and rationale:
- [references/best-practices.md](references/best-practices.md) - Complete best practices guide
- [docs/architecture/domains/client.md](../../../../docs/architecture/domains/client.md) - Source documentation
