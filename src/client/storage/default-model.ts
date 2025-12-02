/**
 * Default Model Storage
 *
 * Manages the user's preferred default model for new chats.
 * Stored in localStorage for quick access.
 */

const DEFAULT_MODEL_STORAGE_KEY = "default_model";

/**
 * Get the user's default model
 * @returns The default model ID or null if not set
 */
export function getDefaultModel(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(DEFAULT_MODEL_STORAGE_KEY);
}

/**
 * Set the user's default model
 * @param modelId - The model ID to set as default
 */
export function setDefaultModel(modelId: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(DEFAULT_MODEL_STORAGE_KEY, modelId);
}

/**
 * Remove the user's default model
 */
export function removeDefaultModel(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(DEFAULT_MODEL_STORAGE_KEY);
}

/**
 * Check if a default model is set
 * @returns true if a default model is set
 */
export function hasDefaultModel(): boolean {
	const model = getDefaultModel();
	return model !== null && model.trim() !== "";
}
