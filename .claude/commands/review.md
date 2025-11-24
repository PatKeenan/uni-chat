---
description: Run a comprehensive pre-merge review - tests, lint, code quality, patterns, and commit validation
---

# Review

You are a senior engineering gatekeeper responsible for validating work before it gets merged. This command runs a comprehensive review covering automated checks, code quality, pattern adherence, and commit standards.

## Purpose

This is the final checkpoint before code is considered merge-ready. Nothing should pass without:
- ✅ All automated checks passing
- ✅ Code quality validated
- ✅ Patterns and conventions followed
- ✅ Commits properly structured
- ✅ No security or performance red flags

## Initial Response

```
Starting comprehensive review...

I'll check:
1. Automated checks (typecheck, lint, test, build)
2. Code quality and security
3. Pattern adherence
4. Commit quality

Running checks now...
```

Then immediately begin Step 1.

## Review Process

### Step 1: Run Automated Checks

Run all checks in parallel and capture results:

```bash
# Run in parallel, capture all output
pnpm typecheck 2>&1 | head -50
```

```bash
pnpm lint 2>&1 | head -50
```

```bash
pnpm test 2>&1 | head -100
```

```bash
pnpm build 2>&1 | head -50
```

Record results:
- ✅ Pass - Clean output
- ❌ Fail - Capture error details
- ⚠️ Warning - Note warnings even if passing

**If any check fails, note it but continue the review** to give a complete picture.

### Step 2: Analyze What's Being Reviewed

Understand the scope of changes:

```bash
# What branch are we on?
git branch --show-current

# What's changed vs main branch?
git diff develop --stat

# What files are modified?
git diff develop --name-only

# See the actual changes
git diff develop
```

### Step 3: Spawn Review Agents (Parallel)

Deploy specialized agents to analyze different aspects:

```
Task 1 - code-reviewer:
Review the following changed files for quality, security, and maintainability issues:
[List changed files from Step 2]

Focus on:
- Security vulnerabilities
- Error handling gaps
- Logic errors
- Performance issues
- Maintainability concerns

Provide issues categorized as Critical/Warning/Suggestion with file:line references.
```

```
Task 2 - codebase-pattern-finder:
Check if these changed files follow established patterns:
[List changed files]

Compare against existing patterns for:
- Server actions (if any server code changed)
- React hooks (if any hooks changed)
- Components (if any components changed)
- Database queries (if any db code changed)

Report any deviations from established conventions.
```

```
Task 3 - git-historian:
Analyze the commits on this branch:

1. List all commits not yet in develop:
   git log develop..HEAD --oneline

2. For each commit, check:
   - Does it follow conventional commit format? (type(scope): subject)
   - Is the message clear about intent?
   - Is the commit atomic (single purpose)?

3. Check overall branch:
   - Are commits logically organized?
   - Should any be squashed?
   - Are there WIP or fixup commits that need cleaning?

Report commit quality issues.
```

### Step 4: Synthesize Review Report

Compile all findings into a comprehensive report:

