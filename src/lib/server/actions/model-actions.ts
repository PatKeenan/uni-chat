import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { fetchOpenRouterModels } from "@/lib/openrouter/client";
import { apiKey as apiKeyTable, starredModel } from "../db/schema";
import { protectedMiddleware } from "../middleware/protected-middleware";
import { decryptApiKey } from "../utils/encryption";
/**
 * Fetches all available models from OpenRouter
 * Requires user to have an API key stored
 */
export const getOpenRouterModels = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;

    // Get user's API key directly from database
    const keyRecord = await db
      .select()
      .from(apiKeyTable)
      .where(eq(apiKeyTable.userId, context.user.id))
      .limit(1);

    if (!keyRecord || keyRecord.length === 0) {
      throw new Error("No API key found. Please add your OpenRouter API key.");
    }

    // Decrypt the API key
    const apiKey = await decryptApiKey(keyRecord[0].encryptedKey);

    // Fetch models from OpenRouter
    const response = await fetchOpenRouterModels(apiKey);

    return response;
  });

/**
 * Stars/favorites a model for quick access
 */
export const starModel = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(
    z.object({
      modelId: z.string(),
      modelName: z.string(),
      provider: z.string(),
      contextLength: z.number().optional(),
      pricingPrompt: z.number().optional(),
      pricingCompletion: z.number().optional(),
    })
  )
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    // Get current max order for user's starred models
    const models = await db
      .select()
      .from(starredModel)
      .where(eq(starredModel.userId, context.user.id))
      .orderBy(asc(starredModel.order));

    const maxOrder =
      models.length > 0 ? Math.max(...models.map((m) => m.order)) : -1;

    const newStarredModel = {
      id: nanoid(),
      userId: context.user.id,
      modelId: data.modelId,
      modelName: data.modelName,
      provider: data.provider,
      contextLength: data.contextLength || null,
      pricingPrompt: data.pricingPrompt?.toString() || null,
      pricingCompletion: data.pricingCompletion?.toString() || null,
      order: maxOrder + 1,
    };

    await db.insert(starredModel).values(newStarredModel);

    return newStarredModel;
  });

/**
 * Unstars/removes a model from favorites
 */
export const unstarModel = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ modelId: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    await db
      .delete(starredModel)
      .where(
        and(
          eq(starredModel.modelId, data.modelId),
          eq(starredModel.userId, context.user.id)
        )
      );

    return { success: true };
  });

/**
 * Gets all starred models for the current user
 */
export const getStarredModels = createServerFn()
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { db } = context.config;

    const models = await db
      .select()
      .from(starredModel)
      .where(eq(starredModel.userId, context.user.id))
      .orderBy(asc(starredModel.order));

    return models;
  });

/**
 * Reorders starred models
 */
export const reorderStarredModels = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ modelIds: z.array(z.string()) }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    // Update the order of each model
    for (let i = 0; i < data.modelIds.length; i++) {
      await db
        .update(starredModel)
        .set({ order: i })
        .where(
          and(
            eq(starredModel.modelId, data.modelIds[i]),
            eq(starredModel.userId, context.user.id)
          )
        );
    }

    return { success: true };
  });

/**
 * Checks if a model is starred by the current user
 */
export const isModelStarred = createServerFn()
  .middleware([protectedMiddleware])
  .inputValidator(z.object({ modelId: z.string() }))
  .handler(async ({ context, data }) => {
    const { db } = context.config;

    const result = await db
      .select({ id: starredModel.id })
      .from(starredModel)
      .where(
        and(
          eq(starredModel.modelId, data.modelId),
          eq(starredModel.userId, context.user.id)
        )
      )
      .limit(1);

    return result.length > 0;
  });
