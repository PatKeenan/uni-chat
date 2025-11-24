/**
 * Export Drizzle migrations to JSON for browser use
 *
 * This script:
 * 1. Reads all migration files from drizzle/migrations
 * 2. Exports them as a JSON array
 * 3. Saves to drizzle/migrations/migrations.json
 *
 * The JSON file can then be imported in the browser and applied to PGlite.
 *
 * Run this script automatically after `pnpm db:generate`
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";

const MIGRATIONS_FOLDER = "./drizzle/migrations-client";

try {
	console.log("📦 Exporting migrations to JSON...");

	// Read all migration files
	const migrations = readMigrationFiles({
		migrationsFolder: MIGRATIONS_FOLDER,
	});

	console.log(`✓ Found ${migrations.length} migration(s)`);

	// Export to JSON
	const outputPath = path.join(
		process.cwd(),
		MIGRATIONS_FOLDER,
		"migrations.json",
	);

	writeFileSync(outputPath, JSON.stringify(migrations, null, 2));

	console.log(`✓ Migrations exported to ${outputPath}`);
	console.log("\n✅ Migration export complete!");
} catch (error) {
	console.error("❌ Failed to export migrations:", error);
	process.exit(1);
}
