---
description: Research the codebase using parallel subagents to understand a feature, component, or area
---

# Research Codebase

You are tasked with researching the codebase to answer questions and provide comprehensive documentation about how things work. This command orchestrates multiple subagents in parallel to efficiently gather information without consuming the main context window.

## CRITICAL: DOCUMENT ONLY, DO NOT SUGGEST

- DO NOT suggest improvements or changes
- DO NOT perform root cause analysis unless explicitly asked
- DO NOT propose enhancements or refactoring
- DO NOT critique implementations
- ONLY describe what exists, how it works, and how components interact

## Initial Response

```
I'll research the codebase to answer your question. What would you like to understand?

Examples:
- "How does authentication work?"
- "Where is chat message handling implemented?"
- "How do server actions connect to the database?"

Please describe what you want to learn about.
```

## Research Process

### Step 1: Read Mentioned Files First

If the user mentions specific files, read them completely in the main agent BEFORE spawning subagents. This establishes shared context.

### Step 2: Decompose the Question

Break the research question into focused areas:

- What files/directories are likely involved?
- What patterns or implementations need to be found?
- What data flows need to be traced?
- What historical context might be relevant?

### Step 3: Spawn Parallel Subagents

Deploy specialized agents simultaneously for efficient research:

```
Task 1 - codebase-locator:
Find all files related to [topic]. Search for:
- Route files in src/routes/
- Server code in src/lib/server/
- Client code in src/lib/client/
- Components in src/components/
- Types in src/types/
Return: Organized list of relevant file paths grouped by purpose
```

```
Task 2 - codebase-analyzer:
Analyze how [specific component] works:
- Read the main implementation files
- Trace the data flow from entry to exit
- Document key functions with file:line references
- Note how it integrates with other systems
Return: Technical analysis with precise code locations
```

```
Task 3 - codebase-pattern-finder:
Find existing patterns related to [topic]:
- Search for similar implementations
- Extract code examples
- Note conventions used
Return: Concrete code examples with file:line references
```

```
Task 4 - git-historian (if historical context needed):
Research the history of [feature/files]:
- When was it introduced?
- How has it evolved?
- What do commit messages reveal about intent?
Return: Timeline of changes with relevant commits
```

### Step 4: Synthesize Findings

Wait for all subagents to complete, then compile into a cohesive document:

```markdown
## Research: [Topic]

### Overview

[2-3 sentence summary answering the research question]

### File Locations

[From codebase-locator]

- Implementation: `src/lib/server/feature.ts`
- Routes: `src/routes/feature.tsx`
- Types: `src/types/feature.ts`

### How It Works

[From codebase-analyzer]

#### Entry Point

- Request arrives at `src/routes/api/feature.ts:45`
- Handled by middleware at line 12

#### Core Logic

- Main processing in `src/lib/server/actions/feature.ts:20-45`
- Database interaction at `src/lib/server/db/queries.ts:30`

#### Data Flow

1. Client calls API → `src/routes/api/feature.ts:45`
2. Middleware validates → `src/lib/server/middleware/auth.ts:20`
3. Action processes → `src/lib/server/actions/feature.ts:25`
4. Database query → `src/lib/server/db/index.ts:15`
5. Response returned

### Existing Patterns

[From codebase-pattern-finder]

Similar implementations found:

- `src/lib/server/actions/other.ts:30` - Same pattern for X
- `src/lib/client/hooks/use-other.ts:15` - Client-side equivalent

### Historical Context (if applicable)

[From git-historian]

- Introduced in commit abc123 on [date]
- Major refactor in def456: "reason from commit message"

### Key Files Reference

| File                        | Purpose       | Key Lines |
| --------------------------- | ------------- | --------- |
| `src/lib/server/feature.ts` | Main logic    | 20-45     |
| `src/routes/feature.tsx`    | Route handler | 10-30     |
```

### Step 5: Present Findings

Provide a concise summary with the detailed documentation available for reference. Highlight:

- Direct answer to the research question
- Key file locations for further exploration
- Important patterns or conventions discovered

## Guidelines

- **Spawn agents in parallel** - Don't wait for one to finish before starting others
- **Read files completely** - Never use limit/offset when reading
- **Include file:line references** - Make findings actionable
- **Stay factual** - Document what exists, not what should exist
- **Synthesize, don't dump** - Compile findings into coherent narrative

## When to Use Each Agent

| Agent                     | Use For                            |
| ------------------------- | ---------------------------------- |
| `codebase-locator`        | Finding WHERE code lives           |
| `codebase-analyzer`       | Understanding HOW code works       |
| `codebase-pattern-finder` | Finding examples to model after    |
| `git-historian`           | Understanding evolution and intent |

Not every research task needs all agents. Use judgment based on the question.
