/**
 * UIMessage types for the AI SDK
 * Based on Vercel AI SDK v5 UIMessage format
 */

export interface TextPart {
	type: "text";
	text: string;
}

export interface ToolCallPart {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
}

export interface ToolResultPart {
	type: "tool-result";
	toolCallId: string;
	result: unknown;
}

export type MessagePart = TextPart | ToolCallPart | ToolResultPart;

export interface UIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	parts: MessagePart[];
	createdAt?: Date;
}
