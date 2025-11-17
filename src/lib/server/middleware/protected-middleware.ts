import { createMiddleware, json } from "@tanstack/react-start";
import { authMiddleware } from "./auth-middleware";

export const protectedMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user) {
      throw json({ error: "Unauthorized" }, { status: 401 });
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });
