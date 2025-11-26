/**
 * Client-Side Data Management Actions
 *
 * These functions interact with the local PGlite database to manage and inspect data.
 * Provides utilities for:
 * - Getting storage usage statistics
 * - Analyzing data breakdown by type (chats, messages, attachments)
 * - Clearing specific data types (attachments only, all messages, etc.)
 * - Complete data wipe
 */

import { count, eq } from "drizzle-orm";
import { z } from "zod";
import {
  formatBytes,
  getClientDb,
  getStorageUsage,
  resetClientDb,
} from "@/lib/client/db";
import { chat, folder, message, starredModel } from "@/lib/client/db/schema";

// ==================== Types ====================

export interface DataStats {
  /** Total estimated storage used by IndexedDB */
  totalStorageUsed: number;
  totalStorageUsedFormatted: string;
  /** Total quota available */
  totalQuota: number;
  totalQuotaFormatted: string;
  /** Percentage of quota used */
  percentUsed: number;
  /** Breakdown by table */
  breakdown: {
    chats: {
      count: number;
      estimatedSize: number;
      estimatedSizeFormatted: string;
    };
    messages: {
      count: number;
      estimatedSize: number;
      estimatedSizeFormatted: string;
    };
    attachments: {
      count: number;
      estimatedSize: number;
      estimatedSizeFormatted: string;
    };
    folders: {
      count: number;
      estimatedSize: number;
      estimatedSizeFormatted: string;
    };
    starredModels: {
      count: number;
      estimatedSize: number;
      estimatedSizeFormatted: string;
    };
  };
}

export interface ClearDataResult {
  success: boolean;
  message: string;
  itemsDeleted?: number;
}

// ==================== Schemas ====================

export const GetDataStatsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const ClearAttachmentsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const ClearAllMessagesSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const ClearAllChatsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const ClearAllDataSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// ==================== Actions ====================

/**
 * Get comprehensive data statistics
 *
 * Returns storage usage information including total usage,
 * quota, and breakdown by data type.
 *
 * @param userId - User ID
 * @returns DataStats object with all statistics
 */
export async function getDataStats(userId: string): Promise<DataStats> {
  GetDataStatsSchema.parse({ userId });

  const db = await getClientDb();

  // Get overall storage usage from browser API
  const storageUsage = await getStorageUsage();

  // Get counts and estimate sizes
  // Note: Exact byte sizes are hard to determine in IndexedDB,
  // so we estimate based on record counts and typical record sizes

  // Chat count
  const [chatResult] = await db
    .select({ count: count() })
    .from(chat)
    .where(eq(chat.userId, userId));
  const chatCount = chatResult?.count ?? 0;

  // Get messages with their parts to analyze attachments
  const messagesWithParts = await db
    .select({ parts: message.parts })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(eq(chat.userId, userId));

  let attachmentCount = 0;
  let attachmentTotalSize = 0;

  for (const msg of messagesWithParts) {
    if (msg.parts && Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        // Check for file/image attachments
        if (part && typeof part === "object") {
          const partObj = part as Record<string, unknown>;
          if (partObj.type === "file" || partObj.type === "image") {
            attachmentCount++;
            // Estimate attachment size from data URL or blob
            if (partObj.data && typeof partObj.data === "string") {
              // Base64 data URLs are ~33% larger than binary
              attachmentTotalSize += Math.ceil(
                (partObj.data as string).length * 0.75
              );
            } else if (partObj.url && typeof partObj.url === "string") {
              // If it's a data URL, calculate size
              const url = partObj.url as string;
              if (url.startsWith("data:")) {
                const base64Part = url.split(",")[1] || "";
                attachmentTotalSize += Math.ceil(base64Part.length * 0.75);
              }
            }
          }
        }
      }
    }
  }

  // Folder count
  const [folderResult] = await db
    .select({ count: count() })
    .from(folder)
    .where(eq(folder.userId, userId));
  const folderCount = folderResult?.count ?? 0;

  // Starred model count
  const [starredModelResult] = await db
    .select({ count: count() })
    .from(starredModel)
    .where(eq(starredModel.userId, userId));
  const starredModelCount = starredModelResult?.count ?? 0;

  // Estimate sizes (rough estimates based on typical record sizes)
  // Chat: ~200 bytes per record (id, title, model, timestamps)
  const chatEstimatedSize = chatCount * 200;
  // Message: ~500 bytes per record (excluding attachments, text is variable)
  // Get actual message sizes for user's chats
  const userMessageCount = messagesWithParts.length;
  const messageEstimatedSize = userMessageCount * 500 + attachmentTotalSize;
  // Folder: ~100 bytes per record
  const folderEstimatedSize = folderCount * 100;
  // Starred model: ~300 bytes per record (includes model metadata)
  const starredModelEstimatedSize = starredModelCount * 300;

  return {
    totalStorageUsed: storageUsage.used,
    totalStorageUsedFormatted: formatBytes(storageUsage.used),
    totalQuota: storageUsage.quota,
    totalQuotaFormatted: formatBytes(storageUsage.quota),
    percentUsed: storageUsage.percentUsed,
    breakdown: {
      chats: {
        count: chatCount,
        estimatedSize: chatEstimatedSize,
        estimatedSizeFormatted: formatBytes(chatEstimatedSize),
      },
      messages: {
        count: userMessageCount,
        estimatedSize: messageEstimatedSize - attachmentTotalSize,
        estimatedSizeFormatted: formatBytes(
          messageEstimatedSize - attachmentTotalSize
        ),
      },
      attachments: {
        count: attachmentCount,
        estimatedSize: attachmentTotalSize,
        estimatedSizeFormatted: formatBytes(attachmentTotalSize),
      },
      folders: {
        count: folderCount,
        estimatedSize: folderEstimatedSize,
        estimatedSizeFormatted: formatBytes(folderEstimatedSize),
      },
      starredModels: {
        count: starredModelCount,
        estimatedSize: starredModelEstimatedSize,
        estimatedSizeFormatted: formatBytes(starredModelEstimatedSize),
      },
    },
  };
}

