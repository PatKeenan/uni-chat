/**
 * Encryption utilities for securely storing API keys
 * Uses Web Crypto API for AES-256-GCM encryption
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

/**
 * Derives an encryption key from the environment secret
 * Uses PBKDF2 with a static salt (safe for server-side use)
 */
async function getEncryptionKey(): Promise<CryptoKey> {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("BETTER_AUTH_SECRET is not set");
	}

	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "PBKDF2" },
		false,
		["deriveKey"],
	);

	// Static salt is acceptable for server-side encryption
	// as we're protecting data at rest, not transmitting keys
	const salt = encoder.encode("uni-chat-api-key-salt");

	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: ALGORITHM, length: KEY_LENGTH },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * Encrypts an API key for secure storage
 *
 * @param apiKey - Plain text API key
 * @returns Base64-encoded encrypted data with IV prepended
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
	const key = await getEncryptionKey();
	const encoder = new TextEncoder();
	const data = encoder.encode(apiKey);

	// Generate random IV for each encryption
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const encrypted = await crypto.subtle.encrypt(
		{
			name: ALGORITHM,
			iv,
		},
		key,
		data,
	);

	// Prepend IV to encrypted data
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);

	// Return as base64
	return Buffer.from(combined).toString("base64");
}

/**
 * Decrypts an encrypted API key
 *
 * @param encryptedData - Base64-encoded encrypted data with IV
 * @returns Decrypted API key
 */
export async function decryptApiKey(encryptedData: string): Promise<string> {
	const key = await getEncryptionKey();
	const combined = Buffer.from(encryptedData, "base64");

	// Extract IV (first 12 bytes) and encrypted data
	const iv = combined.slice(0, 12);
	const encrypted = combined.slice(12);

	const decrypted = await crypto.subtle.decrypt(
		{
			name: ALGORITHM,
			iv,
		},
		key,
		encrypted,
	);

	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
}
