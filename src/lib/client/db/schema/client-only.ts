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

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type { CustomUIMessage } from "../../types";

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
  "api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(), // No FK - user table is server-side
    encryptedKey: text("encrypted_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [unique().on(table.userId)]
);

export type DB_API_Key = typeof apiKey.$inferSelect;
// ==================== Chat Organization ====================

/**
 * Folder
 *
 * Organizes chats into folders for better organization.
 */
export const folder = pgTable("folder", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(), // No FK - user table is server-side
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type DB_Folder = typeof folder.$inferSelect;

/**
 * Chat
 *
 * Represents a chat conversation with an AI model.
 */
export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(), // No FK - user table is server-side
    folderId: text("folder_id").references(() => folder.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    selectedModel: text("selected_model").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    pinned: boolean("pinned").default(false).notNull(),
  },
  (table) => [
    index("chat_user_updated_idx").on(table.userId, table.updatedAt.desc()),
    index("chat_user_folder_idx").on(table.userId, table.folderId),
  ]
);

export type DB_Chat = typeof chat.$inferSelect;

// ==================== Messages ====================

/**
 * Message
 *
 * Represents a message in a chat (user or assistant).
 * Compatible with AI SDK UIMessage format.
 */
export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    order: integer("order").notNull(),
    parts: jsonb("parts").$type<CustomUIMessage["parts"]>().default([]),
    metadata: jsonb("metadata").$type<{ modelName?: string }>().default({}),
  },
  (table) => [
    index("message_chat_order_idx").on(table.chatId, table.order),
    index("message_chat_created_idx").on(table.chatId, table.createdAt),
  ]
);

export type DB_Message = typeof message.$inferSelect;

// ==================== Models ====================

/**
 * Starred Model
 *
 * Stores user's favorite AI models for quick access.
 */
export const starredModel = pgTable(
  "starred_model",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(), // No FK - user table is server-side
    modelId: text("model_id").notNull(),
    modelName: text("model_name").notNull(),
    provider: text("provider").notNull(),
    contextLength: integer("context_length"),
    pricingPrompt: numeric("pricing_prompt"),
    pricingCompletion: numeric("pricing_completion"),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.modelId)]
);

export type DB_Starred_Model = typeof starredModel.$inferSelect;

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
}));

// Note: No relations to user table since it lives in server database
