import { relations } from "drizzle-orm";
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
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// AI Chat Application Tables

export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    encryptedKey: text("encrypted_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [unique().on(table.userId)]
);

// Tavily API Key
export const tavilyApiKey = pgTable(
  "tavily_api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    encryptedKey: text("encrypted_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [unique().on(table.userId)]
);

export const folder = pgTable("folder", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folder.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    selectedModel: text("selected_model").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    pinned: boolean("pinned").default(false).notNull(),
  },
  (table) => [
    index("chat_user_updated_idx").on(table.userId, table.updatedAt.desc()),
    index("chat_user_folder_idx").on(table.userId, table.folderId),
  ]
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    order: integer("order").notNull(),
  },
  (table) => [
    index("message_chat_order_idx").on(table.chatId, table.order),
    index("message_chat_created_idx").on(table.chatId, table.createdAt),
  ]
);

export const messagePart = pgTable(
  "message_part",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),

    // Sparse content columns
    textContent: text("text_content"),
    toolCallId: text("tool_call_id"),
    toolCallName: text("tool_call_name"),
    toolCallArgs: json("tool_call_args").$type<Record<string, unknown>>(),
    toolResultId: text("tool_result_id"),
    toolResultContent: json("tool_result_content").$type<unknown>(),
    providerMetadata:
      json("provider_metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("message_part_message_order_idx").on(table.messageId, table.order),
  ]
);

export const starredModel = pgTable(
  "starred_model",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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

// Relations

export const userRelations = relations(user, ({ many, one }) => ({
  apiKey: one(apiKey),
  tavilyApiKey: one(tavilyApiKey),
  folders: many(folder),
  chats: many(chat),
  starredModels: many(starredModel),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  user: one(user, {
    fields: [apiKey.userId],
    references: [user.id],
  }),
}));

export const tavilyApiKeyRelations = relations(tavilyApiKey, ({ one }) => ({
  user: one(user, {
    fields: [tavilyApiKey.userId],
    references: [user.id],
  }),
}));

export const folderRelations = relations(folder, ({ one, many }) => ({
  user: one(user, {
    fields: [folder.userId],
    references: [user.id],
  }),
  chats: many(chat),
}));

export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
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

export const starredModelRelations = relations(starredModel, ({ one }) => ({
  user: one(user, {
    fields: [starredModel.userId],
    references: [user.id],
  }),
}));
