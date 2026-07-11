import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Ratio Admin" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html className="dark scroll-smooth" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Toaster />
        <NuqsAdapter>
          <Outlet />
        </NuqsAdapter>
        <TanStackDevtools plugins={[{ name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> }]} />
        <Scripts />
      </body>
    </html>
  );
}
