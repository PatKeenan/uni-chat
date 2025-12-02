---
name: components-domain-expert
description: Components domain expert for code review and validation. Use this skill when reviewing pull requests that touch src/components/, when analyzing React component patterns (CVA, Radix UI, shadcn/ui), when detecting inline styling violations (styled elements outside ui/ directory), when validating component structure (forwardRef, data-slot, props), or when a senior AI agent needs to validate code against Components domain best practices. Provides automated violation detection and actionable PR comments.
---

# Components Domain Expert

Expert reviewer for the Components domain (`src/components/`). Validates code against documented best practices and detects violations for pull request reviews.

## When This Skill Activates

- PR touches files in `src/components/`
- PR adds/modifies React components anywhere in codebase
- PR adds styled native elements (`<button className=...>`) outside `ui/`
- Senior agent requests components domain validation
- Code review needs component pattern assessment

## Review Workflow

### Step 1: Run Automated Detection

Execute the violation detection script:

```bash
# For full codebase scan
bash .claude/skills/components-domain-expert/scripts/detect_violations.sh

# For specific files (PR review)
bash .claude/skills/components-domain-expert/scripts/detect_violations.sh src/components/chat/chat-input.tsx
```

The script detects these violations automatically:

| Rule | Severity | Description |
|------|----------|-------------|
| C001 | error | Inline styled `<button>` outside ui/ |
| C002 | error | Inline styled `<input>` outside ui/ |
| C003 | error | Inline styled `<textarea>` outside ui/ |
| C004 | error | Inline styled card pattern (`rounded-lg border`) |
| C005 | error | Inline styled badge pattern (`rounded-full px-`) |
| C006 | error | Custom modal/dialog (`fixed inset-0`) |
| C007 | warning | `style={{}}` prop usage |
| C008 | warning | Hardcoded hex color (`bg-[#`) |
| C009 | warning | `React.forwardRef` usage (deprecated) |
| C010 | warning | Missing `data-slot` in ui/ component |
| C011 | warning | `displayName` assignment |
| C012 | error | Default export |

### Step 2: Manual Component Analysis

For UI components in `src/components/ui/`:

1. Verify function component pattern (not forwardRef)
2. Check `data-slot` attribute present
3. Verify CVA has `defaultVariants` if using variants
4. Confirm `{...props}` spread on root element
5. Check className is last in `cn()` call

For feature components in `src/components/chat/`, `nav/`, `shared/`:

1. **CRITICAL**: No styled native elements - must compose from `ui/`
2. Verify hooks used for store/query access
3. Check component complexity (< 300 lines)
4. Confirm no direct database operations

### Step 3: Generate PR Comments

Script outputs JSON for PR comments:

```json
{
  "summary": "Found 3 components domain violations",
  "violations": [
    {
      "severity": "error",
      "rule": "C001",
      "file": "src/components/chat/chat-input.tsx",
      "line": 45,
      "message": "Inline styled <button> outside ui/",
      "suggestion": "Use <Button> from @/components/ui/button"
    }
  ]
}
```

## Quick Reference: Component Location

| What You Need | Where It Lives | Import From |
|---------------|----------------|-------------|
| Styled button | `ui/button.tsx` | `@/components/ui/button` |
| Styled card | `ui/card.tsx` | `@/components/ui/card` |
| Styled input | `ui/input.tsx` | `@/components/ui/input` |
| Styled badge | `ui/badge.tsx` | `@/components/ui/badge` |
| Modal/dialog | `ui/dialog.tsx` | `@/components/ui/dialog` |
| Dropdown | `ui/dropdown-menu.tsx` | `@/components/ui/dropdown-menu` |

## Quick Reference: Allowed vs Forbidden

```typescript
// ✅ ALLOWED outside ui/: Layout and spacing
<div className="flex gap-4 mt-2">
<main className="flex-1 p-4">

// ✅ ALLOWED outside ui/: Composing UI primitives
<Button variant="destructive">Delete</Button>
<Card><CardContent>...</CardContent></Card>

// ❌ FORBIDDEN outside ui/: Styled native elements
<button className="bg-primary rounded-md px-4">
<input className="border rounded h-9">
<div className="rounded-lg border shadow-sm">
<span className="rounded-full px-2 bg-primary">
```

## Quick Reference: UI Component Pattern

```typescript
// Standard UI component structure
function ComponentName({
  className,
  variant,
  ...props
}: React.ComponentProps<"element"> & VariantProps<typeof variants>) {
  return (
    <element
      data-slot="component-name"
      className={cn(variants({ variant }), className)}
      {...props}
    />
  );
}

export { ComponentName, componentNameVariants };
```

## Detailed Documentation

For full rules, examples, and rationale:
- [references/best-practices.md](references/best-practices.md) - Complete best practices guide
- [docs/architecture/domains/components.md](/docs/architecture/domains/components.md) - Source documentation
