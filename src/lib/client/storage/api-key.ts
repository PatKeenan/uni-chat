/**
 * Client-side API key storage using localStorage
 *
 * NOTE: This is NOT encrypted. For production, consider using:
 * - WebCrypto API for encryption
 * - IndexedDB with encryption
 * - Or a secure key management service
 *
 * For now, we store it in plain text in localStorage as this is a local-first app
 * and the data never leaves the user's browser.
 */

const API_KEY_STORAGE_KEY = "openrouter_api_key";
const TAVILY_API_KEY_STORAGE_KEY = "tavily_api_key";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
}

export function getTavilyApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TAVILY_API_KEY_STORAGE_KEY);
}

export function setTavilyApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TAVILY_API_KEY_STORAGE_KEY, apiKey);
}

export function removeTavilyApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TAVILY_API_KEY_STORAGE_KEY);
}

export function hasTavilyApiKey(): boolean {
  const key = getTavilyApiKey();
  return key !== null && key.trim() !== "";
}

export function removeApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.trim() !== "";
}
