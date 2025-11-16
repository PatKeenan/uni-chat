import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/unauthorized")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Unauthorized. You are not allowed to access this page.</div>;
}
