import { createFileRoute } from "@tanstack/react-router";
import { globalMiddleware } from "@/lib/server/middleware/global-middleware";
import { protectedMiddleware } from "@/lib/server/middleware/protected-middleware";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    middleware: [globalMiddleware, protectedMiddleware],
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
