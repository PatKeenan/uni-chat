import {
	Bot,
	CheckCircle2,
	ExternalLink,
	Loader2,
	Search,
	User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { CustomUIMessage } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

// Type for web search tool output
interface WebSearchOutput {
	query: string;
	primary: {
		heading: string | null;
		abstractText: string | null;
		abstractUrl: string | null;
		source: string | null;
	};
	related: Array<{
		text: string;
		url: string | null;
		iconUrl: string | null;
		groupName?: string;
	}>;
}

// Type for tool invocation part from AI SDK (legacy format)
interface ToolInvocationPartType {
	type: "tool-invocation";
	toolInvocation: {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
		state: "partial-call" | "call" | "result";
		result?: unknown;
	};
}

// Type for web search tool part (ToolUIPart format from AI SDK)
interface WebSearchToolPartType {
	type: "tool-webSearch";
	toolCallId: string;
	state:
		| "input-streaming"
		| "input-available"
		| "output-available"
		| "output-error";
	input: {
		query: string;
	};
	output?: Array<{
		title: string;
		url: string;
		content: string;
		score: number;
	}>;
	errorText?: string;
	providerExecuted?: boolean;
}

// Web search tool part component (new format)
function WebSearchToolPart({ part }: { part: WebSearchToolPartType }) {
	const { state, input, output, errorText } = part;

	// Render based on tool state
	switch (state) {
		case "input-streaming":
		case "input-available":
			return (
				<div className="my-2 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/20 p-3">
					<div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span className="font-medium">Searching the web</span>
						{input?.query && (
							<span className="text-blue-600/70 dark:text-blue-400/70">
								for "{input.query}"
							</span>
						)}
					</div>
				</div>
			);

		case "output-available":
			return <WebSearchOutputDisplay query={input.query} output={output} />;

		case "output-error":
			return (
				<div className="my-2 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-950/20 p-3">
					<div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
						<Search className="h-4 w-4" />
						<span className="font-medium">Search failed</span>
					</div>
					{errorText && (
						<p className="mt-1 text-xs text-red-600 dark:text-red-400">
							{errorText}
						</p>
					)}
				</div>
			);

		default:
			return null;
	}
}

// Web search output display component
function WebSearchOutputDisplay({
	query,
	output,
}: {
	query: string;
	output?: WebSearchToolPartType["output"];
}) {
	if (!output || output.length === 0) {
		return (
			<div className="my-2 rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 p-3">
				<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
					<Search className="h-4 w-4" />
					<span>No results found for "{query}"</span>
				</div>
			</div>
		);
	}

	return (
		<details className="my-2 group rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-950/20">
			<summary className="cursor-pointer px-3 py-2 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-900/20 rounded-t-lg transition-colors">
				<span className="inline-flex items-center gap-2 ml-1">
					Search results for "{query}"
					<span className="text-xs text-green-600/70 dark:text-green-400/70">
						({output.length} results)
					</span>
				</span>
			</summary>
			<div className="px-3 py-2 border-t border-green-200 dark:border-green-800/30 space-y-2">
				<ul className="space-y-2">
					{output.slice(0, 5).map((item) => (
						<li key={item.url} className="text-sm">
							<a
								href={item.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-700 dark:text-green-400 hover:underline font-medium inline-flex items-start gap-1"
							>
								<span className="line-clamp-1">{item.title}</span>
								<ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
							</a>
							<p className="text-xs text-green-600/80 dark:text-green-400 line-clamp-2 mt-0.5">
								{item.content}
							</p>
						</li>
					))}
				</ul>
			</div>
		</details>
	);
}

// Tool invocation part component (legacy format)
function ToolInvocationPart({ part }: { part: ToolInvocationPartType }) {
	const { toolName, state, args, result } = part.toolInvocation;

	// Render based on tool state
	switch (state) {
		case "partial-call":
		case "call":
			return (
				<div className="my-2 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/20 p-3">
					<div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span className="font-medium">
							{toolName === "webSearch"
								? "Searching the web"
								: `Running ${toolName}`}
						</span>
						{(args as { query?: string })?.query && (
							<span className="text-blue-600/70 dark:text-blue-400/70">
								for "{(args as { query?: string }).query}"
							</span>
						)}
					</div>
				</div>
			);

		case "result":
			return <ToolResultDisplay toolName={toolName} result={result} />;

		default:
			return (
				<div className="my-2 rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 p-3">
					<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
						<Search className="h-4 w-4" />
						<span>Tool: {toolName}</span>
					</div>
				</div>
			);
	}
}

// Display tool results based on tool type
function ToolResultDisplay({
	toolName,
	result,
}: {
	toolName: string;
	result: any;
}) {
	if (toolName === "webSearch") {
		return <WebSearchResultDisplay result={result as WebSearchOutput} />;
	}

	// Generic tool result display
	return (
		<div className="my-2 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-950/20 p-3">
			<div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 mb-2">
				<CheckCircle2 className="h-4 w-4" />
				<span className="font-medium">{toolName} completed</span>
			</div>
			<pre className="text-xs overflow-auto max-h-40 text-green-800 dark:text-green-200">
				{JSON.stringify(result, null, 2)}
			</pre>
		</div>
	);
}

// Web search specific result display
function WebSearchResultDisplay({ result }: { result: WebSearchOutput }) {
	if (!result) return null;

	return (
		<details className="my-2 group rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-950/20">
			<summary className="cursor-pointer px-3 py-2 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-900/20 rounded-t-lg transition-colors">
				<span className="inline-flex items-center gap-2">
					{/* <CheckCircle2 className="h-4 w-4" /> */}
					Search results for "{result.query}"
					{result.related?.length > 0 && (
						<span className="text-xs text-green-600/70 dark:text-green-400/70">
							({result.related.length} results)
						</span>
					)}
				</span>
			</summary>
			<div className="px-3 py-2 border-t border-green-200 dark:border-green-800/30 space-y-3">
				{/* Primary result */}
				{result.primary?.abstractText && (
					<div className="text-sm">
						{result.primary.heading && (
							<h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">
								{result.primary.heading}
							</h4>
						)}
						<p className="text-green-700/80 dark:text-green-300/80">
							{result.primary.abstractText}
						</p>
						{result.primary.abstractUrl && (
							<a
								href={result.primary.abstractUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline mt-1"
							>
								{result.primary.source || "Source"}
								<ExternalLink className="h-3 w-3" />
							</a>
						)}
					</div>
				)}

				{/* Related results */}
				{result.related && result.related.length > 0 && (
					<div className="space-y-2">
						<h5 className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">
							Related
						</h5>
						<ul className="space-y-1.5">
							{result.related.slice(0, 5).map((item) => (
								<li key={item.url || item.text} className="text-sm">
									{item.url ? (
										<a
											href={item.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-green-700 dark:text-green-300 hover:underline inline-flex items-start gap-1"
										>
											<span className="line-clamp-2">{item.text}</span>
											<ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
										</a>
									) : (
										<span className="text-green-700/70 dark:text-green-300/70">
											{item.text}
										</span>
									)}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* No results message */}
				{!result.primary?.abstractText &&
					(!result.related || result.related.length === 0) && (
						<p className="text-sm text-green-600/70 dark:text-green-400/70 italic">
							No results found for this search.
						</p>
					)}
			</div>
		</details>
	);
}

interface ChatMessageProps {
	message: CustomUIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
	const isUser = message.role === "user";
	const isAssistant = message.role === "assistant";

	// Separate reasoning, text, and tool parts
	const reasoningParts = message.parts?.filter(
		(part) => part.type === "reasoning",
	);
	const textParts = message.parts?.filter((part) => part.type === "text");
	const toolParts = message.parts?.filter(
		(part) => part.type === "tool-invocation",
	) as unknown as ToolInvocationPartType[];
	const webSearchParts = message.parts?.filter(
		(part) => part.type === "tool-webSearch",
	) as unknown as WebSearchToolPartType[];

	// Extract text content from message parts
	const textContent = textParts
		?.map((part) => ("text" in part ? part.text : ""))
		.join("");

	const reasoningContent = reasoningParts
		?.map((part) => ("text" in part ? part.text : ""))
		.join("\n\n");

	return (
		<div
			className={cn("flex gap-3 p-4", isUser ? "bg-background" : "bg-muted/50")}
		>
			{/* Avatar */}
			<div
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
					isUser ? "bg-primary" : "bg-muted",
				)}
			>
				{isUser ? (
					<User className="h-4 w-4 text-primary-foreground" />
				) : (
					<Bot className="h-4 w-4 text-muted-foreground" />
				)}
			</div>

			{/* Content */}
			<div className="flex-1 space-y-2">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold">
						{isUser
							? "You"
							: message.role === "assistant"
								? message?.metadata?.modelName || "Assistant"
								: "System"}
					</span>
				</div>

				{/* Reasoning Section */}
				{reasoningContent && (
					<details className="group rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20">
						<summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded-t-lg transition-colors">
							<span className="inline-flex items-center gap-2">
								View Reasoning
							</span>
						</summary>
						<div className="px-3 py-2 text-sm text-amber-900/80 dark:text-amber-100/70 whitespace-pre-wrap border-t border-amber-200 dark:border-amber-800/30">
							{reasoningContent}
						</div>
					</details>
				)}

				{/* Tool Invocations (legacy format) */}
				{toolParts.map((part) => (
					<ToolInvocationPart
						key={part.toolInvocation.toolCallId}
						part={part}
					/>
				))}

				{/* Web Search Tool Parts (new format) */}
				{webSearchParts.map((part) => (
					<WebSearchToolPart key={part.toolCallId} part={part} />
				))}

				{/* Main Message Content */}
				<div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-[#282c34] prose-pre:p-0 prose-pre:m-0">
					{isAssistant ? (
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeRaw]}
							components={{
								code(props) {
									const { children, className, ...rest } = props;
									const match = /language-(\w+)/.exec(className || "");
									const language = match ? match[1] : "";
									const isInline = !language;

									return isInline ? (
										<code className={className} {...rest}>
											{children}
										</code>
									) : (
										<CodeBlock
											language={language}
											code={String(children).replace(/\n$/, "")}
										/>
									);
								},
							}}
						>
							{textContent}
						</ReactMarkdown>
					) : (
						<div className="whitespace-pre-wrap">{textContent}</div>
					)}
				</div>
			</div>
		</div>
	);
}
