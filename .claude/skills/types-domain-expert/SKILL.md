---
name: types-domain-expert
description: Types domain expert for code review and validation. Use this skill when reviewing pull requests that touch src/types/, when analyzing type definitions across the codebase, when detecting cross-domain type violations (types exported from wrong domain), or when a senior AI agent needs to validate code against Types domain best practices. Provides automated violation detection and actionable PR comments.
---

# Types Domain Expert

Expert reviewer for the Types domain (`src/types/`). Validates code against documented best practices and detects violations for pull request reviews.

## When This Skill Activates

- PR touches files in `src/types/`
- PR adds/modifies type exports in any domain
- PR adds imports from `@/types` or `@/client/db/schema` or `@/server/db/schema`
- Senior agent requests types domain validation
- Code review needs type organization assessment

## Review Workflow

### Step 1: Run Automated Detection

Execute the violation detection script on changed files:

```bash
# For specific files (PR review)
scripts/detect_violations.sh --files <file1> <file2> --format pr

# For full codebase scan
scripts/detect_violations.sh --all --format pr

# Human-readable output
scripts/detect_violations.sh --all --format text
```

The script detects these violations automatically:
- **T001**: Missing `import type` for type imports
- **T002**: Direct file import instead of barrel (`@/types/models` vs `@/types`)
- **T003**: Components importing from schema directly
- **T004**: Missing `DB_` prefix for database types
- **T005**: Type exports in route files
- **T007**: Runtime code in types domain
- **T008**: Default exports (should be named)

### Step 2: Cross-Domain Analysis (Manual)

Check for types that should move to `src/types/`:

1. Find exported types in non-types domains:
   ```bash
   grep -rn "^export \(type\|interface\)" src/server src/client src/components --include="*.ts" --include="*.tsx"
   ```

2. For each exported type, count imports across domains:
   ```bash
   grep -rn "TypeName" src/ --include="*.ts" --include="*.tsx" | grep -v "^src/types"
   ```

3. Flag if type is imported in **3+ files** OR **2+ different domains**

### Step 3: Generate PR Comments

The `--format pr` output provides JSON ready for PR comments:

```json
{
  "summary": "Found 3 types domain violations",
  "comments": [
    {
      "path": "server/actions/chat.ts",
      "line": 42,
      "severity": "error",
      "body": "**T001: Missing import type**\n\n..."
    }
  ]
}
```

## Quick Reference: Type Placement

| Condition | Location |
|-----------|----------|
| Used by 3+ domains | `src/types/` |
| Core entity (Chat, Message, User, Model) | `src/types/` |
| Zod schema inference | Co-locate with schema |
| Component props | Component file |
| Hook options | Hook file |

## Quick Reference: Naming

| Category | Pattern | Example |
|----------|---------|---------|
| Database select | `DB_` prefix | `DB_Chat` |
| Database insert | `InsertDB_` prefix | `InsertDB_Chat` |
| Extended external | `Custom` prefix | `CustomUIMessage` |
| ID aliases | `Id` suffix | `ChatId` |
| Input types | `Input` suffix | `SaveMessagesInput` |

## Quick Reference: Imports

```typescript
// ✅ CORRECT
import type { CustomUIMessage, DB_Chat } from "@/types";

// ❌ WRONG: Missing 'type'
import { CustomUIMessage } from "@/types";

// ❌ WRONG: Direct file import
import type { Model } from "@/types/models";

// ❌ WRONG: Component importing from schema
import type { DB_Chat } from "@/client/db/schema";
```

## Detailed Documentation

For full rules, examples, and rationale:
- [references/best-practices.md](references/best-practices.md) - Complete best practices guide
- [docs/architecture/domains/types.md](docs/architecture/domains/types.md) - Source documentation
