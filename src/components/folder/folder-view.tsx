/**
 * Folder View Component
 *
 * Displays folder overview with memory editor.
 */

import { Link } from "@tanstack/react-router";
import { Brain, Folder, MessageSquare, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type {
	DB_Chat,
	DB_Folder,
	DB_FolderMemory,
} from "@/lib/client/db/schema";
import {
	useGetOrCreateMemory,
	useMemory,
} from "@/lib/client/hooks/use-memories";
import { MemoryEditor } from "./memory-editor";

interface FolderViewProps {
	folder: DB_Folder | null;
	folderId: string | null;
	chats: DB_Chat[];
	memory: DB_FolderMemory | null;
	userId: string;
	isUncategorized: boolean;
}

export function FolderView({
	folder,
	folderId,
	chats,
	memory: initialMemory,
	userId,
	isUncategorized,
}: FolderViewProps) {
	const [isEditing, setIsEditing] = useState(false);
	const { data: memory } = useMemory(userId, folderId);
	const getOrCreateMemory = useGetOrCreateMemory(userId);

	const currentMemory = memory ?? initialMemory;
	const hasMemory = currentMemory && currentMemory.blocks.length > 0;

	const handleGenerateMemory = async () => {
		await getOrCreateMemory.mutateAsync(folderId);
		setIsEditing(true);
	};

	return (
		<div className="container mx-auto max-w-4xl p-6">
			{/* Header */}
			<div className="mb-8">
				<div className="mb-2 flex items-center gap-3">
					<Folder className="h-8 w-8 text-primary" />
					<h1 className="text-3xl font-bold">
						{isUncategorized ? "Uncategorized" : folder?.name}
					</h1>
				</div>
				<p className="text-muted-foreground">
					{chats.length} {chats.length === 1 ? "chat" : "chats"} in this folder
				</p>
			</div>

			{/* Memory Section */}
			<Card className="mb-8">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Brain className="h-5 w-5" />
							<CardTitle>Folder Memory</CardTitle>
						</div>
						{hasMemory ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsEditing(!isEditing)}
							>
								<Pencil className="mr-2 h-4 w-4" />
								{isEditing ? "Done Editing" : "Edit Memory"}
							</Button>
						) : (
							<Button
								variant="default"
								size="sm"
								onClick={handleGenerateMemory}
								disabled={getOrCreateMemory.isPending || chats.length === 0}
							>
								<Brain className="mr-2 h-4 w-4" />
								{getOrCreateMemory.isPending
									? "Creating..."
									: "Generate Memory"}
							</Button>
						)}
					</div>
					<CardDescription>
						{hasMemory
							? "Context extracted from conversations in this folder"
							: chats.length === 0
								? "Add chats to this folder to generate memories"
								: "Generate memories from your conversations to maintain context across chats"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{hasMemory && currentMemory ? (
						<MemoryEditor
							memory={currentMemory}
							userId={userId}
							isEditing={isEditing}
						/>
					) : (
						<div className="py-8 text-center text-muted-foreground">
							<Brain className="mx-auto mb-4 h-12 w-12 opacity-50" />
							<p>No memories yet</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Recent Chats */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						Chats
					</CardTitle>
				</CardHeader>
				<CardContent>
					{chats.length === 0 ? (
						<p className="py-4 text-center text-muted-foreground">
							No chats in this folder
						</p>
					) : (
						<div className="space-y-2">
							{chats.slice(0, 10).map((chat) => (
								<Link
									key={chat.id}
									to="/dashboard/c/$chatId"
									params={{ chatId: chat.id }}
									className="block rounded-lg p-3 transition-colors hover:bg-muted"
								>
									<div className="font-medium">
										{chat.title || "Untitled Chat"}
									</div>
									<div className="text-sm text-muted-foreground">
										{new Date(chat.updatedAt).toLocaleDateString()}
									</div>
								</Link>
							))}
							{chats.length > 10 && (
								<p className="pt-2 text-center text-sm text-muted-foreground">
									And {chats.length - 10} more...
								</p>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
