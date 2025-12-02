/**
 * Memory Types
 *
 * Types for the user memories feature, which stores context summaries at the folder level.
 * Memories are stored 100% client-side in PGlite.
 */

/**
 * A single block of memory content with authorship tracking.
 * Authorship is important for preserving user edits during LLM updates.
 */
export interface MemoryBlock {
	id: string;
	/** Who created this block - "llm" for AI-generated, "user" for user-authored */
	source: "llm" | "user";
	/** The memory content */
	content: string;
	/** ISO timestamp when the block was created */
	createdAt: string;
	/** ISO timestamp when the block was last edited (only present if edited) */
	updatedAt?: string;
}

/**
 * Reference to a chat that has been included in a memory document.
 * Used to track which chats have already been processed for memory generation.
 */
export interface IncludedChatRef {
	chatId: string;
	/** ISO timestamp of the last message when this chat was processed */
	lastMessageDate: string;
	/** Number of messages in the chat when processed */
	messageCount: number;
}

/**
 * A folder's memory document containing blocks of context.
 * Each folder has at most one memory document.
 */
export interface FolderMemory {
	id: string;
	userId: string;
	/** null = uncategorized folder */
	folderId: string | null;
	/** Ordered list of memory blocks */
	blocks: MemoryBlock[];
	/** Chats that have been processed into this memory */
	includedChats: IncludedChatRef[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Memory settings stored in localStorage
 */
export interface MemorySettings {
	/** Whether the memories feature is enabled */
	enabled: boolean;
	/** Number of messages after which to suggest creating a memory (0 = disabled) */
	autoSuggestThreshold: number;
}

/**
 * Default memory settings
 */
export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
	enabled: true,
	autoSuggestThreshold: 20,
};
