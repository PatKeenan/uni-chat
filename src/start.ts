import { createStart } from "@tanstack/react-start";
import { loggerMiddleware } from "./lib/server/middleware/logger.middleware";

export const startInstance = createStart(() => {
	return {
		requestMiddleware: [loggerMiddleware],
	};
});
