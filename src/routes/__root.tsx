import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

//import appCss from "../styles.css?url";
import newCss from "../new-css.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Muse | Chat with AI",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: newCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/*  <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
        /> */}
        <Scripts />
      </body>
    </html>
  );
}
