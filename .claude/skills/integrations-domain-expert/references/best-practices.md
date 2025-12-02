# Integrations Domain Best Practices

> **Status**: Validated
> **Last Updated**: 2025-11-26
> **Domain Path**: `src/integrations/`

This document defines the canonical patterns and best practices for the **Integrations** domain. It serves as the source of truth for AI coding agents and the senior gatekeeper agent responsible for validating code changes.

---

## Table of Contents

1. [Domain Overview](#domain-overview)
2. [Directory Structure](#directory-structure)
3. [Core Principles](#core-principles)
4. [Package-Specific Best Practices](#package-specific-best-practices)
   - [OpenRouter AI SDK Provider](#openrouter-ai-sdk-provider)
   - [OpenRouter SDK](#openrouter-sdk)
   - [Tavily Core](#tavily-core)
   - [Vercel AI SDK Tools](#vercel-ai-sdk-tools)
5. [Common Patterns](#common-patterns)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
7. [Code Review Checklist](#code-review-checklist)
8. [Reference Links](#reference-links)

---

## Domain Overview

The Integrations domain contains **third-party API clients and external service integrations**. Each integration is a thin wrapper around an external SDK, providing:

- Per-request client instantiation (required for Cloudflare Workers)
- Type derivation from API responses
- Consistent factory function patterns

**What belongs here**:
- API client factory functions
- SDK configuration wrappers
- Tool definitions for AI SDK
- Type exports derived from external APIs

**What does NOT belong here**:
- Business logic (belongs in Server or Client domain)
- Data transformation beyond API normalization
- Caching logic (belongs in calling layer)
- Error recovery/retry logic (except SDK-provided)

---

## Directory Structure

```
src/integrations/
├── openrouter/
│   └── client.ts     # Factory function, API methods, type exports
└── tavily/
    └── web-search.ts # AI SDK tool wrapper
```

**Rules**:
- One directory per integration
- Single file per integration (no separate `types.ts`)
- Named exports only (no default exports)

---

## Core Principles

### 1. Per-Request Isolation (Cloudflare Workers)

**CRITICAL**: All integrations must create new client instances per request. Module-level instances violate Cloudflare Workers isolation requirements.

### 2. Factory Function Pattern

All integrations expose factory functions that accept configuration (typically API keys) and return configured clients.

### 3. Error Delegation

Integrations should NOT catch errors internally. Let errors bubble up to the calling layer where they can be handled with proper context.

### 4. Type Derivation

Derive types from function return values rather than maintaining separate type definitions that can drift from reality.

### 5. Thin Wrappers Only

Integrations are thin wrappers. No business logic, no caching, no complex transformations.

---

## Package-Specific Best Practices

### OpenRouter AI SDK Provider

**Package**: `@openrouter/ai-sdk-provider`
**Purpose**: Vercel AI SDK adapter for OpenRouter streaming

#### Factory Function Pattern

```typescript
// ✅ DO: Factory function with per-request instantiation
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function createOpenRouterClient(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : process.env.APP_URL,
      "X-Title": "Uni-Chat",
    },
  });
}
```

```typescript
// ❌ DON'T: Module-level instance
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// BAD: Violates Cloudflare Workers isolation
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_KEY });
export { openrouter };
```

#### Headers Configuration

```typescript
// ✅ DO: Configure both HTTP-Referer and X-Title for analytics
headers: {
  "HTTP-Referer": process.env.APP_URL,  // Your production URL
  "X-Title": "Your-App-Name",           // Concise app name
}
```

```typescript
// ❌ DON'T: Omit headers (loses OpenRouter analytics/rankings)
createOpenRouter({ apiKey })  // Missing headers
```

```typescript
// ❌ DON'T: Use undefined environment variables
headers: {
  "HTTP-Referer": process.env.UNDEFINED_VAR,  // Will be undefined!
}
```

#### Usage in Route Handlers

```typescript
// ✅ DO: Create client inside request handler
export async function POST(request: Request) {
  const { apiKey, modelId } = await request.json();

  // New instance per request
  const openrouter = createOpenRouterClient(apiKey);

  const result = streamText({
    model: openrouter(modelId),
    messages,
  });

  return result.toDataStreamResponse();
}
```

---

### OpenRouter SDK

**Package**: `@openrouter/sdk`
**Purpose**: Direct API access for non-streaming operations (e.g., fetching models)

> **Note**: This package is in **beta**. Pin to exact version in package.json.

#### Fetching Models

```typescript
// ✅ DO: New instance per call, return full response
import { OpenRouter } from "@openrouter/sdk";

export async function fetchOpenRouterModels(apiKey: string) {
  const openRouter = new OpenRouter({ apiKey });
  const models = await openRouter.models.list();
  return models;
}
```

```typescript
// ❌ DON'T: Reuse instance across requests
const openRouter = new OpenRouter({ apiKey: process.env.KEY });

export async function fetchModels() {
  return openRouter.models.list();  // BAD: Shared instance
}
```

#### Type Derivation

```typescript
// ✅ DO: Derive types from function return values
export type OpenRouterModel = Awaited<
  ReturnType<typeof fetchOpenRouterModels>
>["data"][number];
```

```typescript
// ❌ DON'T: Manually define types that can drift
export interface OpenRouterModel {
  id: string;
  name: string;
  // ... manually maintained, will drift from API
}
```

---

### Tavily Core

**Package**: `@tavily/core`
**Purpose**: Web search for AI tools

#### Tool Factory Pattern

```typescript
// ✅ DO: Factory function returning AI SDK tool
import { tavily } from "@tavily/core";
import { tool } from "ai";
import { z } from "zod";

export function createWebSearchTool(apiKey: string) {
  const tavilyClient = tavily({ apiKey });

  return tool({
    description: "Search the web for up-to-date information",
    inputSchema: z.object({
      query: z.string()
        .min(1)
        .max(400)  // Tavily best practice: keep under 400 chars
        .describe("The search query"),
    }),
    execute: async ({ query }) => {
      const response = await tavilyClient.search(query, {
        maxResults: 5,  // Recommended default (not 2)
      });

      return response.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      }));
    },
  });
}
```

#### Naming Convention

```typescript
// ✅ DO: Use "create" prefix for consistency
export function createWebSearchTool(apiKey: string) { ... }
```

```typescript
// ❌ DON'T: Use inconsistent naming
export function initWebSearchTool(apiKey: string) { ... }  // BAD: "init" vs "create"
```

#### maxResults Configuration

```typescript
// ✅ DO: Use 5 as default (good balance of quality vs speed)
maxResults: 5
```

```typescript
// ❌ DON'T: Use too few results
maxResults: 2  // BAD: Too few for quality answers
```

#### Result Transformation

```typescript
// ✅ DO: Transform results to essential fields only
return response.results.map((result) => ({
  title: result.title,
  url: result.url,
  content: result.content,
  score: result.score,
}));
```

```typescript
// ❌ DON'T: Return raw response (wastes tokens)
return response;  // BAD: Includes unnecessary metadata
```

#### No Debug Logging in Production

```typescript
// ✅ DO: Clean production code
execute: async ({ query }) => {
  const response = await tavilyClient.search(query, { maxResults: 5 });
  return response.results.map(...);
}
```

```typescript
// ❌ DON'T: Leave console.log in production
execute: async ({ query }) => {
  const response = await tavilyClient.search(query, { maxResults: 5 });
  console.log("tavily response", response);  // BAD: Debug logging
  return response.results.map(...);
}
```

---

### Vercel AI SDK Tools

**Package**: `ai`
**Purpose**: Tool definitions for LLM function calling

#### Tool Definition Structure

```typescript
// ✅ DO: Use canonical tool() pattern with all required fields
import { tool } from "ai";
import { z } from "zod";

export const myTool = tool({
  description: "Clear, specific description of what this tool does",
  inputSchema: z.object({
    param: z.string().describe("What this parameter is for"),
  }),
  execute: async ({ param }) => {
    // Implementation
    return result;
  },
});
```

#### Zod Schema Descriptions

```typescript
// ✅ DO: Use .describe() on all schema fields
inputSchema: z.object({
  query: z.string()
    .min(1)
    .max(400)
    .describe("The search query - be specific and include relevant context"),
  maxResults: z.number()
    .optional()
    .describe("Maximum number of results to return (default: 5)"),
})
```

```typescript
// ❌ DON'T: Omit descriptions (LLM loses context)
inputSchema: z.object({
  query: z.string(),  // BAD: No description
  maxResults: z.number().optional(),
})
```

#### Error Handling in Tools

```typescript
// ✅ DO: Throw errors - AI SDK 5 auto-converts to tool error results
execute: async ({ query }) => {
  const response = await client.search(query);

  if (!response.results) {
    throw new Error("Search returned no results");
  }

  return response.results;
}
```

```typescript
// ❌ DON'T: Return error objects (inconsistent with SDK 5 pattern)
execute: async ({ query }) => {
  try {
    const response = await client.search(query);
    return { success: true, data: response.results };
  } catch (error) {
    return { success: false, error: error.message };  // BAD: Return vs throw
  }
}
```

#### Tool Description Quality

```typescript
// ✅ DO: Specific, actionable descriptions
description: "Search the web for current information about a topic. Use when users ask about recent events, current data, or facts that may have changed since training."
```

```typescript
// ❌ DON'T: Vague descriptions
description: "Search the web"  // BAD: Too vague for LLM to know when to use
```

---

## Common Patterns

### Factory Function Template

Use this template for all new integrations:

```typescript
// src/integrations/[service]/client.ts
import { ServiceSDK } from "@service/sdk";

/**
 * Creates a [Service] client instance
 *
 * @param apiKey - User's API key for [Service]
 * @returns Configured client instance
 */
export function createServiceClient(apiKey: string) {
  return new ServiceSDK({
    apiKey,
    // Add service-specific configuration
  });
}

/**
 * [Describe what this function does]
 *
 * @param apiKey - User's API key
 * @returns [Describe return value]
 */
export async function fetchServiceData(apiKey: string) {
  const client = createServiceClient(apiKey);
  const data = await client.getData();
  return data;
}

// Type derivation from function return
export type ServiceData = Awaited<
  ReturnType<typeof fetchServiceData>
>["data"][number];
```

### Tool Integration Template

Use this template for AI SDK tool integrations:

```typescript
// src/integrations/[service]/tool.ts
import { tool } from "ai";
import { z } from "zod";
import { ServiceSDK } from "@service/sdk";

/**
 * Creates a [Service] tool for AI SDK
 *
 * @param apiKey - User's API key
 * @returns AI SDK tool definition
 */
export function createServiceTool(apiKey: string) {
  const client = new ServiceSDK({ apiKey });

  return tool({
    description: "Clear description of what this tool does and when to use it",
    inputSchema: z.object({
      param: z.string().describe("Description for LLM"),
    }),
    execute: async ({ param }) => {
      const response = await client.action(param);

      // Transform to essential fields only
      return response.results.map((r) => ({
        id: r.id,
        content: r.content,
      }));
    },
  });
}
```

---

## Anti-Patterns to Avoid

### 1. Module-Level Instances

```typescript
// ❌ NEVER do this
const client = new SDK({ apiKey: process.env.KEY });
export { client };
```

**Why**: Violates Cloudflare Workers per-request isolation.

### 2. Catching Errors Internally

```typescript
// ❌ NEVER do this
export async function fetchData(apiKey: string) {
  try {
    const client = new SDK({ apiKey });
    return await client.getData();
  } catch (error) {
    console.error("Error:", error);
    return null;  // Swallows error!
  }
}
```

**Why**: Callers lose error context. Let errors bubble up.

### 3. Business Logic in Integrations

```typescript
// ❌ NEVER do this
export async function fetchAndProcessData(apiKey: string, userId: string) {
  const client = new SDK({ apiKey });
  const data = await client.getData();

  // BAD: Business logic doesn't belong here
  const filtered = data.filter(d => d.ownerId === userId);
  const sorted = filtered.sort((a, b) => b.date - a.date);

  return sorted;
}
```

**Why**: Business logic belongs in Server or Client domain.

### 4. Caching in Integrations

```typescript
// ❌ NEVER do this
const cache = new Map();

export async function fetchData(apiKey: string) {
  const cached = cache.get(apiKey);
  if (cached) return cached;

  const data = await new SDK({ apiKey }).getData();
  cache.set(apiKey, data);
  return data;
}
```

**Why**: Caching belongs in the calling layer (React Query, server actions).

### 5. Debug Logging in Production

```typescript
// ❌ NEVER do this
execute: async ({ query }) => {
  const response = await client.search(query);
  console.log("Response:", response);  // Remove before committing!
  return response;
}
```

**Why**: Clutters logs, potential data exposure.

### 6. Hardcoded Configuration

```typescript
// ❌ NEVER do this (for env-dependent values)
headers: {
  "HTTP-Referer": "https://my-app.com",  // Should use process.env.APP_URL
}
```

**Why**: Breaks in different environments.

### 7. Inconsistent Naming

```typescript
// ❌ NEVER do this
export function initOpenRouterClient() { ... }    // "init"
export function createTavilyClient() { ... }       // "create"
export function makeAnthropicClient() { ... }      // "make"
```

**Why**: Inconsistent naming confuses developers and AI agents.

---

## Code Review Checklist

Use this checklist when reviewing changes to the Integrations domain:

### Required Checks

- [ ] **Per-request isolation**: No module-level client instances
- [ ] **Factory pattern**: Uses `create[Service]Client(apiKey)` naming
- [ ] **No console.log**: No debug logging in production code
- [ ] **Error delegation**: No try/catch that swallows errors
- [ ] **Type derivation**: Uses `Awaited<ReturnType<...>>` pattern
- [ ] **Named exports**: No default exports

### Tool-Specific Checks

- [ ] **Tool description**: Clear, specific description for LLM
- [ ] **Schema descriptions**: All fields have `.describe()`
- [ ] **Result transformation**: Returns only essential fields
- [ ] **Error handling**: Throws errors (doesn't return error objects)

### Configuration Checks

- [ ] **Environment variables**: All env vars are defined and documented
- [ ] **Headers**: HTTP-Referer and X-Title configured (for OpenRouter)
- [ ] **Reasonable defaults**: maxResults, timeouts, etc. are sensible

### Documentation Checks

- [ ] **JSDoc comments**: All exports have documentation
- [ ] **Parameter descriptions**: All params documented with types
- [ ] **Return value**: Return type documented

---

## Reference Links

### OpenRouter

| Resource | URL |
|----------|-----|
| Quickstart Guide | https://openrouter.ai/docs/quickstart |
| API Reference | https://openrouter.ai/docs/api/reference/overview |
| App Attribution | https://openrouter.ai/docs/app-attribution |
| Rate Limits | https://openrouter.ai/docs/limits |
| AI SDK Provider GitHub | https://github.com/OpenRouterTeam/ai-sdk-provider |
| TypeScript SDK GitHub | https://github.com/OpenRouterTeam/typescript-sdk |

### Tavily

| Resource | URL |
|----------|-----|
| JavaScript SDK Reference | https://docs.tavily.com/sdk/javascript/reference |
| Best Practices | https://docs.tavily.com/documentation/best-practices/best-practices-search |
| Vercel Integration | https://docs.tavily.com/documentation/integrations/vercel |
| Rate Limits | https://docs.tavily.com/documentation/rate-limits |
| GitHub Repository | https://github.com/tavily-ai/tavily-js |

### Vercel AI SDK

| Resource | URL |
|----------|-----|
| Tools Documentation | https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling |
| Tool API Reference | https://ai-sdk.dev/docs/reference/ai-sdk-core/tool |
| AI SDK 5 Changes | https://vercel.com/blog/ai-sdk-5 |
| Vercel Academy: Tool Use | https://vercel.com/academy/ai-sdk/tool-use |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-26 | 1.0 | Initial version based on Phase 1 investigation |