/**
 * Clear all attachments from messages
 *
 * Removes file and image parts from all messages while preserving text content.
 * This can significantly reduce storage usage if many attachments were uploaded.
 *
 * @param userId - User ID
 * @returns Result with success status and items deleted count
 */
export async function clearAttachments(
  userId: string
): Promise<ClearDataResult> {
  ClearAttachmentsSchema.parse({ userId });

  const db = await getClientDb();

  try {
    // Get all messages for user's chats
    const messagesWithParts = await db
      .select({ id: message.id, parts: message.parts })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(eq(chat.userId, userId));

    let attachmentsRemoved = 0;

    for (const msg of messagesWithParts) {
      if (msg.parts && Array.isArray(msg.parts)) {
        const filteredParts = msg.parts.filter((part) => {
          if (part && typeof part === "object") {
            const partObj = part as Record<string, unknown>;
            if (partObj.type === "file" || partObj.type === "image") {
              attachmentsRemoved++;
              return false;
            }
          }
          return true;
        });

        // Update message if parts were modified
        if (filteredParts.length !== msg.parts.length) {
          await db
            .update(message)
            .set({ parts: filteredParts as typeof message.$inferSelect.parts })
            .where(eq(message.id, msg.id));
        }
      }
    }

    return {
      success: true,
      message: `Successfully removed ${attachmentsRemoved} attachment(s)`,
      itemsDeleted: attachmentsRemoved,
    };
  } catch (error) {
    console.error("[DataActions] Failed to clear attachments:", error);
    return {
      success: false,
      message: "Failed to clear attachments. Please try again.",
    };
  }
}

/**
 * Clear all messages for a user
 *
 * Deletes all messages but keeps chats (empty chats remain).
 *
 * @param userId - User ID
 * @returns Result with success status
 */
export async function clearAllMessages(
  userId: string
): Promise<ClearDataResult> {
  ClearAllMessagesSchema.parse({ userId });

  const db = await getClientDb();

  try {
    // Get user's chat IDs
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    let messagesDeleted = 0;

    for (const c of userChats) {
      const result = await db
        .delete(message)
        .where(eq(message.chatId, c.id))
        .returning({ id: message.id });
      messagesDeleted += result.length;
    }

    return {
      success: true,
      message: `Successfully deleted ${messagesDeleted} message(s)`,
      itemsDeleted: messagesDeleted,
    };
  } catch (error) {
    console.error("[DataActions] Failed to clear messages:", error);
    return {
      success: false,
      message: "Failed to clear messages. Please try again.",
    };
  }
}

/**
 * Clear all chats for a user
 *
 * Deletes all chats and their messages (cascade).
 * Folders and starred models are preserved.
 *
 * @param userId - User ID
 * @returns Result with success status
 */
export async function clearAllChats(userId: string): Promise<ClearDataResult> {
  ClearAllChatsSchema.parse({ userId });

  const db = await getClientDb();

  try {
    const result = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning({ id: chat.id });

    return {
      success: true,
      message: `Successfully deleted ${result.length} chat(s) and all their messages`,
      itemsDeleted: result.length,
    };
  } catch (error) {
    console.error("[DataActions] Failed to clear chats:", error);
    return {
      success: false,
      message: "Failed to clear chats. Please try again.",
    };
  }
}

/**
 * Clear all local data for a user
 *
 * Removes everything: chats, messages, folders, starred models.
 * This is a complete data wipe - use with caution!
 *
 * @param userId - User ID
 * @returns Result with success status
 */
export async function clearAllUserData(
  userId: string
): Promise<ClearDataResult> {
  ClearAllDataSchema.parse({ userId });

  const db = await getClientDb();

  try {
    // Delete in order to respect foreign key constraints
    // 1. Delete all chats (messages cascade automatically)
    await db.delete(chat).where(eq(chat.userId, userId));

    // 2. Delete all folders
    await db.delete(folder).where(eq(folder.userId, userId));

    // 3. Delete all starred models
    await db.delete(starredModel).where(eq(starredModel.userId, userId));

    return {
      success: true,
      message: "Successfully cleared all your local data",
    };
  } catch (error) {
    console.error("[DataActions] Failed to clear all data:", error);
    return {
      success: false,
      message: "Failed to clear all data. Please try again.",
    };
  }
}

/**
 * Complete database reset
 *
 * Completely wipes the IndexedDB database and re-initializes.
 * This affects ALL users on this device (use clearAllUserData for single user).
 *
 * @returns Result with success status
 */
export async function completeDataReset(): Promise<ClearDataResult> {
  try {
    await resetClientDb();

    return {
      success: true,
      message: "Database completely reset. Please refresh the page.",
    };
  } catch (error) {
    console.error("[DataActions] Failed to reset database:", error);
    return {
      success: false,
      message: "Failed to reset database. Close all tabs and try again.",
    };
  }
}