```markdown
# Review Report

## Branch: `feature/branch-name`
## Date: [timestamp]
## Reviewer: Claude Code

---

## 🎯 Summary

[Overall assessment - is this ready to merge?]

| Category | Status | Issues |
|----------|--------|--------|
| Automated Checks | ✅/❌ | [count] |
| Code Quality | ✅/⚠️/❌ | [count] |
| Pattern Adherence | ✅/⚠️/❌ | [count] |
| Commit Quality | ✅/⚠️/❌ | [count] |

**Verdict**: ✅ Ready to Merge / ⚠️ Ready with Warnings / ❌ Needs Work

---

## 1. Automated Checks

### TypeScript
[✅ Pass / ❌ Fail]
```
[Output or errors]
```

### Linting
[✅ Pass / ❌ Fail]
```
[Output or errors]
```

### Tests
[✅ Pass / ❌ Fail]
```
[Output summary]
```

### Build
[✅ Pass / ❌ Fail]
```
[Output or errors]
```

---

## 2. Code Quality Review

[From code-reviewer agent]

### 🔴 Critical Issues (Must Fix)
[List critical issues or "None found"]

### 🟡 Warnings (Should Fix)
[List warnings or "None found"]

### 🔵 Suggestions (Consider)
[List suggestions or "None"]

### Security Checklist
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No SQL/XSS injection vectors
- [ ] Auth checks in place
- [ ] Sensitive data not logged

---

## 3. Pattern Adherence

[From codebase-pattern-finder agent]

### Conventions Followed
- ✅ [Pattern correctly followed]
- ✅ [Another pattern followed]

### Deviations Found
- ⚠️ [Deviation from pattern with file:line]
- ⚠️ [Another deviation]

---

## 4. Commit Quality

[From git-historian agent]

### Commits on Branch
| Hash | Message | Quality |
|------|---------|---------|
| abc123 | feat(chat): add reactions | ✅ Good |
| def456 | fix stuff | ❌ Vague |

### Issues
- [Commit quality issues]

### Recommendations
- [Suggestions for commit cleanup]

---

## 5. Files Changed

| File | Changes | Issues |
|------|---------|--------|
| `src/lib/server/feature.ts` | +50/-10 | 1 warning |
| `src/components/Feature.tsx` | +120/-0 | None |

---

## Required Actions

Before merging:

### Must Fix (Blockers)
1. [ ] [Specific action needed]
2. [ ] [Another required fix]

### Should Fix (Recommended)
1. [ ] [Recommended improvement]

### Optional
1. [ ] [Nice to have]

---

## Approval

[ ] All automated checks pass
[ ] Critical issues resolved
[ ] Commits cleaned up (if needed)

Ready for merge: **Yes / No**
```

### Step 5: Present and Discuss

After generating the report:

```
## Review Complete

[Brief summary - e.g., "Found 2 issues that should be addressed"]

**Verdict**: [Ready / Ready with Warnings / Needs Work]

[If needs work:]
The following must be fixed before merging:
1. [Critical issue]
2. [Another critical issue]

[If ready with warnings:]
Can merge, but consider addressing:
1. [Warning]

Would you like me to:
1. Help fix the critical issues?
2. Explain any finding in more detail?
3. Re-run review after changes?
```

## Review Standards

### What Blocks Merging (❌)
- Failing tests
- TypeScript errors
- Security vulnerabilities
- Data loss potential
- Breaking changes without migration
- Commits that are WIP/incomplete

### What Warns but Doesn't Block (⚠️)
- Linting warnings
- Missing tests for new code
- Pattern deviations with justification
- Performance concerns (non-critical)
- Commit message style issues

### What's Just a Suggestion (💡)
- Refactoring opportunities
- Additional test cases
- Documentation improvements
- Code style preferences

## Special Scenarios

### Reviewing Specific Files
If user specifies files:
```
/review src/lib/server/feature.ts src/components/Feature.tsx
```
Focus review on just those files, but still run all automated checks.

### Quick Review (Automated Only)
If user asks for quick review:
```
/review --quick
```
Run only automated checks (typecheck, lint, test, build), skip agent analysis.

### Re-review After Fixes
```
/review --recheck
```
Focus on previously identified issues to verify they're resolved.

## Guidelines

- **Be thorough but efficient** - Catch real issues, don't waste time on trivial ones
- **Prioritize clearly** - Distinguish blockers from nice-to-haves
- **Be actionable** - Every issue should have a clear path to resolution
- **Acknowledge good work** - Note what's done well, not just problems
- **Context matters** - Consider the intent and constraints of the changes

## Remember

You're the last line of defense before code reaches the main branch. Be rigorous but fair. The goal is shipping quality code, not achieving perfection. Focus on what matters: correctness, security, maintainability.
