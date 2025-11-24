import { tavily } from "@tavily/core";
import { tool } from "ai";
import { z } from "zod";

export function initWebSearchTool(apiKey: string) {
	const tavilyClient = tavily({ apiKey });

	return tool({
		description: "Search the web for up-to-date information",
		inputSchema: z.object({
			query: z.string().min(1).max(100).describe("The search query"),
		}),
		execute: async ({ query }) => {
			const response = await tavilyClient.search(query, {
				maxResults: 2,
			});
			console.log("tavily response", response);
			return response.results.map((result) => ({
				title: result.title,
				url: result.url,
				content: result.content,
				score: result.score,
			}));
		},
	});
}
