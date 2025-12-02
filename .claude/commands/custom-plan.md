---
description: Decompose a task into a comprehensive coding brief with patterns, rules, and review requirements. Run this BEFORE starting any feature implementation.
allowed-tools: Task, Read, Grep, Glob, LS, Bash
argument-hint: <task description>
---

# Plan Feature Implementation

You are about to start implementing a new feature or task. Before writing any code, this command will:

1. **Research the codebase** to find relevant files and patterns
2. **Identify affected domains** (client, server, components, routes, etc.)
3. **Extract patterns to follow** with exact file:line references
4. **Surface domain rules** that the reviewer will check
5. **Define commit standards** and evidence requirements
6. **Produce a coding brief** that maximizes first-pass approval

## Task Description

$ARGUMENTS

## Instructions

Invoke the `task-planner` subagent with the task description above.

The task-planner will:

### Phase 1: Research

- Use `codebase-locator` to find where code should live
- Use `codebase-pattern-finder` to find similar implementations
- Use `codebase-analyzer` to understand integration points
- Use `git-historian` to check recent relevant changes

### Phase 2: Plan

- Identify all domains affected
- Map files to create and modify
- Extract specific patterns to follow
- Load applicable domain rules

### Phase 3: Output

- Generate comprehensive coding brief
- Include exact file:line pattern references
- List all rules that will be checked
- Define commit sequence
- Specify evidence requirements

## Expected Output

A complete coding brief containing:

1. **Task Summary** - What needs to be built
2. **Domains Affected** - Which areas of the codebase
3. **Files to Create/Modify** - With pattern sources
4. **Patterns to Follow** - Actual code examples with references
5. **Domain Rules** - Checklist of what reviewer checks
6. **Commit Standards** - Sequence and format
7. **Evidence Requirements** - What to provide for review
8. **Reference Documentation** - Links to best practices

## Success Criteria

The coding brief is successful if a coding agent following it:

- Knows exactly what files to create
- Has patterns to copy from
- Understands all applicable rules
- Will produce atomic, well-messaged commits
- Knows what evidence to capture
- Can pass code review without changes

## After Planning

Once the coding brief is ready, you can either:

- Review and adjust the plan
- Proceed to implementation with `/implement` (if that command exists)
- Start coding manually with the brief as your guide

---

**Remember:** 5 minutes of planning saves hours of rework. The goal is zero surprises at review time.
