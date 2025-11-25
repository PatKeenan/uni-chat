import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getUser } from "@/lib/server/actions/auth-actions";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const data = await getUser();
    return {
      user: data,
    };
  },
  loader: async ({ context }) => {
    if (!context?.user) {
      throw redirect({ to: "/login" });
    }
    return {
      user: context.user,
    };
  },
});

function RouteComponent() {
  const { user } = Route.useLoaderData();

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          id: user?.id ?? "",
          name: user?.name ?? "",
          email: user?.email ?? "",
          avatar: user?.image ?? "",
        }}
      />
      <SidebarInset className="h-screen">
        <main className="flex flex-1 flex-col gap-4 pt-0 min-h-screen">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
