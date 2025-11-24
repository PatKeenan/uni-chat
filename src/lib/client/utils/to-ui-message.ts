import type { CustomUIMessage, DB_Message } from "../types";

export const toUiMessages = (messages: DB_Message[]): CustomUIMessage[] => {
	return messages.map(toUiMessage);
};

export const toUiMessage = (message: DB_Message): CustomUIMessage => {
	return {
		id: message.id,
		role: message.role as "user" | "assistant" | "system",
		parts: message.parts || [],
		metadata: message.metadata || {},
	};
};
