/**
 * Client-Side Model Actions
 *
 * These functions interact with the local PGlite database to manage starred models.
 * All operations are purely client-side - no server communication.
 *
 * For fetching OpenRouter models, we call the API directly from the client.
 */

import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getClientDb } from "@/client/db";
import { starredModel } from "@/client/db/schema";
import { fetchOpenRouterModels } from "@/lib/openrouter/client";

// ==================== Schemas ====================

export const GetOpenRouterModelsSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

export const StarModelSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  modelId: z.string().min(1, "Model ID is required"),
  modelName: z.string().min(1, "Model name is required"),
  provider: z.string().min(1, "Provider is required"),
  contextLength: z.number().optional(),
  pricingPrompt: z.number().optional(),
  pricingCompletion: z.number().optional(),
  supportsToolCalls: z.boolean().optional(),
  // Full model metadata from OpenRouter for capability detection
  metadata: z.any().optional(),
});

export const UnstarModelSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  modelId: z.string().min(1, "Model ID is required"),
});

export const GetStarredModelsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const ReorderStarredModelsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  modelIds: z.array(z.string()),
});

export const IsModelStarredSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  modelId: z.string().min(1, "Model ID is required"),
});

// ==================== Types ====================

export type GetOpenRouterModelsInput = z.infer<
  typeof GetOpenRouterModelsSchema
>;
// Use schema inference for StarModelInput to allow numbers for pricing fields
// (they get converted to strings in the starModel function)
export type StarModelInput = z.infer<typeof StarModelSchema>;
export type UnstarModelInput = z.infer<typeof UnstarModelSchema>;
export type GetStarredModelsInput = z.infer<typeof GetStarredModelsSchema>;
export type ReorderStarredModelsInput = z.infer<
  typeof ReorderStarredModelsSchema
>;
export type IsModelStarredInput = z.infer<typeof IsModelStarredSchema>;

// ==================== Actions ====================

/**
 * Fetches all available models from OpenRouter
 * Requires user to have an API key
 *
 * @param input - Contains the OpenRouter API key
 * @returns Promise with models data from OpenRouter
 */
export async function getOpenRouterModels(input: GetOpenRouterModelsInput) {
  const { apiKey } = GetOpenRouterModelsSchema.parse(input);
  const response = await fetchOpenRouterModels(apiKey);
  return response;
}

/**
 * Stars/favorites a model for quick access
 *
 * @param input - Model data to star including userId
 * @returns The newly created starred model record
 */
export async function starModel(input: StarModelInput) {
  const data = StarModelSchema.parse(input);
  const db = await getClientDb();

  // Get current max order for user's starred models
  try {
    const models = await db
      .select()
      .from(starredModel)
      .where(eq(starredModel.userId, data.userId))
      .orderBy(asc(starredModel.order));

    const maxOrder =
      models.length > 0 ? Math.max(...models.map((m) => m.order)) : -1;

    const newStarredModel = {
      id: nanoid(),
      userId: data.userId,
      modelId: data.modelId,
      modelName: data.modelName,
      provider: data.provider,
      contextLength: data.contextLength || null,
      pricingPrompt: data.pricingPrompt?.toString() || null,
      pricingCompletion: data.pricingCompletion?.toString() || null,
      supportsToolCalls: data.supportsToolCalls || false,
      order: maxOrder + 1,
      // Store full model metadata for capability detection (image gen, tools, etc.)
      metadata: data.metadata || null,
    };

    await db.insert(starredModel).values(newStarredModel);

    return newStarredModel;
  } catch (error) {
    console.error("Error starring model", error);
    throw error;
  }
}

/**
 * Unstars/removes a model from favorites
 *
 * @param input - Contains userId and modelId to unstar
 * @returns Success status
 */
export async function unstarModel(
  input: UnstarModelInput
): Promise<{ success: boolean }> {
  const { userId, modelId } = UnstarModelSchema.parse(input);
  const db = await getClientDb();

  await db
    .delete(starredModel)
    .where(
      and(eq(starredModel.modelId, modelId), eq(starredModel.userId, userId))
    );

  return { success: true };
}

/**
 * Gets all starred models for the current user
 *
 * @param input - Contains userId
 * @returns Array of starred models ordered by user preference
 */
export async function getStarredModels(input: GetStarredModelsInput) {
  const { userId } = GetStarredModelsSchema.parse(input);
  const db = await getClientDb();

  const models = await db
    .select()
    .from(starredModel)
    .where(eq(starredModel.userId, userId))
    .orderBy(asc(starredModel.order));

  return models;
}

/**
 * Reorders starred models
 *
 * @param input - Contains userId and modelIds in new order
 * @returns Success status
 */
export async function reorderStarredModels(
  input: ReorderStarredModelsInput
): Promise<{ success: boolean }> {
  const { userId, modelIds } = ReorderStarredModelsSchema.parse(input);
  const db = await getClientDb();

  // Update the order of each model
  for (let i = 0; i < modelIds.length; i++) {
    await db
      .update(starredModel)
      .set({ order: i })
      .where(
        and(
          eq(starredModel.modelId, modelIds[i]),
          eq(starredModel.userId, userId)
        )
      );
  }

  return { success: true };
}

/**
 * Checks if a model is starred by the current user
 *
 * @param input - Contains userId and modelId to check
 * @returns true if the model is starred
 */
export async function isModelStarred(
  input: IsModelStarredInput
): Promise<boolean> {
  const { userId, modelId } = IsModelStarredSchema.parse(input);
  const db = await getClientDb();

  const result = await db
    .select({ id: starredModel.id })
    .from(starredModel)
    .where(
      and(eq(starredModel.modelId, modelId), eq(starredModel.userId, userId))
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Gets a starred model's full metadata by model ID
 *
 * @param input - Contains userId and modelId
 * @returns The starred model with metadata, or null if not found
 */
export async function getStarredModelMetadata(input: IsModelStarredInput) {
  const { userId, modelId } = IsModelStarredSchema.parse(input);
  const db = await getClientDb();

  const result = await db
    .select()
    .from(starredModel)
    .where(
      and(eq(starredModel.modelId, modelId), eq(starredModel.userId, userId))
    )
    .limit(1);

  return result[0] ?? null;
}
