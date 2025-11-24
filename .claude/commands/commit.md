---
description: Create a well-structured git commit with standardized message format for codebase traceability
---

# Commit

You are tasked with creating a high-quality git commit that captures changes in a way that maximizes future traceability. Well-structured commits enable the `git-historian` agent to effectively resurface context and help future developers (human and AI) understand the evolution of the codebase.

## Why This Matters

Good commits are the foundation of codebase archaeology. When investigating bugs or understanding features, the `git-historian` agent relies on:
- **Clear commit messages** that explain intent, not just changes
- **Atomic commits** that group related changes logically
- **Consistent format** that enables reliable searching and parsing

## Initial Response

```
I'll help create a well-structured commit. Let me analyze the current changes.
```

Then immediately run the analysis (Step 1).

## Commit Process

### Step 1: Analyze Changes

Run these commands to understand what's being committed:

```bash
# See all changes
git status

# See staged changes (what will be committed)
git diff --cached

# See unstaged changes
git diff

# Recent commits for style reference
git log --oneline -10
```

### Step 2: Evaluate Commit Quality

Before proceeding, assess:

**Atomicity Check**:
- Do all changes relate to a single purpose?
- Should this be split into multiple commits?
- Are there unrelated changes mixed in?

**Completeness Check**:
- Are all related files included?
- Are there forgotten files that should be staged?
- Are there files that shouldn't be committed (secrets, generated files)?

**Red Flags**:
- `.env` files or credentials
- Large generated files
- Unrelated formatting changes mixed with logic changes
- Debug code or console.logs left in

If issues found, present them:
```
Before committing, I noticed:

⚠️ [Issue]: [Description]
   Recommendation: [What to do]

Would you like me to:
1. Proceed anyway
2. Help fix this first
```

### Step 3: Craft Commit Message

Follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type (Required)
| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `test` | Adding or updating tests |
| `chore` | Build, config, tooling changes |
| `perf` | Performance improvement |

#### Scope (Optional but Encouraged)
The area of the codebase affected:
- `auth` - Authentication related
- `chat` - Chat functionality
- `db` - Database/schema changes
- `api` - API routes
- `ui` - Components/UI
- `hooks` - React hooks
- `server` - Server-side code
- `client` - Client-side code

#### Subject Line Rules
- **Imperative mood**: "add feature" not "added feature"
- **No period** at the end
- **50 chars or less** (hard limit: 72)
- **Lowercase** start (after type)
- **Complete the sentence**: "This commit will [subject]"

#### Body (Required for non-trivial changes)
- Explain **WHY**, not just what
- Wrap at 72 characters
- Separate from subject with blank line
- Use bullet points for multiple points
- Reference related context

#### Footer (When Applicable)
- Breaking changes: `BREAKING CHANGE: description`
- Issue references: `Closes #123` or `Fixes #456`
- Co-authors: `Co-Authored-By: Name <email>`

### Step 4: Present Draft

Show the proposed commit:

```markdown
## Proposed Commit

### Files to be committed:
- `src/lib/server/actions/feature.ts` (modified)
- `src/components/Feature.tsx` (added)
- `src/types/feature.ts` (added)

### Commit message:

feat(chat): add message reactions support

Implement emoji reactions for chat messages, allowing users to react
to any message with a predefined set of emojis.

- Add reaction data model and server action
- Create ReactionPicker component with emoji grid
- Integrate with existing message display
- Store reactions in local storage for persistence

This enables lightweight feedback without requiring full replies,
improving chat UX for quick acknowledgments.

---

Does this look good? I can:
1. Create this commit
2. Adjust the message
3. Modify what's being committed
```

### Step 5: Create Commit

Once approved, create the commit:

```bash
git add [files if needed]

git commit -m "$(cat <<'EOF'
feat(chat): add message reactions support

Implement emoji reactions for chat messages, allowing users to react
to any message with a predefined set of emojis.

- Add reaction data model and server action
- Create ReactionPicker component with emoji grid
- Integrate with existing message display
- Store reactions in local storage for persistence

This enables lightweight feedback without requiring full replies,
improving chat UX for quick acknowledgments.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

Then verify:
```bash
git status
git log -1
```

## Commit Message Examples

### Good Examples

```
feat(auth): add session refresh on app focus

Automatically refresh auth session when user returns to the app,
preventing unexpected logouts during long idle periods.

- Listen for visibility change events
- Call auth.refresh() when tab becomes visible
- Add 5-minute minimum interval to prevent excessive refreshes

Addresses user feedback about frequent re-authentication.
```

```
fix(db): handle null user preferences gracefully

User preferences were causing crashes when accessed before
initialization. Now returns sensible defaults.

- Add nullish coalescing for preferences object
- Set default theme to 'system'
- Add migration to backfill existing null records

Fixes #42
```

```
refactor(hooks): extract chat state into dedicated hook

Separate chat state management from message fetching to improve
testability and reduce component complexity.

- Create useChatState for local state management
- Create useChatMessages for data fetching
- Update ChatWindow to compose both hooks
- Add unit tests for each hook

No functional changes; prepares for upcoming real-time features.
```

### Bad Examples (Don't Do This)

```
❌ update stuff
❌ fix bug
❌ WIP
❌ changes
❌ feat: add feature (missing scope, vague subject)
❌ Fixed the thing that was broken (past tense, vague)
```

## Special Scenarios

### Multiple Logical Changes
If changes should be split:
```
I notice these changes include both a bug fix and a new feature.
For better traceability, I recommend splitting into two commits:

1. fix(chat): handle empty message edge case
2. feat(chat): add message timestamp display

Would you like me to help stage these separately?
```

### Breaking Changes
```
feat(api)!: change message payload structure

BREAKING CHANGE: Message objects now use `content` instead of `text`.

Update all consumers to use the new field name. Migration:
- message.text → message.content

This aligns with the OpenAI message format for consistency.
```

### Reverting
```
revert: feat(chat): add message reactions

This reverts commit abc1234.

Reactions feature causing performance issues on large threads.
Will revisit after optimization pass.
```

## Guidelines

- **Never commit secrets** - Check for .env, API keys, credentials
- **Never skip hooks** - Unless explicitly requested with good reason
- **Always explain why** - Future archaeologists will thank you
- **One purpose per commit** - Makes bisect and revert effective
- **Reference issues** - Connect commits to broader context

## Quality Standards for AI Traceability

These standards make the codebase more navigable for AI agents:

1. **Searchable types** - Consistent prefixes enable `git log --grep="feat"`
2. **Scoped changes** - Scopes enable `git log --grep="(auth)"` queries
3. **Intent in body** - AI can understand "why" not just "what"
4. **Atomic commits** - Cleaner diffs when tracing changes
5. **No noise** - Avoid commits that just say "fix" or "update"

Every commit you make today is documentation for the AI (and humans) of tomorrow.
