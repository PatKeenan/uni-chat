import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OpenRouter } from "@openrouter/sdk";

/**
 * Creates an OpenRouter client instance with the provided API key
 * Used for AI model streaming and chat completions
 *
 * @param apiKey - User's OpenRouter API key
 * @returns OpenRouter client instance
 */
export function createOpenRouterClient(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Uni-Chat",
    },
  });
}

/**
 * Fetches all available models from OpenRouter
 *
 * @param apiKey - User's OpenRouter API key
 * @returns Promise with models data
 */
export async function fetchOpenRouterModels(apiKey: string) {
  const openRouter = new OpenRouter({
    apiKey,
  });

  const models = await openRouter.models.list();

  return models;
}

export type OpenRouterModel = Awaited<
  ReturnType<typeof fetchOpenRouterModels>
>["data"][number];
