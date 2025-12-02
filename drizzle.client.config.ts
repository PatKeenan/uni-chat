/**
 * Drizzle Kit Configuration for Client Database
 *
 * This config generates migrations for the CLIENT database (PGlite in browser).
 * It only includes client-side tables (chat, message, folder, etc.)
 *
 * Server database uses the main drizzle.config.ts
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/client/db/schema/client-only.ts",
	out: "./drizzle/migrations-client",
});
