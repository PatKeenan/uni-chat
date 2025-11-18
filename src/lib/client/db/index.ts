/**
 * Client-side database using PGlite
 *
 * This module provides a singleton PGlite instance that runs PostgreSQL
 * in the browser using WebAssembly and persists data to IndexedDB.
 *
 * IMPORTANT: This is completely separate from the server database.
 * - Server DB: Remote PostgreSQL (auth only)
 * - Client DB: Local PGlite (chats, messages, folders, API keys)
 */

import { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

// Singleton instance
let clientDb: PgliteDatabase<typeof schema> | null = null;
let pgliteClient: PGlite | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the client database
 * - Creates PGlite instance with IndexedDB persistence
 * - Runs migrations (will be added in next step)
 * - Creates Drizzle instance
 */
async function initializeClientDb(): Promise<void> {
  if (clientDb) {
    return;
  }

  console.log("[ClientDB] Initializing PGlite database...");

  try {
    // Using IndexedDB for persistent storage
    console.log(
      "[ClientDB] Creating PGlite instance with IndexedDB persistence..."
    );
    pgliteClient = await PGlite.create({
      dataDir: "idb://uni-chat-local",
    });
    console.log(
      "[ClientDB] PGlite instance created with IndexedDB persistence"
    );

    // Run migrations before creating Drizzle instance
    console.log("[ClientDB] Running migrations...");
    const { runMigrations } = await import("./migrations");
    await runMigrations(pgliteClient);
    console.log("[ClientDB] Migrations complete");

    // Create Drizzle instance
    console.log("[ClientDB] Creating Drizzle instance...");
    clientDb = drizzle(pgliteClient, { schema });

    console.log("[ClientDB] Database initialized successfully");
  } catch (error) {
    console.error("[ClientDB] Failed to initialize database:", error);
    // Reset state on error
    clientDb = null;
    pgliteClient = null;
    initPromise = null;
    throw new Error(
      "Failed to initialize client database. Please refresh the page."
    );
  }
}

/**
 * Get the client database instance
 *
 * This function ensures the database is initialized before returning it.
 * Safe to call from anywhere in the client code.
 *
 * @returns Drizzle database instance
 * @throws Error if initialization fails
 */
export async function getClientDb(): Promise<PgliteDatabase<typeof schema>> {
  // If not initialized, start initialization
  if (!clientDb) {
    if (!initPromise) {
      initPromise = initializeClientDb();
    }
    await initPromise;
  }

  if (!clientDb) {
    throw new Error("Client database not initialized");
  }

  return clientDb;
}

/**
 * Get the raw PGlite client
 *
 * Useful for running raw SQL queries or accessing PGlite-specific features.
 * Most of the time you should use getClientDb() instead.
 *
 * @returns PGlite client instance
 */
export async function getPgliteClient(): Promise<PGlite> {
  // Ensure database is initialized
  await getClientDb();

  if (!pgliteClient) {
    throw new Error("PGlite client not initialized");
  }

  return pgliteClient;
}

/**
 * Reset the client database
 *
 * This will:
 * 1. Close the current database connection
 * 2. Delete the IndexedDB database
 * 3. Reset the singleton instance
 *
 * Used for:
 * - User logout
 * - Clearing all local data
 * - Testing
 */
export async function resetClientDb(): Promise<void> {
  try {
    console.log("[ClientDB] Resetting database...");

    // Reset singleton instances
    clientDb = null;
    pgliteClient = null;
    initPromise = null;

    // Delete IndexedDB database
    if (typeof indexedDB !== "undefined") {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("uni-chat-local");
        request.onsuccess = () => {
          console.log("[ClientDB] IndexedDB deleted successfully");
          resolve();
        };
        request.onerror = () => {
          console.error(
            "[ClientDB] Failed to delete IndexedDB:",
            request.error
          );
          reject(request.error);
        };
        request.onblocked = () => {
          console.warn(
            "[ClientDB] Database deletion blocked. Close all tabs and try again."
          );
          reject(new Error("Database deletion blocked"));
        };
      });
    }

    console.log("[ClientDB] Database reset complete");
  } catch (error) {
    console.error("[ClientDB] Error resetting database:", error);
    throw error;
  }
}

/**
 * Get storage usage information
 *
 * Returns information about IndexedDB storage usage.
 * Useful for showing users how much space they're using.
 *
 * @returns Storage usage stats
 */
export async function getStorageUsage(): Promise<{
  used: number;
  quota: number;
  percentUsed: number;
}> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (used / quota) * 100 : 0;

      return {
        used,
        quota,
        percentUsed,
      };
    } catch (error) {
      console.error("[ClientDB] Failed to get storage estimate:", error);
    }
  }

  return {
    used: 0,
    quota: 0,
    percentUsed: 0,
  };
}

/**
 * Check if storage quota is approaching limit
 *
 * @param thresholdPercent - Alert if usage exceeds this percentage (default: 80)
 * @returns true if approaching limit
 */
export async function isStorageNearLimit(
  thresholdPercent = 80
): Promise<boolean> {
  const { percentUsed } = await getStorageUsage();
  return percentUsed >= thresholdPercent;
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
