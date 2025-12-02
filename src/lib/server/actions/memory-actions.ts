/**
 * Memory Server Actions
 *
 * Server-side actions for memory generation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { summarizeConversations } from "../ai-tools/memory-agent";
import { protectedMiddleware } from "../middleware/protected-middleware";

/**
 * Generate a memory summary from conversations
 */
export const generateMemorySummary = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(
		z.object({
			apiKey: z.string(),
			conversations: z.array(
				z.object({
					title: z.string(),
					messages: z.array(
						z.object({
							role: z.enum(["user", "assistant"]),
							content: z.string(),
						}),
					),
				}),
			),
			existingMemory: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const summary = await summarizeConversations(
			data.apiKey,
			data.conversations,
			data.existingMemory,
		);

		return { summary };
	});
