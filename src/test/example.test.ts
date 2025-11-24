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

  it('should mock database calls', () => {
    const db = createMockDb();
    db.limit.mockResolvedValue([{ id: '1', email: 'test@example.com' }]);

    db.select().from('user').limit(10);

    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalled();
    expect(db.limit).toHaveBeenCalledWith(10);
  });

  it('should support vitest spies', () => {
    const mockFn = vi.fn((x: number) => x * 2);
    expect(mockFn(5)).toBe(10);
    expect(mockFn).toHaveBeenCalledWith(5);
  });
});
