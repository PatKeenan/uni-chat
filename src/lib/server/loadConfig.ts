import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { getAuth } from "./auth";
import { createDb } from "./db";

export const loadConfig = createServerOnlyFn(() => {
	const db = createDb();
	const auth = getAuth(db);

	return {
		env,
		db,
		auth,
	};
});
