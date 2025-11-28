import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CustomUIMessage } from "@/types";
import { chat, message, messagePart } from "../db/schema";
import { protectedMiddleware } from "../middleware/protected-middleware";

// ==================== Schemas ====================

const SaveMessagesSchema = z.object({
	chatId: z.string().min(1, "Chat ID is required"),
	messages: z.custom<CustomUIMessage[]>(
		(val) => Array.isArray(val),
		"Messages must be an array",
	),
});

const DeleteMessagesForChatSchema = z.object({
	chatId: z.string().min(1, "Chat ID is required"),
});

/**
 * Saves messages in UIMessage format to the database
 * Converts UIMessage parts to normalized message_part rows
 *
 * NOTE: AI SDK's onFinish sends ALL messages (including previously saved ones).
 * This function checks which messages already exist and only inserts new ones.
 */

export const saveMessages = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(SaveMessagesSchema)
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		// Get existing message IDs for this chat to avoid duplicates
		const existingMessages = await db
			.select({ id: message.id })
			.from(message)
			.where(eq(message.chatId, data.chatId));

		const existingIds = new Set(existingMessages.map((m) => m.id));

		// Wrap all inserts in a transaction for data integrity
		await db.transaction(async (tx) => {
			for (let i = 0; i < data.messages.length; i++) {
				const msg = data.messages[i];
				const messageId = msg.id || nanoid();

				// Skip if message already exists
				if (existingIds.has(messageId)) {
					continue;
				}

				// Insert new message row
				await tx.insert(message).values({
					id: messageId,
					chatId: data.chatId,
					role: msg.role,
					order: i,
				});

				// Insert message parts for new message
				if (msg.parts && Array.isArray(msg.parts)) {
					for (let j = 0; j < msg.parts.length; j++) {
						const part = msg.parts[j];

						// For now, we only handle text parts
						// Tool calls can be added later when needed
						if (part.type === "text" && "text" in part) {
							await tx.insert(messagePart).values({
								id: nanoid(),
								messageId,
								type: part.type,
								order: j,
								textContent: part.text as string,
							});
						}
					}
				}
			}
		});

		return { success: true };
	});

/**
 * Retrieves all messages for a chat and reconstructs them in UIMessage format
 * Uses optimized queries to avoid N+1 query problem
 */
export const getMessagesByChatId = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string() }))
	.handler(async ({ context, data: { chatId } }) => {
		const { db } = context.config;

		// Get all messages for this chat
		const messages = await db
			.select()
			.from(message)
			.where(eq(message.chatId, chatId))
			.orderBy(asc(message.order));

		if (messages.length === 0) {
			return [];
		}

		// Get all parts for all messages in a single query using inArray
		const messageIds = messages.map((m) => m.id);
		const allParts = await db
			.select()
			.from(messagePart)
			.where(inArray(messagePart.messageId, messageIds))
			.orderBy(asc(messagePart.order));

		// Group parts by messageId
		const partsByMessageId = new Map<string, typeof allParts>();
		for (const part of allParts) {
			if (!partsByMessageId.has(part.messageId)) {
				partsByMessageId.set(part.messageId, []);
			}
			const partsArray = partsByMessageId.get(part.messageId);
			if (partsArray) {
				partsArray.push(part);
			}
		}

		// Reconstruct messages in AI SDK UIMessage format
		const chatMessages = messages.map((msg) => {
			const parts = partsByMessageId.get(msg.id) || [];

			// Sort parts by order
			parts.sort((a, b) => a.order - b.order);

			// Reconstruct message parts - currently only text parts
			const reconstructedParts = parts
				.filter((part) => part.type === "text")
				.map((part) => ({
					type: "text" as const,
					text: part.textContent || "",
				}));

			return {
				id: msg.id,
				role: msg.role as "user" | "assistant" | "system",
				parts: reconstructedParts,
			};
		});

		return chatMessages;
	});

/**
 * Deletes all messages for a chat
 * Used when clearing chat history
 */
export const deleteMessagesForChat = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(DeleteMessagesForChatSchema)
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		// Verify user owns the chat before deleting messages
		const userChat = await db
			.select({ id: chat.id })
			.from(chat)
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)))
			.limit(1);

		if (!userChat[0]) {
			throw new Error("Chat not found");
		}

		// Delete all messages (parts will cascade)
		await db.delete(message).where(eq(message.chatId, data.chatId));

		return { success: true };
	});
