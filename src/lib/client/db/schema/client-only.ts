/**
 * Client-Only Database Schema
 *
 * These tables are stored in local PGlite (IndexedDB) and managed client-side only.
 * They should NEVER be sent to the server.
 *
 * Tables:
 * - apiKey: Encrypted OpenRouter API key (local storage)
 * - folder: Chat organization folders
 * - chat: Chat conversations
 * - message: Chat messages
 * - messagePart: Message content parts
 * - starredModel: User's favorite models
 *
 * IMPORTANT: All userId fields are regular text columns (not foreign keys)
 * since the user table lives in the server database.
 */

import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	json,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core';

// ==================== API Key (Local) ====================

/**
 * API Key
 *
 * Stores the user's encrypted OpenRouter API key locally.
 * This allows direct client-to-OpenRouter communication for maximum privacy.
 *
 * The key is encrypted using Web Crypto API before storage.
 */
export const apiKey = pgTable(
	'api_key',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(), // No FK - user table is server-side
		encryptedKey: text('encrypted_key').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		lastUsedAt: timestamp('last_used_at'),
	},
	(table) => [unique().on(table.userId)]
);

// ==================== Chat Organization ====================

/**
 * Folder
 *
 * Organizes chats into folders for better organization.
 */
export const folder = pgTable('folder', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(), // No FK - user table is server-side
	name: text('name').notNull(),
	icon: text('icon'),
	color: text('color'),
	order: integer('order').default(0).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/**
 * Chat
 *
 * Represents a chat conversation with an AI model.
 */
export const chat = pgTable(
	'chat',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(), // No FK - user table is server-side
		folderId: text('folder_id').references(() => folder.id, {
			onDelete: 'set null',
		}),
		title: text('title'),
		selectedModel: text('selected_model').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		pinned: boolean('pinned').default(false).notNull(),
	},
	(table) => [
		index('chat_user_updated_idx').on(table.userId, table.updatedAt.desc()),
		index('chat_user_folder_idx').on(table.userId, table.folderId),
	]
);

// ==================== Messages ====================

/**
 * Message
 *
 * Represents a message in a chat (user or assistant).
 * Compatible with AI SDK UIMessage format.
 */
export const message = pgTable(
	'message',
	{
		id: text('id').primaryKey(),
		chatId: text('chat_id')
			.notNull()
			.references(() => chat.id, { onDelete: 'cascade' }),
		role: text('role').notNull(), // 'user' | 'assistant' | 'system'
		createdAt: timestamp('created_at').defaultNow().notNull(),
		order: integer('order').notNull(),
	},
	(table) => [
		index('message_chat_order_idx').on(table.chatId, table.order),
		index('message_chat_created_idx').on(table.chatId, table.createdAt),
	]
);

/**
 * Message Part
 *
 * Stores the content of a message.
 * Supports multiple part types: text, tool-call, tool-result.
 * Uses sparse columns (only relevant fields are populated).
 */
export const messagePart = pgTable(
	'message_part',
	{
		id: text('id').primaryKey(),
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // 'text' | 'tool-call' | 'tool-result'
		order: integer('order').default(0).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),

		// Sparse content columns (only populate relevant ones based on type)
		textContent: text('text_content'), // For type='text'
		toolCallId: text('tool_call_id'), // For type='tool-call' | 'tool-result'
		toolCallName: text('tool_call_name'), // For type='tool-call'
		toolCallArgs: json('tool_call_args').$type<Record<string, unknown>>(), // For type='tool-call'
		toolResultId: text('tool_result_id'), // For type='tool-result'
		toolResultContent: json('tool_result_content').$type<unknown>(), // For type='tool-result'
		providerMetadata: json('provider_metadata').$type<Record<string, unknown>>(),
	},
	(table) => [
		index('message_part_message_order_idx').on(table.messageId, table.order),
	]
);

// ==================== Models ====================

/**
 * Starred Model
 *
 * Stores user's favorite AI models for quick access.
 */
export const starredModel = pgTable(
	'starred_model',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(), // No FK - user table is server-side
		modelId: text('model_id').notNull(),
		modelName: text('model_name').notNull(),
		provider: text('provider').notNull(),
		contextLength: integer('context_length'),
		pricingPrompt: numeric('pricing_prompt'),
		pricingCompletion: numeric('pricing_completion'),
		order: integer('order').default(0).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [unique().on(table.userId, table.modelId)]
);

// ==================== Relations ====================

export const folderRelations = relations(folder, ({ many }) => ({
	chats: many(chat),
}));

export const chatRelations = relations(chat, ({ one, many }) => ({
	folder: one(folder, {
		fields: [chat.folderId],
		references: [folder.id],
	}),
	messages: many(message),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
	chat: one(chat, {
		fields: [message.chatId],
		references: [chat.id],
	}),
	parts: many(messagePart),
}));

export const messagePartRelations = relations(messagePart, ({ one }) => ({
	message: one(message, {
		fields: [messagePart.messageId],
		references: [message.id],
	}),
}));

// Note: No relations to user table since it lives in server database
