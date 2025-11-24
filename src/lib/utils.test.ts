import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("Utility Functions", () => {
	describe("cn (classname merger)", () => {
		it("should merge class names", () => {
			const result = cn("btn", "btn-primary");
			expect(result).toBe("btn btn-primary");
		});

		it("should handle conditional classes", () => {
			const isActive = true;
			const result = cn("btn", isActive && "active");
			expect(result).toContain("active");
		});

		it("should filter out falsy values", () => {
			const result = cn("btn", false, null, undefined, "primary");
			expect(result).toBe("btn primary");
		});

		it("should handle Tailwind conflicts with clsx/tailwind-merge", () => {
			// Assuming cn uses tailwind-merge
			const result = cn("px-2 py-1", "p-4");
			// tailwind-merge should resolve conflicts (p-4 overrides px-2 py-1)
			expect(result).toContain("p-4");
			expect(result).not.toContain("px-2");
			expect(result).not.toContain("py-1");
		});

		it("should handle empty input", () => {
			const result = cn();
			expect(result).toBe("");
		});

		it("should handle arrays of classes", () => {
			const result = cn(["btn", "btn-primary"]);
			expect(result).toBe("btn btn-primary");
		});

		it("should handle objects with boolean values", () => {
			const result = cn({
				btn: true,
				"btn-primary": true,
				"btn-disabled": false,
			});
			expect(result).toContain("btn");
			expect(result).toContain("btn-primary");
			expect(result).not.toContain("btn-disabled");
		});

		it("should handle mixed input types", () => {
			const result = cn(
				"btn",
				{ "btn-primary": true },
				["text-white"],
				false && "hidden",
			);
			expect(result).toContain("btn");
			expect(result).toContain("btn-primary");
			expect(result).toContain("text-white");
			expect(result).not.toContain("hidden");
		});

		it("should handle duplicate classes", () => {
			const result = cn("btn", "btn", "primary");
			// clsx doesn't automatically deduplicate non-conflicting classes
			expect(result).toContain("btn");
			expect(result).toContain("primary");
		});

		it("should handle responsive Tailwind classes", () => {
			const result = cn("text-sm", "md:text-base", "lg:text-lg");
			expect(result).toBe("text-sm md:text-base lg:text-lg");
		});
	});
});
