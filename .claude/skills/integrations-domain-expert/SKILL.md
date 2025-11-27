---
name: integrations-domain-expert
description: |
  Integrations domain expert for code review and validation. Use this skill when:
  (1) Reviewing pull requests that touch src/integrations/
  (2) Analyzing third-party API client implementations
  (3) Validating tool definitions for Vercel AI SDK
  (4) Detecting domain violations like module-level instances, missing descriptions, or debug logging
  (5) A senior AI agent needs to validate code against Integrations domain best practices
  Provides automated violation detection and actionable PR comments.
---

# Integrations Domain Expert

Expert validator for the Integrations domain (`src/integrations/`). Detects violations, validates patterns, and provides PR review comments.

## Quick Reference

| Item | Value |
|------|-------|
| Domain Path | `src/integrations/` |
| Best Practices | `docs/architecture/domains/integrations.md` |
| Detection Script | `scripts/detect_violations.sh` |

## Violation Detection

Run automated detection:

```bash
bash .claude/skills/integrations-domain-expert/scripts/detect_violations.sh .
```

**Output**: JSON array of violations with severity, file, line, message, and suggestion.

**Exit Codes**: `0` = clean, `1` = violations found

### Detected Rules

| Rule | Severity | What It Catches |
|------|----------|-----------------|
| `no-module-level-instances` | CRITICAL | `const client = new SDK()` at module level |
| `no-console-log` | ERROR | `console.log` in production code |
| `tool-must-have-description` | ERROR | `tool({})` missing description field |
| `zod-field-needs-describe` | WARNING | `z.string()` without `.describe()` |
| `factory-naming-convention` | WARNING | `initTool` instead of `createTool` |
| `no-default-exports` | WARNING | `export default` |
| `no-error-swallowing` | WARNING | `catch { return null }` |
| `tavily-max-results-too-low` | WARNING | `maxResults: 2` (should be >= 5) |

## PR Review Workflow

### Step 1: Check Domain Affected

```bash
git diff --name-only origin/main...HEAD | grep "^src/integrations/"
```

Skip review if no matches.

### Step 2: Run Detection

```bash
bash .claude/skills/integrations-domain-expert/scripts/detect_violations.sh .
```

### Step 3: Format PR Comments

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

## Core Rules

### CRITICAL: No Module-Level Instances

```typescript
// BAD - Violates Cloudflare Workers isolation
const client = new OpenRouter({ apiKey: process.env.KEY });
export { client };

// GOOD - Per-request instantiation
export function createClient(apiKey: string) {
  return new OpenRouter({ apiKey });
}
```

### ERROR: No Console.log

```typescript
// BAD
console.log("response", response);

// GOOD - Remove entirely
```

### ERROR: Tool Must Have Description

```typescript
// BAD
tool({ inputSchema: z.object({...}), execute: async () => {} })

// GOOD
tool({
  description: "Search the web for current information",
  inputSchema: z.object({...}),
  execute: async () => {}
})
```

### WARNING: Factory Naming Convention

```typescript
// BAD
export function initWebSearchTool() {}

// GOOD
export function createWebSearchTool() {}
```

### WARNING: Zod Fields Need .describe()

```typescript
// BAD
z.string().min(1).max(100)

// GOOD
z.string().min(1).max(100).describe("The search query")
```

## Package Notes

| Package | Key Points |
|---------|------------|
| `@openrouter/ai-sdk-provider` | Configure HTTP-Referer + X-Title headers |
| `@openrouter/sdk` | Beta - pin version; new instance per call |
| `@tavily/core` | maxResults >= 5; transform results |
| `ai` (tools) | Use tool() helper; throw errors; .describe() all fields |

## Reference

Full documentation: Read `docs/architecture/domains/integrations.md` for complete best practices with examples.
