/**
 * Memory Settings Storage
 *
 * Manages user preferences for the memories feature.
 * Stored in localStorage for quick access.
 */

const MEMORY_ENABLED_KEY = "memory_enabled";
const MEMORY_AUTO_SUGGEST_THRESHOLD_KEY = "memory_auto_suggest_threshold";

const DEFAULT_THRESHOLD = 20;

/**
 * Check if memories feature is enabled
 */
export function isMemoryEnabled(): boolean {
	if (typeof window === "undefined") return true; // Default enabled
	const value = localStorage.getItem(MEMORY_ENABLED_KEY);
	return value === null ? true : value === "true";
}

/**
 * Enable or disable memories feature
 */
export function setMemoryEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(MEMORY_ENABLED_KEY, String(enabled));
}

/**
 * Get auto-suggest threshold (number of messages)
 * Returns 0 if auto-suggest is disabled
 */
export function getAutoSuggestThreshold(): number {
	if (typeof window === "undefined") return DEFAULT_THRESHOLD;
	const value = localStorage.getItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY);
	if (value === null) return DEFAULT_THRESHOLD;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? DEFAULT_THRESHOLD : parsed;
}

/**
 * Set auto-suggest threshold
 * Set to 0 to disable auto-suggest
 */
export function setAutoSuggestThreshold(threshold: number): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(MEMORY_AUTO_SUGGEST_THRESHOLD_KEY, String(threshold));
}

/**
 * Check if auto-suggest is enabled
 */
export function isAutoSuggestEnabled(): boolean {
	return getAutoSuggestThreshold() > 0;
}
