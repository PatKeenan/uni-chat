---
description: Create an implementation plan for a feature or task using parallel research
---

# Create Plan

You are tasked with creating a detailed implementation plan for a feature or task. This command orchestrates research subagents to gather context, then produces a structured plan with clear phases and success criteria.

## Initial Response

```
I'll help create an implementation plan. Please describe:

1. **What** you want to build or change
2. **Why** (optional context on motivation)
3. **Any constraints** (must use existing patterns, backward compatibility, etc.)

I'll research the codebase and create a phased implementation plan.
```

## Planning Process

### Step 1: Understand the Request

Parse the user's description for:
- Core functionality needed
- Integration points with existing code
- Constraints or requirements mentioned
- Success criteria (explicit or implied)

### Step 2: Research Phase (Parallel Subagents)

Spawn agents to gather implementation context:

```
Task 1 - codebase-locator:
Find files relevant to implementing [feature]:
- Where would new code live based on existing structure?
- What existing files need modification?
- What related features exist?
Return: File locations organized by: needs modification, integration points, examples to follow
```

```
Task 2 - codebase-pattern-finder:
Find patterns to follow for [feature]:
- Similar features already implemented
- Conventions for this type of code (routes, actions, hooks, etc.)
- Testing patterns used
Return: Code examples with file:line references showing established patterns
```

```
Task 3 - codebase-analyzer:
Analyze the integration points for [feature]:
- How do related systems work?
- What interfaces need to be respected?
- What data flows exist that this feature touches?
Return: Technical analysis of systems this feature will interact with
```

```
Task 4 - git-historian (if modifying existing code):
Research history of files being modified:
- Why were they structured this way?
- Any past attempts at similar changes?
- Recent changes that might affect approach?
Return: Historical context relevant to the implementation
```

### Step 3: Synthesize Research

Compile findings into implementation context:
- What patterns to follow
- What files to create/modify
- What interfaces to respect
- What pitfalls to avoid

### Step 4: Create the Plan

Structure the plan with clear phases:

```markdown
## Implementation Plan: [Feature Name]

### Overview
[2-3 sentences describing what will be built and the approach]

### Research Summary
Based on codebase analysis:
- **Pattern to follow**: [Example from codebase-pattern-finder]
- **Integration points**: [From codebase-analyzer]
- **Files involved**: [From codebase-locator]

---

### Phase 1: [Foundation/Setup]
**Goal**: [What this phase accomplishes]

#### Changes
1. **Create `src/path/to/new-file.ts`**
   - [What this file does]
   - Follow pattern from `src/path/to/example.ts:20-45`

2. **Modify `src/path/to/existing.ts`**
   - Add [what] at [where]
   - Integrate with existing [what]

#### Success Criteria
**Automated**:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes

**Manual**:
- [ ] [Specific verification step]

---

### Phase 2: [Core Implementation]
**Goal**: [What this phase accomplishes]

#### Changes
1. **[File/component]**
   - [Specific changes]

#### Success Criteria
**Automated**:
- [ ] Tests pass
- [ ] Types check

**Manual**:
- [ ] [Verification step]

---

### Phase 3: [Integration/Polish]
**Goal**: [What this phase accomplishes]

#### Changes
[...]

#### Success Criteria
[...]

---

### Notes
- **Patterns used**: [List conventions followed]
- **Not in scope**: [Explicit boundaries]
- **Future considerations**: [Things to think about later, not now]
```

### Step 5: Review with User

Present the plan and ask:
```
Here's the implementation plan for [feature].

Key decisions made:
- [Decision 1]: [Rationale based on research]
- [Decision 2]: [Rationale]

Questions before we proceed:
- [Any ambiguity that needs clarification]

Does this plan look good? Any adjustments needed?
```

## Plan Quality Guidelines

### Good Phases
- **Single responsibility** - Each phase has one clear goal
- **Independently verifiable** - Can confirm phase works before moving on
- **Builds on previous** - Later phases depend on earlier ones
- **Small enough to review** - Not too many changes per phase

### Good Success Criteria
- **Automated first** - typecheck, test, lint
- **Specific manual steps** - "Click X, expect Y" not "verify it works"
- **Measurable** - Can definitively say pass/fail

### Good Changes
- **Precise locations** - File paths, line numbers when modifying
- **Pattern references** - "Follow pattern from X" with concrete example
- **Clear rationale** - Why this approach based on research

## Codebase-Specific Patterns

For this TanStack Start + Cloudflare Workers codebase:

**New Server Action**:
- Create in `src/lib/server/actions/`
- Use `createServerFn()` pattern
- Apply appropriate middleware (globalMiddleware, authMiddleware, protectedMiddleware)
- Access db/auth via `context.config`

**New Route**:
- Create in `src/routes/`
- Follow TanStack Router conventions
- Use loaders for SSR data

**New Client Hook**:
- Create in `src/lib/client/hooks/`
- Follow existing naming: `use-feature.ts`

**New Component**:
- Create in `src/components/`
- Use Radix primitives from `src/components/ui/`
- Style with Tailwind

**Database Changes**:
- Schema in `src/lib/server/db/schema/`
- Run `pnpm db:generate` then `pnpm db:migrate`
