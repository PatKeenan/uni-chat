/**
 * Client-Side Folder Actions
 *
 * These functions interact with the local PGlite database to manage folders.
 * Folders organize chats into categories - all operations are client-side only.
 */

import { nanoid } from 'nanoid';
import { desc, eq, and } from 'drizzle-orm';
import { getClientDb } from '@/lib/client/db';
import { folder } from '@/lib/client/db/schema';

/**
 * Create a new folder
 *
 * @param data - Folder creation data
 * @returns Created folder
 */
export async function createLocalFolder(data: {
	userId: string;
	name: string;
	color?: string | null;
}): Promise<typeof folder.$inferSelect> {
	const db = await getClientDb();

	const newFolder = {
		id: nanoid(),
		userId: data.userId,
		name: data.name,
		color: data.color || null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const [created] = await db.insert(folder).values(newFolder).returning();

	return created;
}

/**
 * Get a single folder by ID
 *
 * @param folderId - Folder ID
 * @param userId - User ID (for security check)
 * @returns Folder or null if not found
 */
export async function getLocalFolderById(
	folderId: string,
	userId: string
): Promise<typeof folder.$inferSelect | null> {
	const db = await getClientDb();

	const result = await db.query.folder.findFirst({
		where: (folder, { eq, and }) =>
			and(eq(folder.id, folderId), eq(folder.userId, userId)),
	});

	return result || null;
}

/**
 * Get all folders for a user
 *
 * @param userId - User ID
 * @returns Array of folders sorted by name
 */
export async function getLocalFolders(
	userId: string
): Promise<Array<typeof folder.$inferSelect>> {
	const db = await getClientDb();

	const folders = await db.query.folder.findMany({
		where: eq(folder.userId, userId),
		orderBy: [desc(folder.updatedAt)],
	});

	return folders;
}

/**
 * Get folders with chat counts
 *
 * Useful for displaying folder list with number of chats in each.
 *
 * @param userId - User ID
 * @returns Array of folders with chat counts
 */
export async function getLocalFoldersWithCounts(
	userId: string
): Promise<
	Array<typeof folder.$inferSelect & { chatCount: number }>
> {
	// Get all folders
	const folders = await getLocalFolders(userId);

	// Get chat counts for each folder
	const { getLocalChats } = await import('./chat-actions');
	const foldersWithCounts = await Promise.all(
		folders.map(async (folder) => {
			const chats = await getLocalChats(userId, {
				folderId: folder.id,
			});
			return {
				...folder,
				chatCount: chats.length,
			};
		})
	);

	return foldersWithCounts;
}

/**
 * Update a folder
 *
 * @param folderId - Folder ID
 * @param userId - User ID (for security check)
 * @param data - Fields to update
 */
export async function updateLocalFolder(
	folderId: string,
	userId: string,
	data: Partial<{
		name: string;
		color: string | null;
	}>
): Promise<void> {
	const db = await getClientDb();

	await db
		.update(folder)
		.set({
			...data,
			updatedAt: new Date(),
		})
		.where(and(eq(folder.id, folderId), eq(folder.userId, userId)));
}

/**
 * Update folder name
 *
 * @param folderId - Folder ID
 * @param userId - User ID
 * @param name - New name
 */
export async function updateLocalFolderName(
	folderId: string,
	userId: string,
	name: string
): Promise<void> {
	await updateLocalFolder(folderId, userId, { name });
}

/**
 * Update folder color
 *
 * @param folderId - Folder ID
 * @param userId - User ID
 * @param color - New color (hex code or null)
 */
export async function updateLocalFolderColor(
	folderId: string,
	userId: string,
	color: string | null
): Promise<void> {
	await updateLocalFolder(folderId, userId, { color });
}

/**
 * Delete a folder
 *
 * When a folder is deleted, all chats in that folder are moved to
 * "uncategorized" (folderId set to null) via ON DELETE SET NULL.
 *
 * @param folderId - Folder ID
 * @param userId - User ID (for security check)
 */
export async function deleteLocalFolder(
	folderId: string,
	userId: string
): Promise<void> {
	const db = await getClientDb();

	await db
		.delete(folder)
		.where(and(eq(folder.id, folderId), eq(folder.userId, userId)));
}

/**
 * Delete all folders for a user
 * WARNING: This deletes ALL folders!
 * Chats are moved to uncategorized.
 *
 * @param userId - User ID
 */
export async function deleteAllLocalFolders(userId: string): Promise<void> {
	const db = await getClientDb();

	await db.delete(folder).where(eq(folder.userId, userId));
}

/**
 * Check if folder name already exists for user
 *
 * Useful for preventing duplicate folder names.
 *
 * @param userId - User ID
 * @param name - Folder name to check
 * @param excludeFolderId - Optional folder ID to exclude (for rename)
 * @returns true if name exists
 */
export async function folderNameExists(
	userId: string,
	name: string,
	excludeFolderId?: string
): Promise<boolean> {
	const db = await getClientDb();

	const conditions = [eq(folder.userId, userId), eq(folder.name, name)];

	// Exclude specific folder ID if provided (for rename check)
	if (excludeFolderId) {
		const { ne } = await import('drizzle-orm');
		conditions.push(ne(folder.id, excludeFolderId));
	}

	const result = await db.query.folder.findFirst({
		where: and(...conditions),
	});

	return result !== undefined;
}

/**
 * Get folder by name
 *
 * @param userId - User ID
 * @param name - Folder name
 * @returns Folder or null if not found
 */
export async function getLocalFolderByName(
	userId: string,
	name: string
): Promise<typeof folder.$inferSelect | null> {
	const db = await getClientDb();

	const result = await db.query.folder.findFirst({
		where: and(eq(folder.userId, userId), eq(folder.name, name)),
	});

	return result || null;
}
