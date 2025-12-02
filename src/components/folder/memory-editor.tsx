/**
 * Memory Editor Component
 *
 * Displays and allows editing of memory blocks with authorship tracking.
 */

import { Bot, Plus, Trash2, User } from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DB_FolderMemory, MemoryBlock } from "@/lib/client/db/schema";
import {
	useAddMemoryBlock,
	useUpdateMemoryBlocks,
} from "@/lib/client/hooks/use-memories";

interface MemoryEditorProps {
	memory: DB_FolderMemory;
	userId: string;
	isEditing: boolean;
}

export function MemoryEditor({ memory, userId, isEditing }: MemoryEditorProps) {
	const [editedBlocks, setEditedBlocks] = useState<MemoryBlock[]>(
		memory.blocks,
	);
	const [newBlockContent, setNewBlockContent] = useState("");

	const updateBlocks = useUpdateMemoryBlocks(userId);
	const addBlock = useAddMemoryBlock(userId);

	const handleBlockChange = (index: number, content: string) => {
		const updated = [...editedBlocks];
		updated[index] = {
			...updated[index],
			content,
			updatedAt: new Date().toISOString(),
		};
		setEditedBlocks(updated);
	};

	const handleSave = async () => {
		await updateBlocks.mutateAsync({
			memoryId: memory.id,
			blocks: editedBlocks,
		});
	};

	const handleDeleteBlock = async (index: number) => {
		const updated = editedBlocks.filter((_, i) => i !== index);
		setEditedBlocks(updated);
		await updateBlocks.mutateAsync({
			memoryId: memory.id,
			blocks: updated,
		});
	};

	const handleAddBlock = async () => {
		if (!newBlockContent.trim()) return;

		const newBlock: MemoryBlock = {
			id: nanoid(),
			source: "user",
			content: newBlockContent.trim(),
			createdAt: new Date().toISOString(),
		};

		await addBlock.mutateAsync({
			memoryId: memory.id,
			block: newBlock,
		});

		setEditedBlocks([...editedBlocks, newBlock]);
		setNewBlockContent("");
	};

	if (!isEditing) {
		// Read-only view
		return (
			<div className="space-y-4">
				{editedBlocks.map((block) => (
					<div key={block.id} className="rounded-lg bg-muted/50 p-4">
						<div className="mb-2 flex items-center gap-2">
							{block.source === "llm" ? (
								<Badge variant="secondary" className="gap-1">
									<Bot className="h-3 w-3" />
									AI Generated
								</Badge>
							) : (
								<Badge variant="outline" className="gap-1">
									<User className="h-3 w-3" />
									User Added
								</Badge>
							)}
							<span className="text-xs text-muted-foreground">
								{new Date(block.createdAt).toLocaleDateString()}
							</span>
						</div>
						<p className="whitespace-pre-wrap">{block.content}</p>
					</div>
				))}
			</div>
		);
	}

	// Editing view
	return (
		<div className="space-y-4">
			{editedBlocks.map((block, index) => (
				<div key={block.id} className="rounded-lg border p-4">
					<div className="mb-2 flex items-center justify-between">
						<div className="flex items-center gap-2">
							{block.source === "llm" ? (
								<Badge variant="secondary" className="gap-1">
									<Bot className="h-3 w-3" />
									AI Generated
								</Badge>
							) : (
								<Badge variant="outline" className="gap-1">
									<User className="h-3 w-3" />
									User Added
								</Badge>
							)}
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleDeleteBlock(index)}
						>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
					<Textarea
						value={block.content}
						onChange={(e) => handleBlockChange(index, e.target.value)}
						onBlur={handleSave}
						className="min-h-[100px]"
					/>
				</div>
			))}

			{/* Add new block */}
			<div className="rounded-lg border border-dashed p-4">
				<Textarea
					value={newBlockContent}
					onChange={(e) => setNewBlockContent(e.target.value)}
					placeholder="Add your own memory note..."
					className="mb-2 min-h-[80px]"
				/>
				<Button
					onClick={handleAddBlock}
					disabled={!newBlockContent.trim() || addBlock.isPending}
					size="sm"
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Memory
				</Button>
			</div>
		</div>
	);
}
