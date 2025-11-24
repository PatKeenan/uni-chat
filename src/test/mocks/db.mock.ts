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
  users?: unknown[];
  chats?: unknown[];
  messages?: unknown[];
  apiKeys?: unknown[];
}) {
  const db = createMockDb();

  // Configure limit to return data based on previous calls
  db.limit.mockImplementation(() => {
    // This is a simplified version - can be enhanced based on actual usage
    if (data.users) return Promise.resolve(data.users);
    if (data.chats) return Promise.resolve(data.chats);
    if (data.messages) return Promise.resolve(data.messages);
    if (data.apiKeys) return Promise.resolve(data.apiKeys);
    return Promise.resolve([]);
  });

  return db;
}

// TODO: For Phase 4 (Integration Tests)
// export async function createInMemoryDb() {
//   // Set up in-memory SQLite with Drizzle
//   // Run migrations
//   // Return real Drizzle instance
// }
