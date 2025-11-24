import { vi } from "vitest";

/**
 * Mock OpenRouter API /api/v1/auth/key response
 */
export function mockOpenRouterKeyValidation(valid = true) {
	return vi.fn().mockResolvedValue({
		ok: valid,
		json: async () => ({
			data: valid
				? { label: "Test API Key", limit: 1000, usage: 100 }
				: { error: "Invalid API key" },
		}),
	});
}

/**
 * Mock OpenRouter models list response
 */
export function mockOpenRouterModels(models?: any[]) {
	const defaultModels = [
		{
			id: "openai/gpt-4",
			name: "GPT-4",
			pricing: { prompt: "0.00003", completion: "0.00006" },
		},
		{
			id: "anthropic/claude-3-opus",
			name: "Claude 3 Opus",
			pricing: { prompt: "0.000015", completion: "0.000075" },
		},
	];

	return vi.fn().mockResolvedValue({
		ok: true,
		json: async () => ({ data: models || defaultModels }),
	});
}

/**
 * Mock AI SDK streamText response
 */
export function mockStreamText(response = "This is a test AI response") {
	return {
		textStream: (async function* () {
			for (const char of response) {
				yield char;
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		})(),
		text: Promise.resolve(response),
		finishReason: Promise.resolve("stop"),
		usage: Promise.resolve({ promptTokens: 10, completionTokens: 20 }),
	};
}
