import { createFileRoute } from "@tanstack/react-router";
import { globalMiddleware } from "@/server/middleware/global-middleware";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    middleware: [globalMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        // Create a new auth instance per request to avoid I/O isolation issues
        return context.config.auth.handler(request);
      },
      POST: async ({ request, context }) => {
        // Create a new auth instance per request to avoid I/O isolation issues
        return context.config.auth.handler(request);
      },
    },
  },
});
