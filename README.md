# Uni-Chat

A local-first, multi-model AI chat application built for local-first, privacy-focused users. Bring your own API keys, keep your data local, and access all the latest AI models through a single interface.

## Philosophy

Uni-Chat is built on two core principles:

1. **Privacy-First**: Your conversations, API keys, and data stay on your device. No tracking, no ads, no data harvesting. This is a return to the classic local-first web philosophy.

2. **One Subscription, All Models**: Through OpenRouter integration, you get access to chat models, image generation, video models, and more - all from one place with one subscription.

## Features

- **Local-First Architecture**: All chat data stored locally via PGlite (PostgreSQL in the browser)
- **Multi-Model Support**: Access any model available through OpenRouter
- **Multi-Modal**: Support for text, images, and more as models evolve
- **BYOK (Bring Your Own Key)**: Use your own OpenRouter API key and optional Tavily key for web search
- **Full Data Control**: Export, import, or delete all your data through settings
- **Web Search**: Optional Tavily integration for grounding responses in current information

## Tech Stack

- **Runtime**: Bun
- **Framework**: TanStack Start (React Server Framework)
- **Deployment**: Cloudflare Workers
- **Server Database**: PostgreSQL with Drizzle ORM
- **Client Database**: PGlite (local-first)
- **Auth**: Better Auth
- **LLM Provider**: OpenRouter
- **UI**: Tailwind CSS + shadcn/ui
- **Testing**: Vitest

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Run tests
bun test

# Type check
bun typecheck

# Lint
bun lint
```

## Project Structure

The codebase is organized into 7 distinct domains:

```
src/
├── routes/         # Page routes, API endpoints, layouts
├── server/         # Server-side code (actions, middleware, db, auth)
├── client/         # Client-side code (hooks, stores, PGlite db)
├── components/     # React UI components (ui/, chat/, nav/, shared/)
├── integrations/   # Third-party API clients (OpenRouter, Tavily)
├── types/          # Shared TypeScript definitions
└── test/           # Test infrastructure
```

See [docs/architecture/DOMAIN-ARCHITECTURE.md](docs/architecture/DOMAIN-ARCHITECTURE.md) for detailed domain specifications.

## Claude Code Experiment

This project doubles as an experiment in AI-assisted development, specifically focused on **code review quality over implementation speed**.

### The Problem

AI coding assistants are great at generating code, but often produce "code slop" - technically working code that doesn't follow project patterns, introduces inconsistencies, or slowly degrades codebase quality over time.

### The Approach

Instead of focusing on AI implementation or planning, this project emphasizes **validation and review**:

- **Domain Expert Skills**: Specialized Claude Code skills for each domain (server, client, components, routes, integrations, types) that understand the specific patterns and rules for that area
- **Automated Validation**: Scripts that detect domain violations before they enter the codebase
- **`/review` Command**: A comprehensive PR review system that acts as a specialized senior developer:
  - Identifies which domains are affected by changes
  - Runs validation scripts to detect pattern violations
  - References domain-specific best practices
  - Generates detailed, actionable feedback with exact file:line references
  - Tracks failures over time to improve the review process

### The Goal

Create a feedback loop where AI-assisted development gets better over time by:

1. Catching violations early in PR review
2. Tracking what violations slip through
3. Using that data to improve both the review skills and implementation guidance

This is an attempt to make AI-assisted development **scalable** - maintaining code quality as the codebase grows rather than accumulating technical debt.

## Roadmap

- [ ] **Folder Memories**: Per-folder context that users can manually adjust or reference in chat
- [ ] **Custom Agents**: Create specialized agents through the UI (personas,models, system prompts, tool access, orchestration, evaluation)
- [ ] **Device Sync via WebRTC**: Peer-to-peer sync between devices using QR code pairing (scan on mobile to sync with desktop) - no server involved, your data never leaves your devices
- [ ] **On-Device Models**: Run local models (WebLLM/WebGPU) for fully offline conversations - no API key required
- [ ] **P2P Group Chat** (experimental): WebRTC-based group conversations with a shared AI assistant - each participant uses their own API key, no server mediating the chat
- [ ] **Enhanced Export**: More export formats and selective data export
- [ ] **Offline Mode**: Full functionality without network connection

## Development Commands

```bash
# Development
bun dev              # Start dev server (port 3000)
bun build            # Production build
bun deploy           # Deploy to Cloudflare Workers

# Quality
bun test             # Run tests
bun typecheck        # TypeScript checking
bun lint             # Biome linting
bun lint:fix         # Auto-fix lint issues
bun format           # Format code

# Database
bun db:generate      # Generate migrations from schema
bun db:migrate       # Apply migrations
bun db:studio        # Open Drizzle Studio
```
