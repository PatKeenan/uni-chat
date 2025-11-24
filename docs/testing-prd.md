# Testing Implementation PRD

**Project**: uni-chat Testing Infrastructure
**Created**: 2025-11-24
**Status**: Not Started
**Owner**: Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Context](#project-context)
3. [Architecture Overview](#architecture-overview)
4. [Critical Code Inventory](#critical-code-inventory)
5. [Phase 1: Testing Infrastructure Setup](#phase-1-testing-infrastructure-setup)
6. [Phase 2: Pure Function Tests (Unit Tests - Easy Wins)](#phase-2-pure-function-tests-unit-tests---easy-wins)
7. [Phase 3: Server Action Tests (Unit Tests - Core Business Logic)](#phase-3-server-action-tests-unit-tests---core-business-logic)
8. [Phase 4: Middleware Tests (Integration Tests)](#phase-4-middleware-tests-integration-tests)
9. [Phase 5: Client-Side Tests (Unit + Integration)](#phase-5-client-side-tests-unit--integration)
10. [Phase 6: E2E Tests (Optional)](#phase-6-e2e-tests-optional)
11. [Testing Patterns & Examples](#testing-patterns--examples)
12. [Progress Tracking](#progress-tracking)

---

## Executive Summary

### Problem
The uni-chat codebase has **zero tests** despite having critical functionality including:
- Encryption of sensitive API keys
- Message persistence with deduplication
- Authentication and authorization flows
- Real-time AI chat streaming

### Solution
Implement comprehensive testing in 6 phases:
1. **Infrastructure** (Vitest config, test utilities)
2. **Pure functions** (Encryption, utilities)
3. **Server actions** (CRUD, business logic)
4. **Middleware** (Auth flows)
5. **Client-side** (React hooks, PGlite)
6. **E2E** (Critical user journeys)

### Success Metrics
- ✅ 70%+ code coverage on critical paths
- ✅ All tests pass in CI/CD
- ✅ <30 second test suite runtime for unit tests
- ✅ Regression prevention for key features

---

## Project Context

### Codebase Overview

**Tech Stack**:
- **Framework**: TanStack Start (React Server Framework)
- **Runtime**: Cloudflare Workers
- **Database**: PostgreSQL (server, auth only) + PGlite (client, chats/messages)
- **ORM**: Drizzle
- **Auth**: Better Auth
- **AI**: AI SDK v3 with OpenRouter transport
- **Testing**: Vitest v3.0.5 + React Testing Library v16.2.0 (configured but unused)

**Architecture Pattern**: Per-request isolation for Cloudflare Workers
- `loadConfig()` creates fresh `db` and `auth` instances per request
- Never share module-level database/auth instances
- Middleware chain: `globalMiddleware` → `authMiddleware` → `protectedMiddleware`

**File Structure**:
```
src/
├── lib/
│   ├── server/
│   │   ├── actions/        # Server functions (API operations)
│   │   ├── middleware/     # Request pipeline (auth, config)
│   │   ├── db/             # Database schema and connection
│   │   ├── auth/           # Better Auth configuration
│   │   └── utils/          # Encryption, helpers
│   └── client/
│       ├── actions/        # Client-side operations (PGlite)
│       ├── hooks/          # React hooks (chat streaming)
│       ├── db/             # PGlite schema
│       └── transports/     # OpenRouter API client
├── routes/                 # TanStack Router file-based routing
└── components/             # React components (UI)
```

### Current State
- **Tests written**: 0
- **Test files**: 0
- **Vitest config**: Missing (no `vitest.config.ts`)
- **Test utilities**: None
- **Mocks**: None

### Key Constraints
1. **Cloudflare Workers**: Tests must verify per-request isolation (no shared state)
2. **Dual database**: Separate test strategies for PostgreSQL (server) and PGlite (client)
3. **External dependencies**: OpenRouter API and Better Auth must be mocked
4. **Streaming**: AI chat uses streaming responses (complex async behavior)

---

## Architecture Overview

### Testing Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      TEST LAYERS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  E2E Tests (Playwright)                                     │
│  └─ Browser → Full App → Real DB → External APIs           │
│     [Login → Create Chat → Send Message → Receive]         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Integration Tests (Vitest)                                 │
│  ├─ Middleware Chain (real composition, mock APIs)         │
│  ├─ API Key Flow (real DB, real encryption)                │
│  └─ Message Persistence (real DB, mock streaming)          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Unit Tests (Vitest)                                        │
│  ├─ Server Actions (mock DB, mock context)                 │
│  ├─ Client Actions (mock PGlite)                           │
│  ├─ React Hooks (mock AI SDK, mock storage)                │
│  └─ Pure Functions (no mocks)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Mocking Strategy

| Layer | Mock | Real |
|-------|------|------|
| **Unit Tests** | Database, Auth, External APIs, File System | Pure functions, Business logic |
| **Integration Tests** | External APIs (OpenRouter, Better Auth session endpoint) | Database (in-memory), Middleware, Encryption |
| **E2E Tests** | Nothing (or mock at network level with MSW) | Everything |

---

## Critical Code Inventory

### Priority: CRITICAL 🔴

#### 1. Encryption Utilities
**File**: `src/lib/server/utils/encryption.ts`
**Lines**: 13-103
**Functions**:
- `getEncryptionKey()` (13-44): Derives AES key from `BETTER_AUTH_SECRET` using PBKDF2
- `encryptApiKey(apiKey: string)` (52-76): Encrypts with AES-256-GCM, returns base64
- `decryptApiKey(encrypted: string)` (84-103): Decrypts base64 string

**Why Critical**: Security-critical, handles sensitive API keys
**Dependencies**: `process.env.BETTER_AUTH_SECRET`, Web Crypto API
**Test Complexity**: Easy (pure functions)

#### 2. Message Persistence
**File**: `src/lib/server/actions/message-actions.ts`
**Lines**: 29-147
**Functions**:
- `saveMessages(messages: UIMessage[])` (29-81): Deduplicates and saves messages/parts
- `getMessagesByChatId(chatId: string)` (87-147): Reconstructs UIMessage from normalized schema

**Why Critical**: Data integrity, complex transformation logic
**Dependencies**: Database (message, messagePart tables), protectedMiddleware
**Test Complexity**: Medium (needs mock DB or in-memory SQLite)

#### 3. API Key Actions
**File**: `src/lib/server/actions/api-key-actions.ts`
**Lines**: 14-130
**Functions**:
- `saveApiKey(apiKey: string)` (14-47): Encrypts and upserts
- `getApiKey()` (53-76): Decrypts and updates lastUsedAt
- `validateApiKey()` (95-112): Calls OpenRouter API to validate
- `hasApiKey()` (118-130): Existence check

**Why Critical**: Sensitive data handling, upsert logic
**Dependencies**: Database, encryption, OpenRouter API
**Test Complexity**: Medium (mock DB + external API)

---

### Priority: HIGH 🟡

#### 4. Middleware Chain
**Files**:
- `src/lib/server/middleware/global-middleware.ts` (4-11)
- `src/lib/server/middleware/auth-middleware.ts` (4-18)
- `src/lib/server/middleware/protected-middleware.ts` (4-16)

**Why High**: Foundation for all protected routes, auth enforcement
**Dependencies**: `loadConfig()`, Better Auth `getSession()`
**Test Complexity**: Medium-High (mock auth, verify composition)

#### 5. Chat Actions (Server)
**File**: `src/lib/server/actions/chat-actions.ts`
**Lines**: 11-257
**Functions**: 11 CRUD operations (create, update, delete, pin, archive, etc.)

**Why High**: Core business logic, ownership security
**Dependencies**: Database (chat, folder tables), protectedMiddleware
**Test Complexity**: Medium (mock DB, test Zod validation)

#### 6. Client Message Actions
**File**: `src/lib/client/actions/message-actions.ts`
**Lines**: 36-145
**Functions**:
- `saveLocalMessages()` (36-114): Saves to PGlite with deduplication
- `getLocalMessages()` (125-145): Fetches with ownership check

**Why High**: Client-side persistence, dual-database complexity
**Dependencies**: PGlite, chat ownership verification
**Test Complexity**: Medium-High (mock/real PGlite)

---

### Priority: MEDIUM 🟢

#### 7. Chat Streaming Hook
**File**: `src/lib/client/hooks/use-chat-stream.ts`
**Lines**: 30-216
**Functionality**: Wraps AI SDK `useChat`, manages transport, persists messages, auto-generates titles

**Why Medium**: Complex but isolated to chat feature
**Test Complexity**: High (React hooks, async streaming, multiple side effects)

#### 8. OpenRouter Transport
**File**: `src/lib/client/transports/openrouter-transport.ts`
**Lines**: 15-111
**Functionality**: Implements AI SDK ChatTransport, streams from OpenRouter

**Why Medium**: Critical for AI features but well-encapsulated
**Test Complexity**: Medium-High (mock streaming, abort signals)

#### 9. Other Server Actions
- `src/lib/server/actions/folder-actions.ts` (6 operations)
- `src/lib/server/actions/model-actions.ts` (4 operations)

**Why Medium**: Simpler CRUD, lower risk
**Test Complexity**: Easy-Medium (standard mocking)

---

## Phase 1: Testing Infrastructure Setup

**Goal**: Create Vitest configuration, test utilities, and mocking foundation

**Status**: ✅ Complete
**Completed**: 2025-11-24
**Actual Effort**: ~2 hours
**Dependencies**: None

---

### Deliverables

#### 1.1: Create Vitest Configuration

**File**: `vitest.config.ts` (root)

**Requirements**:
- Enable `globals` for `describe`, `it`, `expect` without imports
- Set environment to `jsdom` for React component tests
- Configure path aliases (`@/*` → `src/*`)
- Set up coverage reporting (v8 provider)
- Exclude test files and type definitions from coverage
- Point to setup file: `src/test/setup.ts`

**Implementation**:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.tanstack'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Verification**:
```bash
# Should run without errors (0 tests)
bun test

# Should show config is loaded
bun test --reporter=verbose
```

---

#### 1.2: Create Test Setup File

**File**: `src/test/setup.ts`

**Requirements**:
- Import Vitest globals (if needed for TypeScript)
- Set up environment variables for tests
- Configure Testing Library cleanup
- Add custom matchers if needed

**Implementation**:
```typescript
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Set up environment variables for tests
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-encryption-minimum-32-chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  error: vi.fn(), // Mock console.error
  warn: vi.fn(),  // Mock console.warn
};
```

**Verification**:
```bash
# Create a dummy test file
echo 'import { describe, it, expect } from "vitest";
describe("Setup", () => {
  it("should have environment variables", () => {
    expect(process.env.BETTER_AUTH_SECRET).toBeDefined();
  });
});' > src/test/setup.test.ts

bun test src/test/setup.test.ts
# Should pass
```

---

#### 1.3: Create Test Utilities

**File**: `src/test/utils/test-helpers.ts`

**Requirements**:
- Factory function for mock user objects
- Factory function for mock session objects
- Factory function for mock middleware context
- Factory function for mock Request objects
- Helper to create test database (in-memory SQLite)

**Implementation**:
```typescript
import { type User, type Session } from '@/lib/server/db/schema';
import { nanoid } from 'nanoid';

// ============================================================
// Mock Factories
// ============================================================

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: nanoid(),
    email: 'test@example.com',
    emailVerified: false,
    name: 'Test User',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: nanoid(),
    userId: nanoid(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h from now
    token: nanoid(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockContext(overrides?: {
  user?: User | null;
  session?: Session | null;
  config?: any;
}) {
  const user = overrides?.user !== undefined ? overrides.user : createMockUser();
  const session = overrides?.session !== undefined ? overrides.session : createMockSession();

  return {
    user,
    session,
    config: overrides?.config || {
      db: createMockDb(),
      auth: createMockAuth(),
    },
  };
}

export function createMockRequest(options?: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}): Request {
  const url = options?.url || 'http://localhost:3000/api/test';
  const method = options?.method || 'GET';
  const headers = new Headers(options?.headers || {});

  return new Request(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

// ============================================================
// Mock Database Builder
// ============================================================

export function createMockDb() {
  // This returns a mock Drizzle instance
  // Can be enhanced later with actual in-memory SQLite
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  };
}

export function createMockAuth() {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue({
        session: createMockSession(),
        user: createMockUser(),
      }),
    },
  };
}

// ============================================================
// Test Data Builders
// ============================================================

export function createTestChat(overrides?: any) {
  return {
    id: nanoid(),
    userId: nanoid(),
    selectedModel: 'openai/gpt-4',
    folderId: null,
    title: 'Test Chat',
    pinned: false,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestMessage(overrides?: any) {
  return {
    id: nanoid(),
    chatId: nanoid(),
    role: 'user' as const,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestMessagePart(overrides?: any) {
  return {
    id: nanoid(),
    messageId: nanoid(),
    type: 'text' as const,
    content: 'Test message content',
    order: 0,
    toolCallId: null,
    toolName: null,
    ...overrides,
  };
}
```

**Verification**:
```bash
# Create test for helpers
echo 'import { describe, it, expect } from "vitest";
import { createMockUser, createMockContext } from "./test-helpers";

describe("Test Helpers", () => {
  it("should create mock user", () => {
    const user = createMockUser();
    expect(user.email).toBe("test@example.com");
    expect(user.id).toBeDefined();
  });

  it("should create mock context", () => {
    const context = createMockContext();
    expect(context.user).toBeDefined();
    expect(context.config.db).toBeDefined();
  });
});' > src/test/utils/test-helpers.test.ts

bun test src/test/utils/test-helpers.test.ts
# Should pass
```

---

#### 1.4: Create Mock Files

**File**: `src/test/mocks/db.mock.ts`

**Requirements**:
- Mock Drizzle database instance
- Spy functions for tracking calls
- Optional: In-memory SQLite setup for integration tests

**Implementation**:
```typescript
import { vi } from 'vitest';

/**
 * Creates a mock Drizzle database instance with chainable query methods
 * Usage: const db = createMockDb();
 */
export function createMockDb() {
  const mockDb = {
    // Query builders
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),

    // Query modifiers
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),

    // Execution
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    then: vi.fn((resolve) => resolve([])), // Makes it thenable
  };

  return mockDb;
}

/**
 * Creates a mock database with preset responses
 * Usage:
 *   const db = createMockDbWithData({
 *     users: [{ id: '1', email: 'test@example.com' }]
 *   });
 */
export function createMockDbWithData(data: {
  users?: any[];
  chats?: any[];
  messages?: any[];
  apiKeys?: any[];
}) {
  const db = createMockDb();

  // Configure select to return data based on table
  db.from.mockImplementation((table: any) => {
    const tableName = table?._.name || 'unknown';

    if (tableName === 'user' && data.users) {
      db.then.mockImplementation((resolve) => resolve(data.users));
    } else if (tableName === 'chat' && data.chats) {
      db.then.mockImplementation((resolve) => resolve(data.chats));
    } else if (tableName === 'message' && data.messages) {
      db.then.mockImplementation((resolve) => resolve(data.messages));
    } else if (tableName === 'api_key' && data.apiKeys) {
      db.then.mockImplementation((resolve) => resolve(data.apiKeys));
    }

    return db;
  });

  return db;
}

// TODO: For Phase 4 (Integration Tests)
// export async function createInMemoryDb() {
//   // Set up in-memory SQLite with Drizzle
//   // Run migrations
//   // Return real Drizzle instance
// }
```

---

**File**: `src/test/mocks/auth.mock.ts`

**Requirements**:
- Mock Better Auth `getSession()` responses
- Helper functions for authenticated/unauthenticated states

**Implementation**:
```typescript
import { vi } from 'vitest';
import { createMockUser, createMockSession } from '../utils/test-helpers';

/**
 * Creates a mock Better Auth instance
 */
export function createMockAuth() {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue({
        session: createMockSession(),
        user: createMockUser(),
      }),
      signIn: vi.fn().mockResolvedValue({ success: true }),
      signOut: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

/**
 * Mock authenticated state (user logged in)
 */
export function mockAuthenticatedSession(overrides?: {
  user?: any;
  session?: any;
}) {
  const user = overrides?.user || createMockUser();
  const session = overrides?.session || createMockSession({ userId: user.id });

  return {
    session,
    user,
  };
}

/**
 * Mock unauthenticated state (no user)
 */
export function mockUnauthenticatedSession() {
  return {
    session: null,
    user: null,
  };
}

/**
 * Mock expired session
 */
export function mockExpiredSession() {
  const user = createMockUser();
  const session = createMockSession({
    userId: user.id,
    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
  });

  return {
    session,
    user,
  };
}
```

---

**File**: `src/test/mocks/external-apis.mock.ts`

**Requirements**:
- Mock OpenRouter API responses
- Mock AI SDK streaming responses

**Implementation**:
```typescript
import { vi } from 'vitest';

/**
 * Mock OpenRouter API /api/v1/auth/key response
 */
export function mockOpenRouterKeyValidation(valid = true) {
  return vi.fn().mockResolvedValue({
    ok: valid,
    json: async () => ({
      data: valid
        ? { label: 'Test API Key', limit: 1000, usage: 100 }
        : { error: 'Invalid API key' },
    }),
  });
}

/**
 * Mock OpenRouter models list response
 */
export function mockOpenRouterModels(models?: any[]) {
  const defaultModels = [
    {
      id: 'openai/gpt-4',
      name: 'GPT-4',
      pricing: { prompt: '0.00003', completion: '0.00006' },
    },
    {
      id: 'anthropic/claude-3-opus',
      name: 'Claude 3 Opus',
      pricing: { prompt: '0.000015', completion: '0.000075' },
    },
  ];

  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: models || defaultModels }),
  });
}

/**
 * Mock AI SDK streamText response
 */
export function mockStreamText(response = 'This is a test AI response') {
  return {
    textStream: (async function* () {
      for (const char of response) {
        yield char;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    })(),
    text: Promise.resolve(response),
    finishReason: Promise.resolve('stop'),
    usage: Promise.resolve({ promptTokens: 10, completionTokens: 20 }),
  };
}
```

---

#### 1.5: Create Example "Hello World" Test

**File**: `src/test/example.test.ts`

**Purpose**: Verify entire testing infrastructure works

**Implementation**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockUser, createMockContext } from './utils/test-helpers';
import { createMockDb } from './mocks/db.mock';

describe('Testing Infrastructure', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });

  it('should have environment variables', () => {
    expect(process.env.BETTER_AUTH_SECRET).toBeDefined();
  });

  it('should create mock user', () => {
    const user = createMockUser({ email: 'custom@example.com' });
    expect(user.email).toBe('custom@example.com');
    expect(user.id).toBeDefined();
  });

  it('should create mock context', () => {
    const context = createMockContext();
    expect(context.user).toBeDefined();
    expect(context.session).toBeDefined();
    expect(context.config.db).toBeDefined();
  });

  it('should mock database calls', async () => {
    const db = createMockDb();
    db.then.mockResolvedValue([{ id: '1', email: 'test@example.com' }]);

    const result = await db.select().from('user');
    expect(result).toHaveLength(1);
    expect(db.select).toHaveBeenCalled();
  });

  it('should support vitest spies', () => {
    const mockFn = vi.fn((x: number) => x * 2);
    expect(mockFn(5)).toBe(10);
    expect(mockFn).toHaveBeenCalledWith(5);
  });
});
```

**Verification**:
```bash
bun test src/test/example.test.ts
# Should show 6 passing tests
```

---

### Phase 1 Success Criteria

**Automated**:
- [x] `bun test` runs without errors ✅
- [x] `bun typecheck` passes ✅
- [x] `bun lint` passes ✅
- [x] Example test file passes (6 tests) ✅

**Manual**:
- [x] `vitest.config.ts` exists and is valid ✅
- [x] `src/test/setup.ts` runs before each test ✅
- [x] Path aliases (`@/*`) resolve in tests ✅
- [x] Mock factories create valid objects ✅
- [x] Environment variables available in tests ✅

**Files Created**:
```
vitest.config.ts
src/test/setup.ts
src/test/utils/test-helpers.ts
src/test/mocks/db.mock.ts
src/test/mocks/auth.mock.ts
src/test/mocks/external-apis.mock.ts
src/test/example.test.ts
```

---

## Phase 2: Pure Function Tests (Unit Tests - Easy Wins)

**Goal**: Test encryption utilities and pure functions to build testing confidence

**Status**: ❌ Not Started
**Estimated Effort**: 3-5 hours
**Dependencies**: Phase 1 complete

---

### Deliverables

#### 2.1: Test Encryption Utilities

**File**: `src/lib/server/utils/encryption.test.ts`

**Requirements**:
- Test `encryptApiKey()` produces base64 output
- Test `decryptApiKey()` reverses encryption (round-trip)
- Test IV randomness (same input → different outputs)
- Test invalid inputs (empty strings, corrupted data)
- Test missing environment variable handling

**Implementation**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptApiKey, decryptApiKey } from './encryption';

describe('Encryption Utilities', () => {
  beforeEach(() => {
    // Ensure environment variable is set (from setup.ts)
    expect(process.env.BETTER_AUTH_SECRET).toBeDefined();
  });

  describe('encryptApiKey', () => {
    it('should encrypt a string and return base64', async () => {
      const apiKey = 'sk-test-key-12345';
      const encrypted = await encryptApiKey(apiKey);

      // Should be base64 format
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
      // Should be different from input
      expect(encrypted).not.toBe(apiKey);
      // Should have reasonable length (IV + encrypted data)
      expect(encrypted.length).toBeGreaterThan(20);
    });

    it('should produce different output each time (random IV)', async () => {
      const apiKey = 'sk-test-key-12345';
      const encrypted1 = await encryptApiKey(apiKey);
      const encrypted2 = await encryptApiKey(apiKey);

      // Different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', async () => {
      const encrypted = await encryptApiKey('');
      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle long strings', async () => {
      const longKey = 'sk-' + 'a'.repeat(500);
      const encrypted = await encryptApiKey(longKey);
      expect(encrypted).toBeDefined();
    });
  });

  describe('decryptApiKey', () => {
    it('should decrypt previously encrypted key', async () => {
      const original = 'sk-test-key-12345';
      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('should handle empty string round-trip', async () => {
      const original = '';
      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('should handle special characters', async () => {
      const original = 'sk-!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('should throw on invalid base64', async () => {
      await expect(decryptApiKey('not-valid-base64!!!')).rejects.toThrow();
    });

    it('should throw on corrupted data', async () => {
      const encrypted = await encryptApiKey('test');
      const corrupted = encrypted.slice(0, -5) + 'XXXXX';

      await expect(decryptApiKey(corrupted)).rejects.toThrow();
    });

    it('should throw on wrong encryption key', async () => {
      const original = 'sk-test-key';
      const encrypted = await encryptApiKey(original);

      // Change the encryption key
      const oldSecret = process.env.BETTER_AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = 'different-secret-key-for-testing-32chars';

      await expect(decryptApiKey(encrypted)).rejects.toThrow();

      // Restore original secret
      process.env.BETTER_AUTH_SECRET = oldSecret;
    });
  });

  describe('Round-trip tests', () => {
    const testCases = [
      { name: 'OpenAI key format', value: 'sk-proj-abc123xyz789' },
      { name: 'Anthropic key format', value: 'sk-ant-api03-abc123' },
      { name: 'Generic API key', value: 'pk_live_51234567890' },
      { name: 'Unicode characters', value: '密钥-🔑-key' },
      { name: 'Very long key', value: 'sk-' + 'x'.repeat(1000) },
    ];

    testCases.forEach(({ name, value }) => {
      it(`should handle round-trip for: ${name}`, async () => {
        const encrypted = await encryptApiKey(value);
        const decrypted = await decryptApiKey(encrypted);
        expect(decrypted).toBe(value);
      });
    });
  });
});
```

**Verification**:
```bash
bun test src/lib/server/utils/encryption.test.ts
# Should show ~15 passing tests
```

---

#### 2.2: Test Utility Functions

**File**: `src/lib/utils.test.ts`

**Requirements**:
- Test `cn()` function (classname merger)
- Test any other pure utilities

**Implementation**:
```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('Utility Functions', () => {
  describe('cn (classname merger)', () => {
    it('should merge class names', () => {
      const result = cn('btn', 'btn-primary');
      expect(result).toBe('btn btn-primary');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('btn', isActive && 'active');
      expect(result).toContain('active');
    });

    it('should filter out falsy values', () => {
      const result = cn('btn', false, null, undefined, 'primary');
      expect(result).toBe('btn primary');
    });

    it('should handle Tailwind conflicts with clsx/tailwind-merge', () => {
      // Assuming cn uses tailwind-merge
      const result = cn('px-2 py-1', 'p-4');
      // tailwind-merge should resolve conflicts (p-4 overrides px-2 py-1)
      expect(result).toContain('p-4');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });
  });
});
```

**Verification**:
```bash
bun test src/lib/utils.test.ts
# Should show 5 passing tests
```

---

#### 2.3: Test Client Utilities (if applicable)

**File**: `src/lib/client/utils/to-ui-message.test.ts` (create if conversion logic exists)

**Note**: Only create if there's significant transformation logic in client utilities.

---

### Phase 2 Success Criteria

**Automated**:
- [ ] All encryption tests pass (15+ tests)
- [ ] All utility tests pass (5+ tests)
- [ ] `bun test` runs in <5 seconds
- [ ] Coverage >90% for `src/lib/server/utils/encryption.ts`
- [ ] Coverage >80% for `src/lib/utils.ts`

**Manual**:
- [ ] Round-trip encryption verified with real API key formats
- [ ] Edge cases documented in test names
- [ ] All test descriptions are clear and specific

**Files Created**:
```
src/lib/server/utils/encryption.test.ts
src/lib/utils.test.ts
```

---

## Phase 3: Server Action Tests (Unit Tests - Core Business Logic)

**Goal**: Test critical server actions with mocked database

**Status**: ❌ Not Started
**Estimated Effort**: 8-12 hours
**Dependencies**: Phase 1 complete (Phase 2 optional but recommended)

---

### Deliverables

#### 3.1: Test API Key Actions

**File**: `src/lib/server/actions/api-key-actions.test.ts`

**Code Under Test**: `src/lib/server/actions/api-key-actions.ts`
- `saveApiKey()` (lines 14-47)
- `getApiKey()` (lines 53-76)
- `validateApiKey()` (lines 95-112)
- `hasApiKey()` (lines 118-130)

**Requirements**:
- Test first-time save (insert path)
- Test update existing key (update path)
- Test retrieval with decryption
- Test validation with OpenRouter API
- Test existence check
- Mock database queries
- Mock encryption functions (or use real)
- Mock external API calls

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveApiKey, getApiKey, validateApiKey, hasApiKey } from './api-key-actions';
import { createMockContext } from '@/test/utils/test-helpers';
import { createMockDb } from '@/test/mocks/db.mock';
import * as encryption from '@/lib/server/utils/encryption';
import { mockOpenRouterKeyValidation } from '@/test/mocks/external-apis.mock';

// Mock the encryption module
vi.mock('@/lib/server/utils/encryption', () => ({
  encryptApiKey: vi.fn((key) => Promise.resolve(`encrypted_${key}`)),
  decryptApiKey: vi.fn((key) => Promise.resolve(key.replace('encrypted_', ''))),
}));

describe('API Key Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveApiKey', () => {
    it('should insert new API key on first save', async () => {
      const mockDb = createMockDb();
      // Mock select to return empty array (no existing key)
      mockDb.limit.mockResolvedValue([]);
      // Mock insert to succeed
      mockDb.values.mockResolvedValue({ id: 'new-key-id' });

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await saveApiKey({
        context,
        data: { apiKey: 'sk-test-key' },
      });

      expect(result.success).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled(); // Should not update
      expect(encryption.encryptApiKey).toHaveBeenCalledWith('sk-test-key');
    });

    it('should update existing API key', async () => {
      const mockDb = createMockDb();
      // Mock select to return existing key
      mockDb.limit.mockResolvedValue([
        { id: 'existing-key-id', userId: 'user-123', encryptedKey: 'old-encrypted' },
      ]);
      // Mock update to succeed
      mockDb.where.mockResolvedValue({ success: true });

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await saveApiKey({
        context,
        data: { apiKey: 'sk-new-key' },
      });

      expect(result.success).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled(); // Should not insert
      expect(encryption.encryptApiKey).toHaveBeenCalledWith('sk-new-key');
    });

    it('should throw error if user not in context', async () => {
      const context = createMockContext({ user: null });

      await expect(
        saveApiKey({ context, data: { apiKey: 'sk-test' } })
      ).rejects.toThrow();
    });

    it('should validate input with Zod', async () => {
      const context = createMockContext();

      // Invalid input (empty string)
      await expect(
        saveApiKey({ context, data: { apiKey: '' } })
      ).rejects.toThrow();

      // Invalid input (not a string)
      await expect(
        saveApiKey({ context, data: { apiKey: 123 as any } })
      ).rejects.toThrow();
    });
  });

  describe('getApiKey', () => {
    it('should retrieve and decrypt API key', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([
        { id: 'key-id', userId: 'user-123', encryptedKey: 'encrypted_sk-test' },
      ]);
      mockDb.where.mockResolvedValue({ success: true }); // Update lastUsedAt

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await getApiKey({ context });

      expect(result).toBe('sk-test'); // Decrypted value
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled(); // Should update lastUsedAt
      expect(encryption.decryptApiKey).toHaveBeenCalledWith('encrypted_sk-test');
    });

    it('should return null if no API key exists', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([]); // No key found

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await getApiKey({ context });

      expect(result).toBeNull();
      expect(mockDb.update).not.toHaveBeenCalled(); // No update if not found
    });

    it('should throw if user not in context', async () => {
      const context = createMockContext({ user: null });

      await expect(getApiKey({ context })).rejects.toThrow();
    });
  });

  describe('validateApiKey', () => {
    it('should validate API key with OpenRouter', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([
        { id: 'key-id', encryptedKey: 'encrypted_sk-valid' },
      ]);

      // Mock fetch for OpenRouter API
      global.fetch = mockOpenRouterKeyValidation(true);

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await validateApiKey({ context });

      expect(result.valid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/auth/key',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-valid',
          }),
        })
      );
    });

    it('should return invalid for bad API key', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([
        { id: 'key-id', encryptedKey: 'encrypted_sk-invalid' },
      ]);

      // Mock fetch to return invalid response
      global.fetch = mockOpenRouterKeyValidation(false);

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await validateApiKey({ context });

      expect(result.valid).toBe(false);
    });

    it('should handle network errors', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([
        { id: 'key-id', encryptedKey: 'encrypted_sk-test' },
      ]);

      // Mock fetch to reject
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      await expect(validateApiKey({ context })).rejects.toThrow('Network error');
    });
  });

  describe('hasApiKey', () => {
    it('should return true if API key exists', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([{ id: 'key-id' }]);

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await hasApiKey({ context });

      expect(result).toBe(true);
    });

    it('should return false if no API key exists', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([]);

      const context = createMockContext({
        user: { id: 'user-123' },
        config: { db: mockDb },
      });

      const result = await hasApiKey({ context });

      expect(result).toBe(false);
    });
  });
});
```

**Verification**:
```bash
bun test src/lib/server/actions/api-key-actions.test.ts
# Should show 14+ passing tests
```

---

#### 3.2: Test Message Actions

**File**: `src/lib/server/actions/message-actions.test.ts`

**Code Under Test**: `src/lib/server/actions/message-actions.ts`
- `saveMessages()` (lines 29-81) - Deduplication logic
- `getMessagesByChatId()` (lines 87-147) - Data transformation

**Requirements**:
- Test deduplication prevents duplicate saves
- Test message parts are saved correctly
- Test retrieval reconstructs UIMessage format
- Test empty messages array
- Test concurrent saves (simulate race condition)
- Mock database with message/messagePart tables

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveMessages, getMessagesByChatId } from './message-actions';
import { createMockContext, createTestMessage } from '@/test/utils/test-helpers';
import { createMockDb } from '@/test/mocks/db.mock';
import type { CoreMessage } from 'ai';

describe('Message Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveMessages', () => {
    it('should save new messages to database', async () => {
      const mockDb = createMockDb();
      // Mock select to return no existing messages (new save)
      mockDb.limit.mockResolvedValue([]);
      mockDb.values.mockResolvedValue({ success: true });

      const context = createMockContext({ user: { id: 'user-123' } });

      const messages: CoreMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
        },
      ];

      await saveMessages({
        context,
        data: { chatId: 'chat-123', messages },
      });

      // Should insert messages
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // Once for messages, once for parts
      expect(mockDb.values).toHaveBeenCalled();
    });

    it('should deduplicate existing messages', async () => {
      const mockDb = createMockDb();
      // Mock select to return existing message
      mockDb.limit.mockResolvedValue([{ id: 'msg-1' }]);

      const context = createMockContext({ user: { id: 'user-123' } });

      const messages: CoreMessage[] = [
        {
          id: 'msg-1', // Existing message
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          id: 'msg-2', // New message
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi!' }],
        },
      ];

      await saveMessages({
        context,
        data: { chatId: 'chat-123', messages },
      });

      // Should only insert new message (msg-2)
      expect(mockDb.insert).toHaveBeenCalled();
      // Verify deduplication logic ran
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should handle messages with multiple parts', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([]);
      mockDb.values.mockResolvedValue({ success: true });

      const context = createMockContext({ user: { id: 'user-123' } });

      const messages: CoreMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'How are you?' },
          ],
        },
      ];

      await saveMessages({
        context,
        data: { chatId: 'chat-123', messages },
      });

      // Should save both parts
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle empty messages array', async () => {
      const mockDb = createMockDb();
      const context = createMockContext({ user: { id: 'user-123' } });

      await saveMessages({
        context,
        data: { chatId: 'chat-123', messages: [] },
      });

      // Should not attempt to insert
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw if user not authorized', async () => {
      const context = createMockContext({ user: null });

      await expect(
        saveMessages({
          context,
          data: { chatId: 'chat-123', messages: [] },
        })
      ).rejects.toThrow();
    });
  });

  describe('getMessagesByChatId', () => {
    it('should retrieve and reconstruct UIMessage format', async () => {
      const mockDb = createMockDb();

      // Mock message query result
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date('2024-01-01'),
          parts: [
            {
              id: 'part-1',
              type: 'text',
              content: 'Hello',
              order: 0,
              toolCallId: null,
              toolName: null,
            },
          ],
        },
        {
          id: 'msg-2',
          role: 'assistant',
          createdAt: new Date('2024-01-02'),
          parts: [
            {
              id: 'part-2',
              type: 'text',
              content: 'Hi there!',
              order: 0,
              toolCallId: null,
              toolName: null,
            },
          ],
        },
      ];

      mockDb.limit.mockResolvedValue(mockMessages);

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await getMessagesByChatId({
        context,
        data: { chatId: 'chat-123' },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      });
      expect(result[1]).toMatchObject({
        id: 'msg-2',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
      });
    });

    it('should return empty array if no messages found', async () => {
      const mockDb = createMockDb();
      mockDb.limit.mockResolvedValue([]);

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await getMessagesByChatId({
        context,
        data: { chatId: 'chat-123' },
      });

      expect(result).toEqual([]);
    });

    it('should handle messages with tool calls', async () => {
      const mockDb = createMockDb();

      const mockMessages = [
        {
          id: 'msg-1',
          role: 'assistant',
          createdAt: new Date(),
          parts: [
            {
              id: 'part-1',
              type: 'tool-call',
              content: '{"query": "weather"}',
              order: 0,
              toolCallId: 'call-123',
              toolName: 'web_search',
            },
          ],
        },
      ];

      mockDb.limit.mockResolvedValue(mockMessages);

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await getMessagesByChatId({
        context,
        data: { chatId: 'chat-123' },
      });

      expect(result[0].content).toContainEqual(
        expect.objectContaining({
          type: 'tool-call',
          toolCallId: 'call-123',
          toolName: 'web_search',
        })
      );
    });

    it('should preserve message part order', async () => {
      const mockDb = createMockDb();

      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          parts: [
            { id: 'part-2', type: 'text', content: 'Second', order: 1 },
            { id: 'part-1', type: 'text', content: 'First', order: 0 },
            { id: 'part-3', type: 'text', content: 'Third', order: 2 },
          ],
        },
      ];

      mockDb.limit.mockResolvedValue(mockMessages);

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await getMessagesByChatId({
        context,
        data: { chatId: 'chat-123' },
      });

      // Should be sorted by order field
      expect(result[0].content[0]).toMatchObject({ text: 'First' });
      expect(result[0].content[1]).toMatchObject({ text: 'Second' });
      expect(result[0].content[2]).toMatchObject({ text: 'Third' });
    });
  });
});
```

**Verification**:
```bash
bun test src/lib/server/actions/message-actions.test.ts
# Should show 11+ passing tests
```

---

#### 3.3: Test Chat Actions

**File**: `src/lib/server/actions/chat-actions.test.ts`

**Code Under Test**: `src/lib/server/actions/chat-actions.ts`
- All 11 CRUD operations (create, update, delete, pin, archive, etc.)

**Requirements**:
- Test create chat with required/optional fields
- Test update chat title
- Test delete chat
- Test pin/unpin chat
- Test archive/unarchive chat
- Test ownership checks (can't access other user's chats)
- Test input validation with Zod

**Implementation** (abbreviated, expand as needed):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createChat,
  updateChatTitle,
  deleteChat,
  pinChat,
  archiveChat,
  getUserChats,
} from './chat-actions';
import { createMockContext, createTestChat } from '@/test/utils/test-helpers';
import { createMockDb } from '@/test/mocks/db.mock';

describe('Chat Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createChat', () => {
    it('should create new chat with required fields', async () => {
      const mockDb = createMockDb();
      mockDb.values.mockResolvedValue({ id: 'chat-123' });

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await createChat({
        context,
        data: { modelId: 'openai/gpt-4' },
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.selectedModel).toBe('openai/gpt-4');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create chat with optional folderId', async () => {
      const mockDb = createMockDb();
      mockDb.values.mockResolvedValue({ id: 'chat-123' });

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await createChat({
        context,
        data: {
          modelId: 'openai/gpt-4',
          folderId: 'folder-456',
          title: 'My Chat',
        },
      });

      expect(result.folderId).toBe('folder-456');
      expect(result.title).toBe('My Chat');
    });

    it('should validate input with Zod', async () => {
      const context = createMockContext();

      // Missing required modelId
      await expect(
        createChat({ context, data: {} as any })
      ).rejects.toThrow();
    });

    it('should throw if user not in context', async () => {
      const context = createMockContext({ user: null });

      await expect(
        createChat({
          context,
          data: { modelId: 'openai/gpt-4' },
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateChatTitle', () => {
    it('should update chat title', async () => {
      const mockDb = createMockDb();
      mockDb.where.mockResolvedValue({ success: true });

      const context = createMockContext({ user: { id: 'user-123' } });

      await updateChatTitle({
        context,
        data: { chatId: 'chat-123', title: 'New Title' },
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Title' })
      );
    });
  });

  describe('deleteChat', () => {
    it('should delete chat and associated messages (cascade)', async () => {
      const mockDb = createMockDb();
      mockDb.where.mockResolvedValue({ success: true });

      const context = createMockContext({ user: { id: 'user-123' } });

      await deleteChat({
        context,
        data: { chatId: 'chat-123' },
      });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('pinChat', () => {
    it('should pin chat', async () => {
      const mockDb = createMockDb();
      mockDb.where.mockResolvedValue({ success: true });

      const context = createMockContext({ user: { id: 'user-123' } });

      await pinChat({
        context,
        data: { chatId: 'chat-123', pinned: true },
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ pinned: true });
    });

    it('should unpin chat', async () => {
      const mockDb = createMockDb();
      mockDb.where.mockResolvedValue({ success: true });

      const context = createMockContext({ user: { id: 'user-123' } });

      await pinChat({
        context,
        data: { chatId: 'chat-123', pinned: false },
      });

      expect(mockDb.set).toHaveBeenCalledWith({ pinned: false });
    });
  });

  describe('getUserChats', () => {
    it('should retrieve user chats', async () => {
      const mockDb = createMockDb();
      const mockChats = [
        createTestChat({ userId: 'user-123', title: 'Chat 1' }),
        createTestChat({ userId: 'user-123', title: 'Chat 2' }),
      ];
      mockDb.where.mockResolvedValue(mockChats);

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await getUserChats({ context });

      expect(result).toHaveLength(2);
      expect(mockDb.where).toHaveBeenCalledWith(
        expect.anything() // Should filter by userId
      );
    });

    it('should only return user own chats (ownership check)', async () => {
      const mockDb = createMockDb();
      mockDb.where.mockResolvedValue([
        createTestChat({ userId: 'user-123' }),
        // Should NOT include other user's chats
      ]);

      const context = createMockContext({ user: { id: 'user-123' } });

      const result = await getUserChats({ context });

      // Verify where clause filters by userId
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  // TODO: Add tests for archiveChat, moveChatToFolder, etc.
});
```

**Verification**:
```bash
bun test src/lib/server/actions/chat-actions.test.ts
# Should show 10+ passing tests
```

---

### Phase 3 Success Criteria

**Automated**:
- [ ] All API key action tests pass (14+ tests)
- [ ] All message action tests pass (11+ tests)
- [ ] All chat action tests pass (10+ tests)
- [ ] `bun test` completes in <15 seconds
- [ ] Coverage >70% for tested action files
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

**Manual**:
- [ ] Deduplication logic verified (message-actions)
- [ ] Ownership checks verified (chat-actions)
- [ ] Upsert logic verified (api-key-actions)
- [ ] Mock database queries logged and inspected

**Files Created**:
```
src/lib/server/actions/api-key-actions.test.ts
src/lib/server/actions/message-actions.test.ts
src/lib/server/actions/chat-actions.test.ts
```

---

## Phase 4: Middleware Tests (Integration Tests)

**Goal**: Test authentication and authorization flow with middleware composition

**Status**: ❌ Not Started
**Estimated Effort**: 4-6 hours
**Dependencies**: Phase 1 complete, Phase 3 recommended

---

### Deliverables

#### 4.1: Test Global Middleware

**File**: `src/lib/server/middleware/global-middleware.test.ts`

**Code Under Test**: `src/lib/server/middleware/global-middleware.ts` (lines 4-11)

**Requirements**:
- Test `loadConfig()` is called
- Test `config` object added to context
- Test per-request isolation (each call gets new instance)
- Mock `loadConfig()` to verify it's called per request

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalMiddleware } from './global-middleware';
import * as loadConfigModule from '@/lib/server/loadConfig';
import { createMockRequest } from '@/test/utils/test-helpers';

// Mock loadConfig module
vi.mock('@/lib/server/loadConfig', () => ({
  loadConfig: vi.fn(() => ({
    db: { mockDb: true },
    auth: { mockAuth: true },
    env: process.env,
  })),
}));

describe('Global Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call loadConfig on each request', async () => {
    const request = createMockRequest();
    const next = vi.fn((ctx) => Promise.resolve({ context: ctx }));

    await globalMiddleware.server({ request, next });

    expect(loadConfigModule.loadConfig).toHaveBeenCalledTimes(1);
  });

  it('should add config to context', async () => {
    const request = createMockRequest();
    let capturedContext: any;

    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ context: ctx });
    });

    await globalMiddleware.server({ request, next });

    expect(capturedContext.config).toBeDefined();
    expect(capturedContext.config.db).toBeDefined();
    expect(capturedContext.config.auth).toBeDefined();
  });

  it('should create new config instance per request (isolation)', async () => {
    const request1 = createMockRequest({ url: 'http://localhost/api/test1' });
    const request2 = createMockRequest({ url: 'http://localhost/api/test2' });

    const next = vi.fn((ctx) => Promise.resolve({ context: ctx }));

    await globalMiddleware.server({ request: request1, next });
    await globalMiddleware.server({ request: request2, next });

    // loadConfig should be called twice (once per request)
    expect(loadConfigModule.loadConfig).toHaveBeenCalledTimes(2);
  });

  it('should pass through to next middleware', async () => {
    const request = createMockRequest();
    const next = vi.fn(() => Promise.resolve({ success: true }));

    const result = await globalMiddleware.server({ request, next });

    expect(next).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
```

**Verification**:
```bash
bun test src/lib/server/middleware/global-middleware.test.ts
# Should show 4 passing tests
```

---

#### 4.2: Test Auth Middleware

**File**: `src/lib/server/middleware/auth-middleware.test.ts`

**Code Under Test**: `src/lib/server/middleware/auth-middleware.ts` (lines 4-18)

**Requirements**:
- Test session loaded from Better Auth
- Test null session handled correctly
- Test user data added to context
- Mock Better Auth `getSession()` API

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware } from './auth-middleware';
import { createMockRequest, createMockUser, createMockSession } from '@/test/utils/test-helpers';
import { mockAuthenticatedSession, mockUnauthenticatedSession } from '@/test/mocks/auth.mock';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load session and user from Better Auth', async () => {
    const request = createMockRequest();
    const sessionData = mockAuthenticatedSession();

    const mockAuth = {
      api: {
        getSession: vi.fn().mockResolvedValue(sessionData),
      },
    };

    const initialContext = {
      config: { auth: mockAuth, db: {} },
    };

    let capturedContext: any;
    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ context: ctx });
    });

    await authMiddleware.server({ request, context: initialContext, next });

    expect(mockAuth.api.getSession).toHaveBeenCalledWith(request);
    expect(capturedContext.session).toEqual(sessionData.session);
    expect(capturedContext.user).toEqual(sessionData.user);
  });

  it('should handle null session (unauthenticated)', async () => {
    const request = createMockRequest();
    const sessionData = mockUnauthenticatedSession();

    const mockAuth = {
      api: {
        getSession: vi.fn().mockResolvedValue(sessionData),
      },
    };

    const initialContext = {
      config: { auth: mockAuth, db: {} },
    };

    let capturedContext: any;
    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ context: ctx });
    });

    await authMiddleware.server({ request, context: initialContext, next });

    expect(capturedContext.session).toBeNull();
    expect(capturedContext.user).toBeNull();
  });

  it('should extend globalMiddleware context', async () => {
    const request = createMockRequest();
    const sessionData = mockAuthenticatedSession();

    const mockAuth = {
      api: {
        getSession: vi.fn().mockResolvedValue(sessionData),
      },
    };

    const initialContext = {
      config: { auth: mockAuth, db: {} },
      someGlobalValue: 'test', // From globalMiddleware
    };

    let capturedContext: any;
    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ context: ctx });
    });

    await authMiddleware.server({ request, context: initialContext, next });

    // Should preserve previous context values
    expect(capturedContext.someGlobalValue).toBe('test');
    expect(capturedContext.session).toBeDefined();
    expect(capturedContext.user).toBeDefined();
  });

  it('should handle getSession errors gracefully', async () => {
    const request = createMockRequest();

    const mockAuth = {
      api: {
        getSession: vi.fn().mockRejectedValue(new Error('Auth service down')),
      },
    };

    const initialContext = {
      config: { auth: mockAuth, db: {} },
    };

    const next = vi.fn();

    await expect(
      authMiddleware.server({ request, context: initialContext, next })
    ).rejects.toThrow('Auth service down');
  });
});
```

**Verification**:
```bash
bun test src/lib/server/middleware/auth-middleware.test.ts
# Should show 4 passing tests
```

---

#### 4.3: Test Protected Middleware

**File**: `src/lib/server/middleware/protected-middleware.test.ts`

**Code Under Test**: `src/lib/server/middleware/protected-middleware.ts` (lines 4-16)

**Requirements**:
- Test 401 thrown when no user
- Test passes when user exists
- Test error response format (JSON with 401 status)
- Test preserves user in context

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { protectedMiddleware } from './protected-middleware';
import { createMockRequest, createMockUser } from '@/test/utils/test-helpers';

describe('Protected Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw 401 when no user in context', async () => {
    const request = createMockRequest();
    const initialContext = {
      user: null,
      session: null,
      config: {},
    };

    const next = vi.fn();

    try {
      await protectedMiddleware.server({ request, context: initialContext, next });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.status).toBe(401);
      expect(error.body.error).toBe('Unauthorized');
    }

    expect(next).not.toHaveBeenCalled();
  });

  it('should pass through when user exists', async () => {
    const request = createMockRequest();
    const user = createMockUser();
    const initialContext = {
      user,
      session: {},
      config: {},
    };

    let capturedContext: any;
    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ context: ctx });
    });

    const result = await protectedMiddleware.server({
      request,
      context: initialContext,
      next,
    });

    expect(next).toHaveBeenCalled();
    expect(capturedContext.user).toEqual(user);
  });

  it('should preserve existing context values', async () => {
    const request = createMockRequest();
    const user = createMockUser();
    const initialContext = {
      user,
      session: { id: 'session-123' },
      config: { db: {}, auth: {} },
      customValue: 'test',
    };

    let capturedContext: any;
    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ context: ctx });
    });

    await protectedMiddleware.server({ request, context: initialContext, next });

    expect(capturedContext.user).toEqual(user);
    expect(capturedContext.session).toEqual({ id: 'session-123' });
    expect(capturedContext.config).toBeDefined();
    expect(capturedContext.customValue).toBe('test');
  });

  it('should have correct error response format', async () => {
    const request = createMockRequest();
    const initialContext = { user: null };
    const next = vi.fn();

    try {
      await protectedMiddleware.server({ request, context: initialContext, next });
    } catch (error: any) {
      expect(error).toMatchObject({
        status: 401,
        body: {
          error: 'Unauthorized',
        },
      });
    }
  });
});
```

**Verification**:
```bash
bun test src/lib/server/middleware/protected-middleware.test.ts
# Should show 4 passing tests
```

---

#### 4.4: Test Middleware Chain (Integration)

**File**: `src/test/integration/middleware-chain.test.ts`

**Requirements**:
- Test full middleware chain: global → auth → protected
- Test context propagation through chain
- Test auth failure stops at protected middleware
- Use real middleware composition (not mocked)

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalMiddleware } from '@/lib/server/middleware/global-middleware';
import { authMiddleware } from '@/lib/server/middleware/auth-middleware';
import { protectedMiddleware } from '@/lib/server/middleware/protected-middleware';
import { createMockRequest } from '@/test/utils/test-helpers';
import { mockAuthenticatedSession, mockUnauthenticatedSession } from '@/test/mocks/auth.mock';
import * as loadConfigModule from '@/lib/server/loadConfig';

// Mock loadConfig
vi.mock('@/lib/server/loadConfig', () => ({
  loadConfig: vi.fn(() => ({
    db: { mockDb: true },
    auth: {
      api: {
        getSession: vi.fn(),
      },
    },
    env: process.env,
  })),
}));

describe('Middleware Chain Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should propagate context through full chain (authenticated)', async () => {
    const request = createMockRequest();
    const sessionData = mockAuthenticatedSession();

    // Mock getSession in loadConfig
    const mockConfig = loadConfigModule.loadConfig();
    vi.mocked(mockConfig.auth.api.getSession).mockResolvedValue(sessionData);

    // Simulate middleware chain
    let finalContext: any;

    // 1. Global middleware
    await globalMiddleware.server({
      request,
      next: async (ctx1) => {
        // 2. Auth middleware
        await authMiddleware.server({
          request,
          context: ctx1.context,
          next: async (ctx2) => {
            // 3. Protected middleware
            await protectedMiddleware.server({
              request,
              context: ctx2.context,
              next: async (ctx3) => {
                finalContext = ctx3.context;
                return { success: true };
              },
            });
          },
        });
      },
    });

    // Verify context has all expected values
    expect(finalContext.config).toBeDefined();
    expect(finalContext.session).toEqual(sessionData.session);
    expect(finalContext.user).toEqual(sessionData.user);
  });

  it('should stop at protected middleware when unauthenticated', async () => {
    const request = createMockRequest();
    const sessionData = mockUnauthenticatedSession();

    const mockConfig = loadConfigModule.loadConfig();
    vi.mocked(mockConfig.auth.api.getSession).mockResolvedValue(sessionData);

    const protectedHandler = vi.fn();

    try {
      await globalMiddleware.server({
        request,
        next: async (ctx1) => {
          await authMiddleware.server({
            request,
            context: ctx1.context,
            next: async (ctx2) => {
              await protectedMiddleware.server({
                request,
                context: ctx2.context,
                next: protectedHandler,
              });
            },
          });
        },
      });

      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.status).toBe(401);
      expect(protectedHandler).not.toHaveBeenCalled();
    }
  });

  it('should verify per-request isolation in chain', async () => {
    const request1 = createMockRequest({ url: 'http://localhost/api/test1' });
    const request2 = createMockRequest({ url: 'http://localhost/api/test2' });

    const sessionData = mockAuthenticatedSession();
    const mockConfig = loadConfigModule.loadConfig();
    vi.mocked(mockConfig.auth.api.getSession).mockResolvedValue(sessionData);

    let context1: any;
    let context2: any;

    // Request 1
    await globalMiddleware.server({
      request: request1,
      next: async (ctx) => {
        context1 = ctx.context.config;
        return { success: true };
      },
    });

    // Request 2
    await globalMiddleware.server({
      request: request2,
      next: async (ctx) => {
        context2 = ctx.context.config;
        return { success: true };
      },
    });

    // loadConfig should be called twice (per-request isolation)
    expect(loadConfigModule.loadConfig).toHaveBeenCalledTimes(2);
  });
});
```

**Verification**:
```bash
bun test src/test/integration/middleware-chain.test.ts
# Should show 3 passing tests
```

---

### Phase 4 Success Criteria

**Automated**:
- [ ] All global middleware tests pass (4 tests)
- [ ] All auth middleware tests pass (4 tests)
- [ ] All protected middleware tests pass (4 tests)
- [ ] Middleware chain integration tests pass (3 tests)
- [ ] Per-request isolation verified
- [ ] `bun test` completes in <10 seconds
- [ ] Coverage >80% for middleware files

**Manual**:
- [ ] Auth flow traced through all three middleware
- [ ] 401 errors verified with correct format
- [ ] Context propagation verified at each step

**Files Created**:
```
src/lib/server/middleware/global-middleware.test.ts
src/lib/server/middleware/auth-middleware.test.ts
src/lib/server/middleware/protected-middleware.test.ts
src/test/integration/middleware-chain.test.ts
```

---

## Phase 5: Client-Side Tests (Unit + Integration)

**Goal**: Test React hooks and client-side database operations

**Status**: ❌ Not Started
**Estimated Effort**: 10-15 hours
**Dependencies**: Phase 1 complete

---

### Deliverables

#### 5.1: Test Client Message Actions

**File**: `src/lib/client/actions/message-actions.test.ts`

**Code Under Test**: `src/lib/client/actions/message-actions.ts`
- `saveLocalMessages()` (lines 36-114)
- `getLocalMessages()` (lines 125-145)

**Requirements**:
- Test PGlite saves
- Test ownership verification
- Mock PGlite database or use in-memory instance
- Test `touchLocalChat()` side effect

**Implementation** (abbreviated):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveLocalMessages, getLocalMessages } from './message-actions';
// TODO: Import PGlite mocks

describe('Client Message Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveLocalMessages', () => {
    it('should save messages to PGlite', async () => {
      // TODO: Mock PGlite instance
      // TODO: Call saveLocalMessages
      // TODO: Verify PGlite insert called
    });

    it('should call touchLocalChat side effect', async () => {
      // TODO: Spy on touchLocalChat
      // TODO: Verify it's called
    });
  });

  describe('getLocalMessages', () => {
    it('should retrieve messages from PGlite', async () => {
      // TODO: Mock PGlite query result
      // TODO: Verify ownership check
    });

    it('should return empty array if chat not found', async () => {
      // TODO: Test edge case
    });
  });
});
```

**Note**: This requires setting up PGlite mocks or in-memory instances. May need additional research.

---

#### 5.2: Test Client Chat Actions

**File**: `src/lib/client/actions/chat-actions.test.ts`

**Code Under Test**: `src/lib/client/actions/chat-actions.ts`
- Similar to server chat actions but for PGlite

**Requirements**:
- Test CRUD operations on PGlite
- Test filter logic (lines 80-109)
- Mock PGlite

---

#### 5.3: Test Chat Streaming Hook

**File**: `src/lib/client/hooks/use-chat-stream.test.tsx`

**Code Under Test**: `src/lib/client/hooks/use-chat-stream.ts` (lines 30-216)

**Requirements**:
- Use `renderHook()` from React Testing Library
- Mock AI SDK `useChat` hook
- Test transport state management
- Test message persistence side effects
- Test auto-title generation

**Implementation** (abbreviated):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChatStream } from './use-chat-stream';

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    append: vi.fn(),
    isLoading: false,
    error: null,
  })),
}));

describe('useChatStream Hook', () => {
  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChatStream({ chatId: 'chat-123' }));
    expect(result.current.messages).toEqual([]);
  });

  it('should use custom transport', () => {
    // TODO: Verify transport is passed to useChat
  });

  it('should save messages after stream completes', async () => {
    // TODO: Mock saveLocalMessages
    // TODO: Trigger stream completion
    // TODO: Verify saveLocalMessages called
  });

  it('should auto-generate title for new chats', async () => {
    // TODO: Mock title generation
    // TODO: Verify updateLocalChatTitle called
  });
});
```

---

#### 5.4: Test OpenRouter Transport

**File**: `src/lib/client/transports/openrouter-transport.test.ts`

**Code Under Test**: `src/lib/client/transports/openrouter-transport.ts` (lines 15-111)

**Requirements**:
- Test `sendMessages()` conversion and streaming
- Mock OpenRouter provider
- Test abort signal handling
- Test error propagation

**Implementation** (abbreviated):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { openRouterTransport } from './openrouter-transport';

describe('OpenRouter Transport', () => {
  it('should convert UIMessages to OpenRouter format', async () => {
    // TODO: Mock streamText
    // TODO: Verify message conversion
  });

  it('should handle streaming responses', async () => {
    // TODO: Mock stream
    // TODO: Verify chunks emitted
  });

  it('should respect abort signal', async () => {
    // TODO: Test abort signal
  });
});
```

---

### Phase 5 Success Criteria

**Automated**:
- [ ] Client message action tests pass
- [ ] Client chat action tests pass
- [ ] Chat streaming hook tests pass
- [ ] OpenRouter transport tests pass
- [ ] Coverage >60% for client-side code
- [ ] `bun test` completes in <20 seconds

**Manual**:
- [ ] PGlite operations verified
- [ ] React hook state transitions validated
- [ ] Streaming behavior simulated correctly

**Files Created**:
```
src/lib/client/actions/message-actions.test.ts
src/lib/client/actions/chat-actions.test.ts
src/lib/client/hooks/use-chat-stream.test.tsx
src/lib/client/transports/openrouter-transport.test.ts
```

---

## Phase 6: E2E Tests (Optional)

**Goal**: Test critical user journeys in a real browser

**Status**: ❌ Not Started
**Estimated Effort**: 8-12 hours
**Dependencies**: Phase 1-5 complete (optional)

---

### Deliverables

#### 6.1: Install Playwright

```bash
bun add -D @playwright/test
bunx playwright install
```

**Create**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

#### 6.2: Create E2E Tests

**File**: `e2e/auth-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login and access dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
```

---

**File**: `e2e/chat-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create new chat and send message', async ({ page }) => {
    // Click "New Chat"
    await page.click('text=New Chat');
    await expect(page).toHaveURL(/\/dashboard\/c\/.+/);

    // Type a message
    await page.fill('textarea[placeholder*="message"]', 'Hello, AI!');
    await page.press('textarea', 'Enter');

    // Wait for AI response
    await expect(page.locator('[data-testid="message"]')).toHaveCount(2, {
      timeout: 15000,
    });
  });

  test('should display chat history', async ({ page }) => {
    // Navigate to existing chat
    await page.click('[data-testid="chat-item"]');

    // Verify messages displayed
    const messages = page.locator('[data-testid="message"]');
    await expect(messages.first()).toBeVisible();
  });
});
```

---

### Phase 6 Success Criteria

**Automated**:
- [ ] Auth flow E2E test passes
- [ ] Chat flow E2E test passes
- [ ] Tests run in Chromium
- [ ] `bunx playwright test` passes

**Manual**:
- [ ] Test database seeded with test data
- [ ] OpenRouter API mocked at network level (or use real key for tests)
- [ ] Tests isolated (each test independent)

**Files Created**:
```
playwright.config.ts
e2e/auth-flow.spec.ts
e2e/chat-flow.spec.ts
```

---

## Testing Patterns & Examples

### Server Action Test Pattern (Reference)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myServerAction } from './my-server-action';
import { createMockContext } from '@/test/utils/test-helpers';
import { createMockDb } from '@/test/mocks/db.mock';

describe('myServerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform action successfully', async () => {
    const mockDb = createMockDb();
    mockDb.limit.mockResolvedValue([{ id: '1', name: 'Test' }]);

    const context = createMockContext({
      user: { id: 'user-123' },
      config: { db: mockDb },
    });

    const result = await myServerAction({
      context,
      data: { inputField: 'value' },
    });

    expect(result).toBeDefined();
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should throw if user unauthorized', async () => {
    const context = createMockContext({ user: null });

    await expect(
      myServerAction({ context, data: {} })
    ).rejects.toThrow();
  });
});
```

---

### React Hook Test Pattern (Reference)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyHook } from './use-my-hook';

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    append: vi.fn(),
  })),
}));

describe('useMyHook', () => {
  it('should initialize correctly', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.data).toBeNull();
  });

  it('should update state on action', async () => {
    const { result } = renderHook(() => useMyHook());

    result.current.triggerAction();

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
  });
});
```

---

### Middleware Test Pattern (Reference)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myMiddleware } from './my-middleware';
import { createMockRequest } from '@/test/utils/test-helpers';

describe('myMiddleware', () => {
  it('should add value to context', async () => {
    const request = createMockRequest();
    let capturedContext: any;

    const next = vi.fn((ctx) => {
      capturedContext = ctx.context;
      return Promise.resolve({ success: true });
    });

    await myMiddleware.server({ request, next });

    expect(capturedContext.myValue).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
```

---

## Progress Tracking

### Overall Status

| Phase | Status | Tests Written | Coverage | Notes |
|-------|--------|---------------|----------|-------|
| Phase 1: Infrastructure | ✅ Complete | 6/6 | 100% | All files created, tests passing |
| Phase 2: Pure Functions | ❌ Not Started | 0/20 | 0% | - |
| Phase 3: Server Actions | ❌ Not Started | 0/35 | 0% | - |
| Phase 4: Middleware | ❌ Not Started | 0/15 | 0% | - |
| Phase 5: Client-Side | ❌ Not Started | 0/20 | 0% | - |
| Phase 6: E2E (Optional) | ❌ Not Started | 0/5 | 0% | - |
| **TOTAL** | **6%** | **6/101** | **6%** | Phase 1 complete |

---

### Phase Completion Checklist

#### Phase 1: Infrastructure ✅
- [x] `vitest.config.ts` created ✅
- [x] `src/test/setup.ts` created ✅
- [x] `src/test/utils/test-helpers.ts` created ✅
- [x] `src/test/mocks/db.mock.ts` created ✅
- [x] `src/test/mocks/auth.mock.ts` created ✅
- [x] `src/test/mocks/external-apis.mock.ts` created ✅
- [x] `src/test/example.test.ts` passing ✅
- [x] `bun test` runs without errors ✅

#### Phase 2: Pure Functions ✅/❌
- [ ] `src/lib/server/utils/encryption.test.ts` (15+ tests)
- [ ] `src/lib/utils.test.ts` (5+ tests)
- [ ] All tests passing
- [ ] Coverage >90% for encryption.ts

#### Phase 3: Server Actions ✅/❌
- [ ] `src/lib/server/actions/api-key-actions.test.ts` (14+ tests)
- [ ] `src/lib/server/actions/message-actions.test.ts` (11+ tests)
- [ ] `src/lib/server/actions/chat-actions.test.ts` (10+ tests)
- [ ] All tests passing
- [ ] Coverage >70% for action files

#### Phase 4: Middleware ✅/❌
- [ ] `src/lib/server/middleware/global-middleware.test.ts` (4 tests)
- [ ] `src/lib/server/middleware/auth-middleware.test.ts` (4 tests)
- [ ] `src/lib/server/middleware/protected-middleware.test.ts` (4 tests)
- [ ] `src/test/integration/middleware-chain.test.ts` (3 tests)
- [ ] All tests passing
- [ ] Coverage >80% for middleware

#### Phase 5: Client-Side ✅/❌
- [ ] `src/lib/client/actions/message-actions.test.ts`
- [ ] `src/lib/client/actions/chat-actions.test.ts`
- [ ] `src/lib/client/hooks/use-chat-stream.test.tsx`
- [ ] `src/lib/client/transports/openrouter-transport.test.ts`
- [ ] All tests passing
- [ ] Coverage >60% for client code

#### Phase 6: E2E (Optional) ✅/❌
- [ ] Playwright installed
- [ ] `playwright.config.ts` created
- [ ] `e2e/auth-flow.spec.ts` passing
- [ ] `e2e/chat-flow.spec.ts` passing
- [ ] All E2E tests passing

---

### Commands Reference

```bash
# Run all tests
bun test

# Run specific test file
bun test src/lib/server/utils/encryption.test.ts

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Run tests matching pattern
bun test -t "encryption"

# Run E2E tests (Phase 6)
bunx playwright test

# Open Playwright UI
bunx playwright test --ui

# Type checking
bun typecheck

# Linting
bun lint
bun lint:fix
```

---

## Appendix

### Key Files Reference

**Server Actions**:
- `src/lib/server/actions/api-key-actions.ts` - API key CRUD
- `src/lib/server/actions/message-actions.ts` - Message persistence
- `src/lib/server/actions/chat-actions.ts` - Chat CRUD
- `src/lib/server/actions/folder-actions.ts` - Folder CRUD
- `src/lib/server/actions/model-actions.ts` - Model operations

**Middleware**:
- `src/lib/server/middleware/global-middleware.ts` - Config loading
- `src/lib/server/middleware/auth-middleware.ts` - Session loading
- `src/lib/server/middleware/protected-middleware.ts` - Auth enforcement

**Database**:
- `src/lib/server/db/index.ts` - Database connection factory
- `src/lib/server/db/schema.ts` - Schema definitions
- `src/lib/server/loadConfig.ts` - Per-request config loader

**Utilities**:
- `src/lib/server/utils/encryption.ts` - Encryption/decryption
- `src/lib/utils.ts` - Shared utilities

**Client**:
- `src/lib/client/hooks/use-chat-stream.ts` - Chat streaming hook
- `src/lib/client/actions/message-actions.ts` - PGlite message operations
- `src/lib/client/transports/openrouter-transport.ts` - OpenRouter API client

---

### Testing Best Practices

1. **Test naming**: Use descriptive names that explain the scenario
   - ✅ `should encrypt and return base64 format`
   - ❌ `test encryption`

2. **AAA pattern**: Arrange, Act, Assert
   ```typescript
   it('should save new chat', async () => {
     // Arrange
     const mockDb = createMockDb();
     const context = createMockContext();

     // Act
     const result = await createChat({ context, data: { modelId: 'gpt-4' } });

     // Assert
     expect(result.id).toBeDefined();
   });
   ```

3. **Mock at boundaries**: Mock external dependencies (DB, APIs), test business logic
4. **One assertion per test** (when possible): Makes failures easier to diagnose
5. **Test edge cases**: Empty inputs, null values, errors, race conditions
6. **Clean up**: Use `beforeEach` to reset mocks, avoid test interdependence

---

### Common Pitfalls

1. **Forgetting to mock environment variables**: Set in `setup.ts`
2. **Not clearing mocks between tests**: Use `vi.clearAllMocks()` in `beforeEach`
3. **Testing implementation details**: Test behavior, not internal structure
4. **Overly complex mocks**: Keep mocks simple and focused
5. **Not testing error cases**: Always test unhappy paths
6. **Skipping type checking**: Run `bun typecheck` regularly

---

### Resources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/)
- [Playwright Docs](https://playwright.dev/)
- [TanStack Start Testing Guide](https://tanstack.com/start/latest)
- [AI SDK Testing Patterns](https://sdk.vercel.ai/docs)

---

**End of Testing PRD**

Last Updated: 2025-11-24
Version: 1.0