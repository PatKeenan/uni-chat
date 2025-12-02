/**
 * Folder Homepage Route
 *
 * Displays folder overview with chat count and memory editor.
 */

import { createFileRoute, notFound } from "@tanstack/react-router";
import { FolderView } from "@/components/folder/folder-view";
import { getLocalChats } from "@/lib/client/actions/chat-actions";
import { getLocalFolderById } from "@/lib/client/actions/folder-actions";
import { getMemoryByFolderId } from "@/lib/client/actions/memory-actions";

export const Route = createFileRoute("/dashboard/folder/$folderId")({
	component: FolderViewPage,

	loader: async ({ params, context }) => {
		const userId = context.user?.id ?? "";
		const isUncategorized = params.folderId === "uncategorized";
		const folderId = isUncategorized ? null : params.folderId;

		const [folder, chats, memory] = await Promise.all([
			folderId
				? context.queryClient.ensureQueryData({
						queryKey: ["folder", params.folderId],
						queryFn: () => getLocalFolderById(params.folderId, userId),
					})
				: null,
			context.queryClient.ensureQueryData({
				queryKey: ["local-chats", userId, { folderId }],
				queryFn: () => getLocalChats(userId, { folderId }),
			}),
			context.queryClient.ensureQueryData({
				queryKey: ["memories", userId, "folder", folderId ?? "uncategorized"],
				queryFn: () => getMemoryByFolderId(userId, folderId),
			}),
		]);

		// Only throw notFound for non-uncategorized folders that don't exist
		if (folderId && !folder) {
			throw notFound();
		}

		return {
			folder,
			folderId,
			chats,
			memory,
			userId,
			isUncategorized,
		};
	},
});

function FolderViewPage() {
	const data = Route.useLoaderData();
	return <FolderView {...data} />;
}
