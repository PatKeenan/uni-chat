import { nanoid } from "nanoid";
import { vi } from "vitest";
import type { session, user } from "@/server/db/schema";

// ============================================================
// Mock Factories
// ============================================================

export function createMockUser(
	overrides?: Partial<typeof user.$inferSelect>,
): typeof user.$inferSelect {
	return {
		id: nanoid(),
		email: "test@example.com",
		emailVerified: false,
		name: "Test User",
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function createMockSession(
	overrides?: Partial<typeof session.$inferSelect>,
): typeof session.$inferSelect {
	return {
		id: nanoid(),
		userId: nanoid(),
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h from now
		token: nanoid(),
		ipAddress: "127.0.0.1",
		userAgent: "test-agent",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function createMockContext(overrides?: {
	user?: typeof user.$inferSelect | null;
	session?: typeof session.$inferSelect | null;
	config?: any;
}) {
	const user =
		overrides?.user !== undefined ? overrides.user : createMockUser();
	const session =
		overrides?.session !== undefined ? overrides.session : createMockSession();

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
	const url = options?.url || "http://localhost:3000/api/test";
	const method = options?.method || "GET";
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
		orderBy: vi.fn().mockReturnThis(),
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
		selectedModel: "openai/gpt-4",
		folderId: null,
		title: "Test Chat",
		pinned: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function createTestMessage(overrides?: any) {
	return {
		id: nanoid(),
		chatId: nanoid(),
		role: "user" as const,
		createdAt: new Date(),
		order: 0,
		...overrides,
	};
}

export function createTestMessagePart(overrides?: any) {
	return {
		id: nanoid(),
		messageId: nanoid(),
		type: "text" as const,
		textContent: "Test message content",
		order: 0,
		createdAt: new Date(),
		toolCallId: null,
		toolCallName: null,
		toolCallArgs: null,
		toolResultId: null,
		toolResultContent: null,
		providerMetadata: null,
		...overrides,
	};
}
