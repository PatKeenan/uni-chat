import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, folder } from "../db/schema";
import { protectedMiddleware } from "../middleware/protected-middleware";
/**
 * Creates a new chat conversation
 */
export const createChat = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(
		z.object({
			modelId: z.string(),
			folderId: z.string().optional(),
			title: z.string().optional(),
		}),
	)
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		const newChat = {
			id: nanoid(),
			userId: context.user.id,
			selectedModel: data.modelId,
			folderId: data.folderId || null,
			title: data.title || null,
			pinned: false,
		};

		await db.insert(chat).values(newChat);

		return newChat;
	});

/**
 * Gets a single chat by ID
 * Verifies the chat belongs to the requesting user
 */
export const getChatById = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		const result = await db
			.select()
			.from(chat)
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)))
			.limit(1);

		if (!result[0]) {
			throw new Error("Chat not found");
		}

		return result[0];
	});

/**
 * Gets all chats for the current user
 * Grouped by folder with uncategorized chats separate
 */
export const getUserChats = createServerFn()
	.middleware([protectedMiddleware])
	.handler(async ({ context }) => {
		const { db } = context.config;

		// Get all chats with folder info
		const chats = await db
			.select({
				chat,
				folder,
			})
			.from(chat)
			.leftJoin(folder, eq(chat.folderId, folder.id))
			.where(eq(chat.userId, context.user.id))
			.orderBy(desc(chat.updatedAt));

		return chats;
	});

/**
 * Gets the most recently updated chat for the user
 */
export const getMostRecentChat = createServerFn()
	.middleware([protectedMiddleware])
	.handler(async ({ context }) => {
		const { db } = context.config;

		const result = await db
			.select()
			.from(chat)
			.where(eq(chat.userId, context.user.id))
			.orderBy(desc(chat.updatedAt))
			.limit(1);

		return result[0] || null;
	});

/**
 * Updates a chat's title
 */
export const updateChatTitle = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string(), title: z.string() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		await db
			.update(chat)
			.set({ title: data.title })
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)));

		return { success: true };
	});

/**
 * Updates a chat's timestamp (called after new messages)
 */
export const updateChatTimestamp = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		await db
			.update(chat)
			.set({ updatedAt: new Date() })
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)));

		return { success: true };
	});

/**
 * Moves a chat to a different folder
 */
export const moveChatToFolder = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(
		z.object({ chatId: z.string(), folderId: z.string().nullable() }),
	)
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		await db
			.update(chat)
			.set({ folderId: data.folderId })
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)));

		return { success: true };
	});

/**
 * Deletes a chat and all associated messages (cascade)
 */
export const deleteChat = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		await db
			.delete(chat)
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)));

		return { success: true };
	});

/**
 * Toggles a chat's pinned status
 */
export const togglePinChat = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string(), pinned: z.boolean() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		await db
			.update(chat)
			.set({ pinned: data.pinned })
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)));

		return { success: true };
	});

/**
 * Updates the selected model for a chat
 */
export const updateChatModel = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ chatId: z.string(), modelId: z.string() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		await db
			.update(chat)
			.set({ selectedModel: data.modelId })
			.where(and(eq(chat.id, data.chatId), eq(chat.userId, context.user.id)));

		return { success: true };
	});
