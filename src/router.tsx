import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { DefaultCatchBoundary } from "./components/default-catch-boundary";
import { NotFound } from "./components/not-found";

export function getRouter() {
	const queryClient = new QueryClient({
		queryCache: new QueryCache({
			onError(error) {
				if (error.message === `{"error":"Unauthorized"}`) {
					//window.location.href = "/unauthorized";
				}
			},
		}),
		defaultOptions: {
			queries: {
				retry(_, error) {
					if (error.message === `{"error":"Unauthorized"}`) {
						return false;
					}
					return true;
				},
			},
		},
	});

	const router = createRouter({
		routeTree,
		context: { queryClient },
		defaultPreload: "intent",
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => <NotFound />,
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
