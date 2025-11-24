import { afterEach, vi } from 'vitest';
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
