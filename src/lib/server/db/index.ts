import { createServerOnlyFn } from "@tanstack/react-start";
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Create a database connection per request to avoid Cloudflare Workers I/O isolation issues
// Each request must have its own isolated connection
export const createDb = createServerOnlyFn(() => {
	// postgres-js is serverless-compatible and works in Cloudflare Workers
	// max: 1 is important for serverless to avoid connection pool issues
	const client = postgres(process.env.DATABASE_URL!, {
		max: 1,
		idle_timeout: 20,
		connect_timeout: 10,
	});
	return drizzle(client);
});
