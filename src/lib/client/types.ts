import type { UIMessage } from "@ai-sdk/react";
import type { User } from "better-auth";
import type {
  DB_Chat,
  DB_Folder,
  DB_Message,
  DB_Starred_Model,
} from "@/lib/client/db/schema";
import type { getOpenRouterModels } from "../server/actions/model-actions";

type ChatId = DB_Chat["id"];
type UserId = User["id"];

// Open Router Model Types
type Models = Awaited<ReturnType<typeof getOpenRouterModels>>["data"];
type Model = Models[number];
type ModelName = Model["canonicalSlug"];

type CustomUIMessageData = {
  modelName?: ModelName;
};

type CustomUIMessage = UIMessage<CustomUIMessageData>;

export type {
  ChatId,
  UserId,
  Models,
  Model,
  ModelName,
  // Messages
  CustomUIMessage,
  CustomUIMessageData,
  // Database types
  DB_Chat,
  DB_Message,
  DB_Starred_Model,
  DB_Folder,
};
