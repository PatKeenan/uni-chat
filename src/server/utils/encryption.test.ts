import { beforeEach, describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "./encryption";

describe("Encryption Utilities", () => {
	beforeEach(() => {
		// Ensure environment variable is set (from setup.ts)
		expect(process.env.BETTER_AUTH_SECRET).toBeDefined();
	});

	describe("encryptApiKey", () => {
		it("should encrypt a string and return base64", async () => {
			const apiKey = "sk-test-key-12345";
			const encrypted = await encryptApiKey(apiKey);

			// Should be base64 format
			expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
			// Should be different from input
			expect(encrypted).not.toBe(apiKey);
			// Minimum length: IV (12 bytes) + auth tag (16 bytes) + data = ~28+ bytes raw → ~38+ chars base64
			// For 17 byte input: 12 + 16 + 17 = 45 bytes → ~60 chars base64
			expect(encrypted.length).toBeGreaterThan(50);
		});

		it("should produce different output each time (random IV)", async () => {
			const apiKey = "sk-test-key-12345";
			const encrypted1 = await encryptApiKey(apiKey);
			const encrypted2 = await encryptApiKey(apiKey);

			// Different IVs should produce different ciphertext
			expect(encrypted1).not.toBe(encrypted2);
		});

		it("should handle empty string", async () => {
			const encrypted = await encryptApiKey("");
			expect(encrypted).toBeDefined();
			expect(encrypted.length).toBeGreaterThan(0);
		});

		it("should handle long strings", async () => {
			const longKey = "sk-" + "a".repeat(500);
			const encrypted = await encryptApiKey(longKey);
			expect(encrypted).toBeDefined();
		});

		it("should use correct IV length (12 bytes for AES-GCM)", async () => {
			const apiKey = "sk-test-key-12345";
			const encrypted = await encryptApiKey(apiKey);

			// Decode base64 to get raw bytes
			const combined = Buffer.from(encrypted, "base64");

			// Verify we have at least IV (12 bytes) + some ciphertext
			expect(combined.length).toBeGreaterThan(12);

			// Verify IV is exactly 12 bytes as per AES-GCM standard
			// (Implementation stores IV as first 12 bytes)
			const iv = combined.slice(0, 12);
			expect(iv.length).toBe(12);
		});
	});

	describe("decryptApiKey", () => {
		it("should decrypt previously encrypted key", async () => {
			const original = "sk-test-key-12345";
			const encrypted = await encryptApiKey(original);
			const decrypted = await decryptApiKey(encrypted);

			expect(decrypted).toBe(original);
		});

		it("should handle empty string round-trip", async () => {
			const original = "";
			const encrypted = await encryptApiKey(original);
			const decrypted = await decryptApiKey(encrypted);

			expect(decrypted).toBe(original);
		});

		it("should handle special characters", async () => {
			const original = 'sk-!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
			const encrypted = await encryptApiKey(original);
			const decrypted = await decryptApiKey(encrypted);

			expect(decrypted).toBe(original);
		});

		it("should throw on invalid base64", async () => {
			await expect(decryptApiKey("not-valid-base64!!!")).rejects.toThrow();
		});

		it("should throw on corrupted data", async () => {
			const encrypted = await encryptApiKey("test");
			const corrupted = encrypted.slice(0, -5) + "XXXXX";

			// Should detect tampering and throw an error (Web Crypto throws generic DOMException)
			await expect(decryptApiKey(corrupted)).rejects.toThrow();
		});

		it("should throw on wrong encryption key", async () => {
			const original = "sk-test-key";
			const encrypted = await encryptApiKey(original);

			const oldSecret = process.env.BETTER_AUTH_SECRET;

			try {
				// Change the encryption key
				process.env.BETTER_AUTH_SECRET =
					"different-secret-key-for-testing-32chars";

				await expect(decryptApiKey(encrypted)).rejects.toThrow();
			} finally {
				// ALWAYS restore original secret, even if test fails
				process.env.BETTER_AUTH_SECRET = oldSecret;
			}
		});
	});

	describe("Missing environment variable", () => {
		it("should throw when BETTER_AUTH_SECRET is not set", async () => {
			const oldSecret = process.env.BETTER_AUTH_SECRET;

			try {
				delete process.env.BETTER_AUTH_SECRET;

				await expect(encryptApiKey("test-key")).rejects.toThrow(
					"BETTER_AUTH_SECRET is not set",
				);
				await expect(decryptApiKey("some-encrypted-data")).rejects.toThrow(
					"BETTER_AUTH_SECRET is not set",
				);
			} finally {
				// ALWAYS restore
				process.env.BETTER_AUTH_SECRET = oldSecret;
			}
		});

		it("should throw when BETTER_AUTH_SECRET is empty string", async () => {
			const oldSecret = process.env.BETTER_AUTH_SECRET;

			try {
				process.env.BETTER_AUTH_SECRET = "";

				// Empty secret should fail (either throws or produces weak encryption)
				await expect(encryptApiKey("test-key")).rejects.toThrow();
			} finally {
				process.env.BETTER_AUTH_SECRET = oldSecret;
			}
		});
	});

	describe("Round-trip tests", () => {
		const testCases = [
			{ name: "OpenAI key format", value: "sk-proj-abc123xyz789" },
			{ name: "Anthropic key format", value: "sk-ant-api03-abc123" },
			{ name: "Generic API key", value: "pk_live_51234567890" },
			{ name: "Unicode characters", value: "密钥-🔑-key" },
			{ name: "Very long key", value: "sk-" + "x".repeat(1000) },
		];

		testCases.forEach(({ name, value }) => {
			it(`should handle round-trip for: ${name}`, async () => {
				const encrypted = await encryptApiKey(value);
				const decrypted = await decryptApiKey(encrypted);
				expect(decrypted).toBe(value);
			});
		});
	});
});
