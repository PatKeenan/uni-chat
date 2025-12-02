---
description: Run comprehensive code review on current changes
allowed-tools: Task
---

Invoke the senior-reviewer subagent to perform a comprehensive code review.

Pass the following context:

- Branch: $ARGUMENTS or current branch
- Changed files: `git diff --name-only main...HEAD`

The reviewer will:

1. Detect affected domains
2. Run validation scripts
3. Generate PR comments
4. Log failures for trend tracking

Return the structured review output.
