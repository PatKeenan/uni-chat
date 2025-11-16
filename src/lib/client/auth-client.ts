import { createAuthClient } from "better-auth/react";

export const { useSession, signIn, signOut, signUp, getSession } =
	createAuthClient({
		baseURL:
			typeof window !== "undefined"
				? window.location.origin
				: process.env.BETTER_AUTH_URL ||
					process.env.PUBLIC_APP_URL ||
					"http://localhost:3000",
	});
