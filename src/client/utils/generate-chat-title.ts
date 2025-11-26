/**
 * Generate a short, descriptive chat title from the first user message
 *
 * Rules:
 * - Max 50 characters
 * - Use first sentence or phrase
 * - Remove common filler words
 * - Capitalize first letter
 *
 * @param message - The first user message
 * @returns A short, descriptive title
 */
export function generateChatTitle(message: string): string {
	// Clean the message
	let title = message.trim();

	// If empty, return default
	if (!title) {
		return "New Chat";
	}

	// Take only the first sentence (up to first period, question mark, or exclamation)
	const sentenceMatch = title.match(/^[^.!?]+[.!?]?/);
	if (sentenceMatch) {
		title = sentenceMatch[0];
	}

	// Remove common filler words at the start
	const fillerWords = [
		"can you",
		"could you",
		"please",
		"i want to",
		"i need to",
		"help me",
		"i would like to",
		"i'd like to",
		"how do i",
		"how can i",
		"what is",
		"what are",
		"tell me",
		"show me",
		"explain",
	];

	const lowerTitle = title.toLowerCase();
	for (const filler of fillerWords) {
		if (lowerTitle.startsWith(filler)) {
			title = title.substring(filler.length).trim();
			break;
		}
	}

	// Capitalize first letter
	if (title.length > 0) {
		title = title.charAt(0).toUpperCase() + title.slice(1);
	}

	// Remove trailing punctuation except for question marks
	if (title.endsWith(".") || title.endsWith("!")) {
		title = title.slice(0, -1);
	}

	// Truncate to max length
	const maxLength = 50;
	if (title.length > maxLength) {
		// Try to cut at a word boundary
		const truncated = title.substring(0, maxLength);
		const lastSpace = truncated.lastIndexOf(" ");
		if (lastSpace > maxLength * 0.6) {
			// If we can cut at a word boundary without losing too much, do it
			title = truncated.substring(0, lastSpace) + "...";
		} else {
			// Otherwise just truncate and add ellipsis
			title = truncated + "...";
		}
	}

	// Final check - if we ended up with an empty string, return default
	if (!title || title === "...") {
		return "New Chat";
	}

	return title;
}
