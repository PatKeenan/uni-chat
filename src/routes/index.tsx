import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/client/auth";

export const Route = createFileRoute("/")({
  component: App,
  beforeLoad: async () => {
    const session = await getSession();
    if (session.data?.user) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/login" });
    }
  },
});

function App() {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <aside className="gap-6 flex flex-col w-80 border-r border-gray-300 py-8 ">
        {/* header in sidebard */}
        <div className="px-8 pb-6 border-b border-gray-300">
          <img
            src="/tanstack-circle-logo.png"
            alt="Logo"
            className="h-12 object-contain"
          />
        </div>

        {/* content in sidebard */}

        {/* footer in sidebard */}
        <div className="px-8 pb-3">
          <div>footer</div>
        </div>
      </aside>
      <main>
        {/* Header */}
        <section></section>

        {/* Content */}
        <section></section>
      </main>
    </div>
  );
}
