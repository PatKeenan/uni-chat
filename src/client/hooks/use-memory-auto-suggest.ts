/**
 * Memory Auto-Suggest Hook
 *
 * Monitors message count and suggests memory creation.
 */

import { useEffect, useState } from "react";
import { getMemoryByFolderId } from "../actions/memory-actions";
import {
	getAutoSuggestThreshold,
	isAutoSuggestEnabled,
	isMemoryEnabled,
} from "../storage/memory-settings";

interface UseMemoryAutoSuggestOptions {
	chatId: string;
	userId: string;
	folderId: string | null;
	messageCount: number;
}

export function useMemoryAutoSuggest({
	chatId,
	userId,
	folderId,
	messageCount,
}: UseMemoryAutoSuggestOptions) {
	const [shouldSuggest, setShouldSuggest] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (dismissed) return;
		if (!isMemoryEnabled() || !isAutoSuggestEnabled()) {
			setShouldSuggest(false);
			return;
		}

		const threshold = getAutoSuggestThreshold();
		if (messageCount > 0 && messageCount % threshold === 0) {
			// Check if this chat is already in memory
			getMemoryByFolderId(userId, folderId).then((memory) => {
				if (!memory) {
					setShouldSuggest(true);
				} else {
					const isIncluded = memory.includedChats.some(
						(c) => c.chatId === chatId,
					);
					if (!isIncluded) {
						setShouldSuggest(true);
					}
				}
			});
		}
	}, [messageCount, chatId, userId, folderId, dismissed]);

	const dismiss = () => {
		setDismissed(true);
		setShouldSuggest(false);
	};

	return {
		shouldSuggest,
		dismiss,
	};
}
