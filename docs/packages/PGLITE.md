# PGlite Documentation

**Package:** `@electric-sql/pglite`
**Version:** Latest
**Purpose:** PostgreSQL compiled to WebAssembly for running in the browser
**Last Updated:** 2025-11-17

---

## Table of Contents
1. [Overview](#overview)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Configuration](#configuration)
5. [Drizzle Integration](#drizzle-integration)
6. [Migrations](#migrations)
7. [Storage Options](#storage-options)
8. [Limitations](#limitations)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is PGlite?

PGlite is PostgreSQL compiled to WebAssembly that runs entirely in the browser. It's **actual PostgreSQL**, not a compatibility layer or emulation.

**Key Features:**
- Full PostgreSQL 16.3 (as of latest version)
- Runs in browser via WebAssembly
- ~2.6MB gzipped bundle size
- Persistent storage via IndexedDB or OPFS
- Same SQL syntax as server PostgreSQL
- Single-user, single-connection mode
- No network required once loaded

**When to Use:**
- Local-first applications
- Offline-capable apps
- Privacy-focused applications
- Client-side caching
- Development/prototyping

**When NOT to Use:**
- Multi-user collaboration
- Large datasets (>100MB)
- As primary database for server apps
- When you need multi-connection support

---

## Installation

```bash
pnpm add @electric-sql/pglite
```

**Bundle Size Consideration:**
- PGlite is ~2.6MB gzipped
- Consider code splitting if needed
- Bundle is cached after first load

---

## Basic Usage

### In-Memory Database (Ephemeral)

```typescript
import { PGlite } from '@electric-sql/pglite';

// Create in-memory database (lost on page refresh)
const db = new PGlite();

// Execute SQL
await db.exec('CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);');
await db.exec("INSERT INTO users (name) VALUES ('Alice');");

// Query data
const result = await db.query('SELECT * FROM users;');
console.log(result.rows); // [{ id: 1, name: 'Alice' }]
```

### Persistent Database (IndexedDB)

```typescript
import { PGlite } from '@electric-sql/pglite';

// Create database with IndexedDB persistence
const db = await PGlite.create({
  dataDir: 'idb://my-database-name'
});

// Data persists across page reloads
await db.exec('CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT);');
```

**Important:** Use `PGlite.create()` (async) for persistent databases, not the constructor.

---

## Configuration

### Constructor Options

```typescript
interface PGliteOptions {
  dataDir?: string;           // Storage location (idb:// or file path)
  relaxedDurability?: boolean; // Default: false
}
```

### Storage Location (`dataDir`)

**In-Memory (Default):**
```typescript
const db = new PGlite(); // No dataDir = in-memory
```

**IndexedDB (Recommended for browser):**
```typescript
const db = await PGlite.create({
  dataDir: 'idb://my-app-name'
});
```

**OPFS (Origin Private File System):**
```typescript
const db = await PGlite.create({
  dataDir: 'opfs://my-app-name'
});
```

**Note:** IndexedDB is recommended over OPFS because:
- Better browser support (Safari compatible)
- More reliable
- Easier to inspect/debug

### Relaxed Durability

```typescript
const db = await PGlite.create({
  dataDir: 'idb://my-db',
  relaxedDurability: true  // Faster writes, less crash-safe
});
```

**When to use:**
- Development/testing
- When you have external backups
- Performance is critical

**When NOT to use:**
- Production without backups
- Critical user data

---

## Drizzle Integration

### Setup with Drizzle ORM

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

// Initialize PGlite client
const client = await PGlite.create({
  dataDir: 'idb://uni-chat-local'
});

// Create Drizzle instance
const db = drizzle({ client, schema });

// Use Drizzle query API (same as server!)
const chats = await db.query.chat.findMany({
  where: (chat, { eq }) => eq(chat.userId, userId),
  orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
});
```

### Schema Definition

**Same schema works for both server and client!**

```typescript
// src/lib/shared/db/schema/chat.ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const chat = pgTable('chat', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title'),
  selectedModel: text('selected_model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  pinned: boolean('pinned').default(false).notNull(),
});
```

**Use in both:**
```typescript
// Server: drizzle-orm/postgres-js
import { drizzle } from 'drizzle-orm/postgres-js';
const serverDb = drizzle(postgresClient, { schema });

// Client: drizzle-orm/pglite
import { drizzle } from 'drizzle-orm/pglite';
const clientDb = drizzle(pgliteClient, { schema });
```

### Singleton Pattern (Recommended)

```typescript
// src/lib/client/db/index.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/shared/db/schema';

let clientDb: ReturnType<typeof drizzle> | null = null;
let initPromise: Promise<void> | null = null;

async function initializeClientDb() {
  if (clientDb) return;

  const client = await PGlite.create({
    dataDir: 'idb://uni-chat-local',
  });

  clientDb = drizzle({ client, schema });
}

export async function getClientDb() {
  if (!clientDb) {
    if (!initPromise) {
      initPromise = initializeClientDb();
    }
    await initPromise;
  }

  if (!clientDb) {
    throw new Error('Client database not initialized');
  }

  return clientDb;
}
```

**Usage:**
```typescript
const db = await getClientDb();
const chats = await db.query.chat.findMany();
```

---

## Migrations

### Challenge

Standard `drizzle-kit migrate` uses Node.js APIs (`fs`, `path`) which don't work in the browser.

### Solution: JSON-Based Migrations

#### Step 1: Export Migrations Script

```typescript
// scripts/export-migrations.ts
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { writeFileSync } from 'fs';
import path from 'path';

const migrationsFolder = './drizzle/migrations';
const migrations = readMigrationFiles({ migrationsFolder });

writeFileSync(
  path.join(process.cwd(), `${migrationsFolder}/migrations.json`),
  JSON.stringify(migrations, null, 2)
);

console.log('✓ Migrations exported to migrations.json');
```

#### Step 2: Update package.json

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate && tsx scripts/export-migrations.ts"
  }
}
```

#### Step 3: Migration Runner (Browser)

```typescript
// src/lib/client/db/migrations.ts
import type { PGlite } from '@electric-sql/pglite';
import migrations from '../../../drizzle/migrations/migrations.json';

export async function runMigrations(client: PGlite) {
  // Create version tracking table
  await client.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Get current version
  const result = await client.query(
    'SELECT version FROM _migrations ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = result.rows[0]?.version || 0;

  // Apply pending migrations
  for (let i = currentVersion; i < migrations.length; i++) {
    try {
      await client.exec(migrations[i].sql);
      await client.query(
        'INSERT INTO _migrations (id, version) VALUES ($1, $2)',
        [i + 1, i + 1]
      );
      console.log(`✓ Applied migration ${i + 1}/${migrations.length}`);
    } catch (error) {
      console.error(`✗ Failed to apply migration ${i + 1}:`, error);
      throw error;
    }
  }

  console.log(`✓ All migrations applied (${migrations.length} total)`);
}
```

#### Step 4: Run Migrations on Init

```typescript
// src/lib/client/db/index.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { runMigrations } from './migrations';
import * as schema from '@/lib/shared/db/schema';

let clientDb: ReturnType<typeof drizzle> | null = null;

async function initializeClientDb() {
  const client = await PGlite.create({
    dataDir: 'idb://uni-chat-local'
  });

  // Run migrations BEFORE creating Drizzle instance
  await runMigrations(client);

  clientDb = drizzle({ client, schema });
}

export async function getClientDb() {
  if (!clientDb) {
    await initializeClientDb();
  }
  return clientDb!;
}
```

---

## Storage Options

### IndexedDB (`idb://`)

**Recommended for browser applications**

```typescript
const db = await PGlite.create({
  dataDir: 'idb://my-app-name'
});
```

**Pros:**
- ✅ Best browser support (Chrome, Firefox, Safari, Edge)
- ✅ Persists across sessions
- ✅ Can be inspected via browser DevTools
- ✅ Reliable

**Cons:**
- ❌ Storage quota limits (typically 50MB-1GB)
- ❌ Can be cleared by browser (low disk space, user action)

**Storage Limits:**
- Chrome: 60% of free disk space
- Firefox: 50% of free disk space
- Safari: 1GB limit
- Practical limit: Keep under 100MB for best performance

### OPFS (Origin Private File System)

```typescript
const db = await PGlite.create({
  dataDir: 'opfs://my-app-name'
});
```

**Pros:**
- ✅ Better performance than IndexedDB
- ✅ Higher storage limits

**Cons:**
- ❌ Not supported in Safari
- ❌ Harder to inspect/debug
- ❌ Less mature API

**Recommendation:** Use IndexedDB unless you need OPFS-specific features.

### In-Memory

```typescript
const db = new PGlite(); // No dataDir
```

**Pros:**
- ✅ Fastest performance
- ✅ No storage limits
- ✅ Good for testing

**Cons:**
- ❌ Data lost on page refresh
- ❌ Lost on browser close

**Use Cases:**
- Development/testing
- Temporary caching
- Session-only data

---

## Limitations

### Technical Limitations

**Single User Only:**
- One connection at a time
- Cannot be shared between tabs
- Each tab gets its own database instance

**No Multi-Process:**
- Cannot fork processes (WASM limitation)
- Single-threaded execution

**Size Constraints:**
- Maximum 16GB WebAssembly memory limit
- Practical limit: Keep databases under 100MB
- Storage quotas apply (IndexedDB/OPFS)

**Performance:**
- Slower than native PostgreSQL
- Complex queries may be slow
- Large datasets not recommended

### Browser Compatibility

**Minimum Requirements:**
- WebAssembly support
- IndexedDB support (for persistence)
- Modern browser (Chrome 11+, Firefox 4+, Safari 8+, Edge 12+)

**Not Supported:**
- Internet Explorer
- Very old browsers
- Some mobile browsers (limited testing)

### PostgreSQL Features

**Supported:**
- Most PostgreSQL 16.3 SQL features
- Transactions
- Indexes
- Foreign keys
- JSON/JSONB
- Full-text search
- Most extensions (built-in only)

**Not Supported:**
- Server-side extensions (C extensions)
- Replication
- Connection pooling (single connection)
- Listen/Notify
- Some advanced features

---

## Best Practices

### 1. Singleton Pattern

**Always use a singleton to avoid multiple instances:**

```typescript
// ✅ GOOD - Singleton
let db: PGlite | null = null;

export async function getDb() {
  if (!db) {
    db = await PGlite.create({ dataDir: 'idb://my-app' });
  }
  return db;
}

// ❌ BAD - Multiple instances
export async function getDb() {
  return await PGlite.create({ dataDir: 'idb://my-app' });
}
```

### 2. Initialize Early

**Load database during app initialization:**

```typescript
// App.tsx or main entry point
import { useEffect } from 'react';
import { getClientDb } from '@/lib/client/db';

export function App() {
  useEffect(() => {
    // Initialize database early
    getClientDb().catch(console.error);
  }, []);

  return <YourApp />;
}
```

### 3. Error Handling

**Always handle initialization errors:**

```typescript
export async function getClientDb() {
  try {
    if (!clientDb) {
      await initializeClientDb();
    }
    return clientDb!;
  } catch (error) {
    console.error('Failed to initialize client database:', error);
    // Show user-friendly error
    throw new Error('Database initialization failed. Please refresh the page.');
  }
}
```

### 4. Migration Safety

**Always version your migrations:**

```typescript
// Track which migrations have been applied
CREATE TABLE _migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// Never modify existing migrations
// Always create new migration files
```

### 5. Data Cleanup

**Provide users with data management:**

```typescript
export async function clearLocalData() {
  // Close connection if open
  if (clientDb) {
    clientDb = null;
  }

  // Delete IndexedDB
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('uni-chat-local');
    request.onsuccess = resolve;
    request.onerror = reject;
  });
}
```

### 6. Storage Monitoring

**Monitor storage usage:**

```typescript
export async function getStorageUsage() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentUsed: ((estimate.usage || 0) / (estimate.quota || 1)) * 100,
    };
  }
  return { used: 0, quota: 0, percentUsed: 0 };
}
```

### 7. Parameterized Queries

**Always use parameterized queries to avoid SQL injection:**

```typescript
// ✅ GOOD - Parameterized
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// ❌ BAD - String interpolation (SQL injection risk!)
const result = await db.query(
  `SELECT * FROM users WHERE id = ${userId}`
);
```

---

## Troubleshooting

### Database Not Persisting

**Problem:** Data disappears after refresh

**Solutions:**
1. Check you're using `idb://` prefix:
   ```typescript
   const db = await PGlite.create({ dataDir: 'idb://my-db' });
   ```

2. Verify IndexedDB is enabled in browser

3. Check browser console for quota errors

4. Verify you're using `PGlite.create()` not `new PGlite()`

### Slow Performance

**Problem:** Queries are slow

**Solutions:**
1. Add indexes:
   ```typescript
   await db.exec('CREATE INDEX idx_user_id ON chat (user_id);');
   ```

2. Limit result sets:
   ```typescript
   const chats = await db.query.chat.findMany({
     limit: 50,
     orderBy: (chat, { desc }) => [desc(chat.updatedAt)],
   });
   ```

3. Use transactions for bulk operations:
   ```typescript
   await db.exec('BEGIN;');
   // Multiple inserts
   await db.exec('COMMIT;');
   ```

### Storage Quota Exceeded

**Problem:** "QuotaExceededError" in console

**Solutions:**
1. Implement data pruning:
   ```typescript
   // Delete old messages
   await db.exec(`
     DELETE FROM message
     WHERE created_at < NOW() - INTERVAL '30 days'
   `);
   ```

2. Add export/import functionality

3. Warn user when approaching limit

### Migration Errors

**Problem:** Migrations fail to apply

**Solutions:**
1. Check migration SQL syntax (must be PostgreSQL-compatible)

2. Verify migration order:
   ```typescript
   // Migrations must be applied in order
   for (let i = currentVersion; i < migrations.length; i++) {
     await client.exec(migrations[i].sql);
   }
   ```

3. Reset database if corrupted:
   ```typescript
   await clearLocalData();
   window.location.reload();
   ```

### Can't Access from DevTools

**Problem:** Can't inspect database in browser

**Solution:** Use Drizzle Studio or create debug queries:
```typescript
// Add to window for debugging
if (process.env.NODE_ENV === 'development') {
  window.debugDb = async () => {
    const db = await getClientDb();
    const chats = await db.query.chat.findMany();
    console.table(chats);
  };
}
```

---

## Additional Resources

- [PGlite Official Docs](https://pglite.dev/)
- [PGlite GitHub](https://github.com/electric-sql/pglite)
- [ElectricSQL Community](https://discord.electric-sql.com/)
- [Drizzle + PGlite Docs](https://orm.drizzle.team/docs/connect-pglite)

---

**Last Updated:** 2025-11-17
**Status:** Complete
**Next:** See [DRIZZLE.md](./DRIZZLE.md) for ORM patterns
