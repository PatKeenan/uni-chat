import { createMiddleware } from "@tanstack/react-start";
import { globalMiddleware } from "../middleware/global-middleware";

export const authMiddleware = createMiddleware()
	.middleware([globalMiddleware])
	.server(async ({ next, request, context }) => {
		// Create a new auth instance per request to avoid I/O isolation issues
		const data = await context?.config.auth.api.getSession(request);
		const session = data?.session ?? null;
		const user = data?.user ?? null;

		return next({
			context: {
				session,
				user,
			},
		});
	});
