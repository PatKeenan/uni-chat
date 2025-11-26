import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { fetchOpenRouterModels } from "@/lib/openrouter/client";
import { apiKey } from "../db/schema";
import { protectedMiddleware } from "../middleware/protected-middleware";
import { decryptApiKey, encryptApiKey } from "../utils/encryption";
/**
 * Saves or updates a user's OpenRouter API key
 * Encrypts the key before storing in the database
 */
export const saveApiKey = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ apiKey: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;
    const encrypted = await encryptApiKey(data.apiKey);

    // Check if user already has an API key
    const existing = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, context.user.id))
      .limit(1);

    if (existing[0]) {
      // Update existing key
      await db
        .update(apiKey)
        .set({
          encryptedKey: encrypted,
          lastUsedAt: new Date(),
        })
        .where(eq(apiKey.userId, context.user.id));
    } else {
      // Insert new key
      await db.insert(apiKey).values({
        id: nanoid(),
        userId: context.user.id,
        encryptedKey: encrypted,
      });
    }

    return { success: true };
  });

/**
 * Retrieves and decrypts the user's OpenRouter API key
 * Returns null if no key is stored
 */
export const getApiKey = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;

    const result = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, context.user.id))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    // Update last used timestamp
    await db
      .update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.userId, context.user.id));

    const decrypted = await decryptApiKey(result[0].encryptedKey);
    return decrypted;
  });

/**
 * Deletes the user's stored OpenRouter API key
 */
export const deleteApiKey = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;

    await db.delete(apiKey).where(eq(apiKey.userId, context.user.id));

    return { success: true };
  });

/**
 * Validates an OpenRouter API key by attempting to fetch models
 * Returns success status and error message if invalid
 */
export const validateApiKey = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator((data: { apiKey: string }) => data)
  .handler(async ({ data }) => {
    try {
      // Attempt to fetch models to validate the key
      await fetchOpenRouterModels(data.apiKey);
      return { valid: true, error: null };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error
            ? error.message
            : "Invalid API key or network error",
      };
    }
  });

/**
 * Checks if the user has an API key stored
 * Returns boolean without decrypting the key
 */
export const hasApiKey = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;

    const result = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(eq(apiKey.userId, context.user.id))
      .limit(1);

    return result.length > 0;
  });
