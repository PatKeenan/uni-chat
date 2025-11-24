import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactStartCookies } from "better-auth/react-start";
import type { createDb } from "../db"; // your drizzle instance factory
import * as schema from "../db/schema";

// Create auth instance factory that uses per-request database connections
// This is required for Cloudflare Workers I/O isolation
export const getAuth = (db: ReturnType<typeof createDb>) => {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: {
				...schema,
			},
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [reactStartCookies()],
	});
};

// Note: Do not export a module-level auth instance
// Always use getAuth() to create a per-request auth instance
// This is required for Cloudflare Workers I/O isolation
