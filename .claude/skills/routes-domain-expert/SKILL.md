---
name: routes-domain-expert
description: Routes domain expert for code review and validation. Use this skill when reviewing pull requests that touch src/routes/, when analyzing route definitions, loaders, beforeLoad guards, or API handlers, when detecting routes domain violations (redundant auth checks, improper data loading, dead code), or when a senior AI agent needs to validate code against Routes domain best practices. Provides automated violation detection and actionable PR comments.
---

# Routes Domain Expert

Expert reviewer for the Routes domain (`src/routes/`). Validates code against documented best practices and detects violations for pull request reviews.

## When This Skill Activates

- PR touches files in `src/routes/`
- PR adds/modifies route definitions (`createFileRoute`)
- PR adds/modifies loaders, beforeLoad, or API handlers
- PR adds auth guards or redirects in routes
- Senior agent requests routes domain validation
- Code review needs routing pattern assessment

## Review Workflow

### Step 1: Run Automated Detection

Execute the violation detection script on changed files:

```bash
# From repo root
bash .claude/skills/routes-domain-expert/scripts/detect_violations.sh [path-to-repo]

# Default: current directory
bash .claude/skills/routes-domain-expert/scripts/detect_violations.sh
```

The script detects these violations automatically:

| Code | Severity | Description |
|------|----------|-------------|
| R001 | critical | Secrets/env vars accessed directly in loader (isomorphic exposure) |
| R002 | error | Auth check in child route when parent layout handles it |
| R003 | error | Both beforeLoad AND loader doing auth (redundant) |
| R004 | error | `notFound()` called in beforeLoad (should be in loader) |
| R005 | warning | Inconsistent component naming (should be `RouteComponent`) |
| R006 | warning | Console.log in API route handlers |
| R007 | warning | Dead code - component that never renders |
| R008 | warning | Unused loader data returned but never accessed |

### Step 2: Domain-Specific Checks (Manual)

#### Auth Guard Placement

Verify auth guards are in layout routes only:

```bash
# Find all beforeLoad with redirect in child routes (potential violation)
grep -rn "beforeLoad" src/routes/dashboard/ --include="*.tsx" -A 10 | grep -B 5 "redirect"

# Should only find auth guards in src/routes/dashboard.tsx, not children
```

#### QueryClient Usage

Check if queryClient is used appropriately (optional per-route):

```bash
# Find routes using queryClient
grep -rn "context.queryClient" src/routes/ --include="*.tsx"

# Find routes with loaders NOT using queryClient (valid for non-cached data)
grep -rn "loader:" src/routes/ --include="*.tsx" | grep -v queryClient
```

### Step 3: Generate PR Comments

Script outputs JSON for PR comments:

```json
{
  "violations": [
    {
      "severity": "error",
      "rule": "R002",
      "file": "src/routes/dashboard/models.tsx",
      "line": 28,
      "message": "Redundant auth check - parent layout already handles authentication",
      "suggestion": "Remove auth check, trust parent dashboard.tsx beforeLoad guard"
    }
  ]
}
```

## Quick Reference: Route Types

| Type | File Pattern | Has beforeLoad | Has loader | Has Outlet |
|------|--------------|----------------|------------|------------|
| Layout | `dashboard.tsx` | Yes (auth) | Optional | Yes |
| Page | `dashboard/index.tsx` | No | Optional | No |
| API | `api/*.ts` | No | No | No |

## Quick Reference: Auth Pattern

```
/dashboard.tsx        ← Auth guard HERE only (beforeLoad)
  /dashboard/         ← Inherits (no guard)
  /dashboard/new      ← Inherits (no guard)
  /dashboard/c/$id    ← Inherits (no guard)
```

## Quick Reference: Data Loading

| Scenario | Use queryClient | Pattern |
|----------|-----------------|---------|
| Cacheable data | Yes | `context.queryClient.ensureQueryData()` |
| One-off checks | No | Direct server action call |
| Multiple queries | Yes | `Promise.all([...])` with queryClient |

## Quick Reference: Component Naming

```typescript
// ✅ CORRECT - Always use RouteComponent
function RouteComponent() { }

// ❌ WRONG - Descriptive names
function SettingsView() { }
function App() { }
```

## Quick Reference: beforeLoad vs loader

| Aspect | beforeLoad | loader |
|--------|------------|--------|
| Use for | Auth guards only | Data fetching |
| Execution | Serial (blocks ALL) | Parallel |
| notFound() | Never use here | Safe to use |
| Returns | Context for children | Loader data |

## Detailed Documentation

For full rules, examples, and rationale:
- [references/best-practices.md](references/best-practices.md) - Complete best practices guide
- [docs/architecture/domains/routes.md](/docs/architecture/domains/routes.md) - Source documentation
