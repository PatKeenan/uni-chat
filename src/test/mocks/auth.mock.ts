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
