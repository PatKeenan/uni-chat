/**
 * Memory Agent
 *
 * Isolated agent for conversation summarization.
 * Uses a dedicated model optimized for summarization tasks.
 * Designed to be swappable with on-device model later.
 */

import { generateText } from "ai";
import { createOpenRouterClient } from "@/lib/openrouter/client";

// Hardcoded model for summarization (can be swapped later)
const SUMMARIZATION_MODEL = "anthropic/claude-3-haiku";

interface ConversationMessage {
	role: "user" | "assistant";
	content: string;
}

const SYSTEM_PROMPT = `You are a memory extraction assistant. Your job is to extract important context and facts from conversations that would be useful to remember for future conversations.

Focus on:
- User preferences and working style
- Technical decisions and reasoning
- Project context and goals
- Important facts mentioned
- Recurring topics or concerns

Output format:
Provide a concise summary followed by bullet points of key facts.
Keep the tone neutral and factual.
Prioritize information that would help an AI assistant be more helpful in future conversations.`;

const PRESERVE_USER_PROMPT = `The following are existing memories that include USER-ADDED content that MUST be preserved verbatim. When generating new memories, integrate new insights but NEVER modify or remove user-added sections.

EXISTING MEMORIES (preserve user-added content):
{existingMemories}

NEW CONVERSATIONS TO PROCESS:
{newConversations}

Generate updated memories that:
1. Preserve ALL user-added content exactly as written
2. Update or expand AI-generated content with new insights
3. Add new relevant information from the conversations`;

export async function summarizeConversations(
	apiKey: string,
	conversations: Array<{
		title: string;
		messages: ConversationMessage[];
	}>,
	existingMemory?: string,
): Promise<string> {
	const openrouter = createOpenRouterClient(apiKey);

	const conversationText = conversations
		.map((conv) => {
			const messageText = conv.messages
				.map((m) => `${m.role}: ${m.content}`)
				.join("\n");
			return `### ${conv.title}\n${messageText}`;
		})
		.join("\n\n---\n\n");

	const prompt = existingMemory
		? PRESERVE_USER_PROMPT.replace(
				"{existingMemories}",
				existingMemory,
			).replace("{newConversations}", conversationText)
		: `Extract memories from these conversations:\n\n${conversationText}`;

	const result = await generateText({
		model: openrouter(SUMMARIZATION_MODEL),
		system: SYSTEM_PROMPT,
		prompt,
		maxOutputTokens: 1000,
	});

	return result.text;
}
