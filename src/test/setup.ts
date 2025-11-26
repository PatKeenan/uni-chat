import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
// @ts-expect-error: Ignore type error for testing-library/jest-dom/vitest
import "@testing-library/jest-dom/vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Set up environment variables for tests
process.env.BETTER_AUTH_SECRET =
  "test-secret-key-for-encryption-minimum-32-chars";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

// Note: Global console mocking removed to aid debugging.
// If specific tests need to suppress output, mock console locally within those tests:
// const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
// ... test code ...
// consoleError.mockRestore();
