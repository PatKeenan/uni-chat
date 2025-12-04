import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, folder } from "../db/schema";
import { protectedMiddleware } from "../middleware/protected-middleware";

// ==================== Schemas ====================

const CreateFolderSchema = z.object({
	name: z.string().min(1, "Name is required"),
	icon: z.string().optional(),
	color: z.string().optional(),
});
/**
 * Creates a new folder for organizing chats
 */
export const createFolder = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(CreateFolderSchema)
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		// Get the current max order for user's folders
		const folders = await db
			.select()
			.from(folder)
			.where(eq(folder.userId, context.user.id))
			.orderBy(asc(folder.order));

		const maxOrder =
			folders.length > 0 ? Math.max(...folders.map((f) => f.order)) : -1;

		const newFolder = {
			id: nanoid(),
			userId: context.user.id,
			name: data.name,
			icon: data.icon || null,
			color: data.color || null,
			order: maxOrder + 1,
		};

		await db.insert(folder).values(newFolder);

		return newFolder;
	});

/**
 * Gets all folders for the current user
 */
export const getUserFolders = createServerFn()
	.middleware([protectedMiddleware])
	.handler(async ({ context }) => {
		const { db } = context.config;

		const folders = await db
			.select()
			.from(folder)
			.where(eq(folder.userId, context.user.id))
			.orderBy(asc(folder.order));

		return folders;
	});

/**
 * Updates a folder's properties
 */
export const updateFolder = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(
		z.object({
			folderId: z.string(),
			name: z.string().optional(),
			icon: z.string().optional(),
			color: z.string().optional(),
		}),
	)
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		const updates: Record<string, string | null | undefined> = {};
		if (data.name !== undefined) updates.name = data.name;
		if (data.icon !== undefined) updates.icon = data.icon;
		if (data.color !== undefined) updates.color = data.color;

		await db
			.update(folder)
			.set(updates)
			.where(
				and(eq(folder.id, data.folderId), eq(folder.userId, context.user.id)),
			);

		return { success: true };
	});

/**
 * Deletes a folder (chats in it become uncategorized)
 */
export const deleteFolder = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ folderId: z.string() }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		// First, set all chats in this folder to null folderId (with user ownership check)
		await db
			.update(chat)
			.set({ folderId: null })
			.where(
				and(eq(chat.folderId, data.folderId), eq(chat.userId, context.user.id)),
			);

		// Then delete the folder
		await db
			.delete(folder)
			.where(
				and(eq(folder.id, data.folderId), eq(folder.userId, context.user.id)),
			);

		return { success: true };
	});

/**
 * Reorders folders based on an array of folder IDs
 */
export const reorderFolders = createServerFn()
	.middleware([protectedMiddleware])
	.inputValidator(z.object({ folderIds: z.array(z.string()) }))
	.handler(async ({ context, data }) => {
		const { db } = context.config;

		// Update all folder orders in a single transaction with parallel execution
		await db.transaction(async (tx) => {
			await Promise.all(
				data.folderIds.map((folderId, index) =>
					tx
						.update(folder)
						.set({ order: index })
						.where(
							and(eq(folder.id, folderId), eq(folder.userId, context.user.id)),
						),
				),
			);
		});

		return { success: true };
	});
