---
name: integrations-domain-expert
description: Integrations domain expert for code review and validation. Use this skill when reviewing pull requests that touch src/integrations/, when analyzing third-party API client implementations, when validating Vercel AI SDK tool definitions, when detecting domain violations (module-level instances, missing descriptions, debug logging), or when a senior AI agent needs to validate code against Integrations domain best practices. Provides automated violation detection and actionable PR comments.
---

# Integrations Domain Expert

Expert reviewer for the Integrations domain (`src/integrations/`). Validates code against documented best practices and detects violations for pull request reviews.

## When This Skill Activates

- PR touches files in `src/integrations/`
- PR adds/modifies third-party API client code
- PR adds/modifies Vercel AI SDK tool definitions
- Senior agent requests integrations domain validation
- Code review needs factory pattern or tool definition assessment

## Review Workflow

### Step 1: Run Automated Detection

Execute the violation detection script:

```bash
# Full scan
bash .claude/skills/integrations-domain-expert/scripts/detect_violations.sh .

# Output is JSON array with severity, file, line, message, suggestion
```

The script detects these violations automatically:
- **no-module-level-instances**: CRITICAL - SDK instantiation at module level
- **no-console-log**: ERROR - Debug logging in production
- **tool-must-have-description**: ERROR - Tool missing description field
- **zod-field-needs-describe**: WARNING - Schema field without `.describe()`
- **factory-naming-convention**: WARNING - `init*` instead of `create*`
- **no-default-exports**: WARNING - Default export instead of named
- **no-error-swallowing**: WARNING - Catch block returning null
- **tavily-max-results-too-low**: WARNING - maxResults < 5

### Step 2: Check Domain Affected

```bash
git diff --name-only origin/main...HEAD | grep "^src/integrations/"
```

Skip review if no matches.

### Step 3: Generate PR Comments

**For CRITICAL/ERROR** (request changes):
```
**[INTEGRATIONS]** :x: {rule}

{message}

**File**: `{file}:{line}`
**Fix**: {suggestion}
```

**For WARNING** (suggestion):
```
**[INTEGRATIONS]** :warning: {rule}

{message}

**File**: `{file}:{line}`
**Suggestion**: {suggestion}
```

### Step 4: Manual Checklist

After automated detection, verify:

- [ ] Factory functions accept `apiKey` parameter
- [ ] OpenRouter has HTTP-Referer and X-Title headers
- [ ] Environment variables defined (not undefined)
- [ ] Tool descriptions are specific and actionable
- [ ] Results transformed to essential fields only
- [ ] Types derived via `Awaited<ReturnType<...>>`

## Quick Reference: Core Rules

| Rule | Severity | Quick Check |
|------|----------|-------------|
| No module-level instances | CRITICAL | `const client = new SDK()` at top level |
| No console.log | ERROR | Any `console.log` in production |
| Tool must have description | ERROR | `tool({})` without description |
| Factory naming | WARNING | Use `create*` not `init*` |
| Zod .describe() | WARNING | All schema fields need it |

## Quick Reference: Packages

| Package | Key Requirement |
|---------|-----------------|
| `@openrouter/ai-sdk-provider` | HTTP-Referer + X-Title headers |
| `@openrouter/sdk` | Beta - pin version |
| `@tavily/core` | maxResults >= 5 |
| `ai` (tools) | Use tool() helper; throw errors |

## Detailed Documentation

For full rules, examples, and rationale:
- [references/best-practices.md](references/best-practices.md) - Complete best practices guide
- [docs/architecture/domains/integrations.md](docs/architecture/domains/integrations.md) - Source documentation
