---
description: Investigate a bug or issue using parallel subagents to find root cause
---

# Investigate Issue

You are tasked with investigating a bug, error, or unexpected behavior. This command orchestrates subagents to efficiently gather evidence and identify the root cause without consuming the main context window with exploration.

## Initial Response

```
I'll help investigate this issue. Please describe:

1. **What's happening** - The error, unexpected behavior, or symptom
2. **What you expected** - How it should work
3. **When it started** (if known) - After a specific change? Always broken?
4. **Steps to reproduce** (if known)

Any error messages, stack traces, or logs would be helpful.
```

## Investigation Process

### Step 1: Parse the Problem

Extract from user description:
- Symptoms (what's wrong)
- Expected behavior
- Affected area (files, features, flows)
- Timeline clues (when did it work last?)
- Error messages or stack traces

### Step 2: Spawn Investigation Agents (Parallel)

Deploy agents to gather evidence simultaneously:

```
Task 1 - codebase-locator:
Find all files related to [affected feature/area]:
- Implementation files
- Related routes and handlers
- Client-side code involved
- Test files
Return: Complete file listing for the affected area
```

```
Task 2 - codebase-analyzer:
Analyze how [feature/flow] currently works:
- Trace the code path from [entry point] to [where it fails]
- Document each step with file:line references
- Note where data transformations occur
- Identify external dependencies
Return: Detailed flow analysis with precise locations
```

```
Task 3 - git-historian:
Research recent changes to [affected files/area]:
- What commits touched these files recently?
- When was this code last modified?
- What do commit messages say about intent?
- Any recent refactors or fixes in this area?
Return: Timeline of recent changes with relevant diffs
```

```
Task 4 - codebase-pattern-finder (if needed):
Find how similar functionality works elsewhere:
- Are there working examples of similar code?
- How do other parts of the codebase handle this pattern?
Return: Working examples that might reveal what's different
```

### Step 3: Analyze Evidence

After agents return, look for:
- **Discrepancies** - Where does actual behavior diverge from expected?
- **Recent changes** - Did something change that could cause this?
- **Pattern violations** - Is the code following established patterns?
- **Missing pieces** - Is something expected but not present?
- **Error origins** - Where in the flow does the problem start?

### Step 4: Present Findings

Structure the investigation report:

```markdown
## Investigation: [Issue Summary]

### Problem Statement
[Clear description of the issue based on user input and evidence]

### Evidence Gathered

#### Code Flow Analysis
[From codebase-analyzer]

The [feature] flow works as follows:
1. `src/routes/feature.tsx:45` - Entry point
2. `src/lib/server/actions/feature.ts:20` - Handler
3. `src/lib/server/db/queries.ts:30` - Database query
4. **[Problem area]** - `src/lib/server/feature.ts:55`

#### Recent Changes
[From git-historian]

| Commit | Date | Files | Description |
|--------|------|-------|-------------|
| abc123 | 2024-01-15 | feature.ts | "refactor: extract validation" |
| def456 | 2024-01-14 | queries.ts | "fix: handle null case" |

Potentially relevant change:
```diff
- const result = await db.query(...)
+ const result = await db.query(...).catch(() => null)
```

#### Working Examples
[From codebase-pattern-finder, if applicable]

Similar functionality in `src/lib/server/other.ts:30` works correctly:
```typescript
// Working pattern
```

### Root Cause Analysis

**Most likely cause**: [Based on evidence]

**Evidence supporting this**:
1. [Evidence point 1]
2. [Evidence point 2]
3. [Evidence point 3]

**Alternative possibilities**:
- [Other potential cause if evidence is ambiguous]

### Suggested Fix

**Location**: `src/lib/server/feature.ts:55-60`

**Current code**:
```typescript
// What exists now
```

**Suggested change**:
```typescript
// What it should be (if clear from evidence)
```

**Why this should fix it**:
[Explanation based on evidence]

### Verification Steps

After fixing:
1. [ ] `pnpm typecheck` passes
2. [ ] `pnpm test` passes
3. [ ] [Specific reproduction steps now work]
4. [ ] [Edge cases to verify]

### Open Questions
[If investigation revealed uncertainties]
- [Question that needs user input]
```

### Step 5: Collaborate on Fix

After presenting findings:
```
Based on my investigation, [root cause summary].

The fix appears to be in `file:line` - [brief description].

Would you like me to:
1. Implement the fix?
2. Investigate further (specify what)?
3. Explain more about the root cause?
```

## Investigation Strategies

### "It used to work"
Focus on git-historian:
- Find when it last worked (commit or date)
- Identify changes between then and now
- Narrow down to specific commits

### "It never worked" / New feature broken
Focus on codebase-analyzer + pattern-finder:
- Trace the intended flow
- Compare against working examples
- Find where implementation diverges from pattern

### "Error message / Stack trace"
Focus on codebase-analyzer:
- Start from error location
- Trace backward to find root cause
- Identify what triggered the error path

### "Intermittent / Hard to reproduce"
Focus on codebase-analyzer + git-historian:
- Look for race conditions
- Check for state dependencies
- Find recent changes to shared state

## Guidelines

- **Evidence-based** - Every conclusion needs supporting evidence
- **Precise locations** - Always include file:line references
- **Multiple angles** - Use several agents to triangulate
- **Don't assume** - Let evidence guide conclusions
- **Present options** - If uncertain, offer alternatives with evidence

## Environment-Specific Debugging

For this TanStack Start + Cloudflare Workers app:

**Server-side issues**:
- Check middleware chain (global → auth → protected)
- Verify per-request isolation (db/auth via loadConfig)
- Look at server action patterns

**Client-side issues**:
- Check React Query cache behavior
- Verify hook dependencies
- Look at client storage patterns

**Database issues**:
- Check Drizzle query patterns
- Verify schema matches expectations
- Look at migration history

**Auth issues**:
- Check Better Auth configuration
- Verify session handling
- Look at auth middleware
