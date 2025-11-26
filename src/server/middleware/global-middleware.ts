import { createMiddleware } from "@tanstack/react-start";
import { loadConfig } from "@/server/config";

export const globalMiddleware = createMiddleware().server(({ next }) => {
	const config = loadConfig();
	return next({
		context: {
			config,
		},
	});
});
