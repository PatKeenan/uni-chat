import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/server/middleware/auth-middleware";

export const getUser = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		return context.user;
	});
