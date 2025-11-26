import { createServerOnlyFn } from "@tanstack/react-start";
import { getAuth } from "./auth";
import { createDb } from "./db";

export const loadConfig = createServerOnlyFn(() => {
  const db = createDb();
  const auth = getAuth(db);

  return {
    env: process.env,
    db,
    auth,
  };
});
