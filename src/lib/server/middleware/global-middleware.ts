import { createMiddleware } from "@tanstack/react-start";
import { loadConfig } from "@/lib/server/loadConfig";

export const globalMiddleware = createMiddleware().server(({ next }) => {
	const config = loadConfig();
	return next({
		context: {
			config,
		},
	});
});
