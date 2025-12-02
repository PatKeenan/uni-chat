/**
 * Client-side memory settings storage using localStorage
 *
 * Stores user preferences for the memories feature:
 * - Whether memories are enabled
 * - Auto-suggest threshold (number of messages before suggesting memory creation)
 */

import { DEFAULT_MEMORY_SETTINGS } from "@/types";

const MEMORY_ENABLED_KEY = "memory_enabled";
const MEMORY_AUTO_SUGGEST_THRESHOLD_KEY = "memory_auto_suggest_threshold";

/**
 * Get whether the memories feature is enabled
 * @returns true if enabled (default), false if disabled
 */
export function getMemoryEnabled(): boolean {
	if (typeof window === "undefined") return DEFAULT_MEMORY_SETTINGS.enabled;
	const stored = localStorage.getItem(MEMORY_ENABLED_KEY);
	if (stored === null) return DEFAULT_MEMORY_SETTINGS.enabled;
	return stored === "true";
}

/**
 * Set whether the memories feature is enabled
 */
export function setMemoryEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(MEMORY_ENABLED_KEY, String(enabled));
}

/**
 * Get the auto-suggest threshold (number of messages before suggesting memory creation)
 * @returns threshold number (default 20), 0 means disabled
 */
export function getAutoSuggestThreshold(): number {
	if (typeof window === "undefined")
		return DEFAULT_MEMORY_SETTINGS.autoSuggestThreshold;
	const stored = localStorage.getItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY);
	if (stored === null) return DEFAULT_MEMORY_SETTINGS.autoSuggestThreshold;
	const parsed = Number.parseInt(stored, 10);
	return Number.isNaN(parsed)
		? DEFAULT_MEMORY_SETTINGS.autoSuggestThreshold
		: parsed;
}

/**
 * Set the auto-suggest threshold
 * @param threshold - number of messages (0 to disable auto-suggest)
 */
export function setAutoSuggestThreshold(threshold: number): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY, String(threshold));
}

/**
 * Check if auto-suggest is enabled (threshold > 0)
 */
export function isAutoSuggestEnabled(): boolean {
	return getAutoSuggestThreshold() > 0;
}

/**
 * Reset memory settings to defaults
 */
export function resetMemorySettings(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(MEMORY_ENABLED_KEY);
	localStorage.removeItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY);
}
