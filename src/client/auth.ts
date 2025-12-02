import { createAuthClient } from "better-auth/react";

export const { useSession, signIn, signOut, signUp, getSession } =
  createAuthClient({
    baseURL:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://muse.patkeenan-dev.workers.dev",
  });
