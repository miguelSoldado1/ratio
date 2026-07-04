import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { NotFoundPage } from "@/components/not-found-page";
import { TopBar } from "@/components/top-bar";
import { Toaster } from "@/components/ui/sonner";
import { defaultSeoDescription, defaultSeoTitle } from "@/lib/seo";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#151515" },
      { name: "apple-mobile-web-app-title", content: "Ratio" },
      {
        name: "description",
        content: defaultSeoDescription,
      },
      { title: defaultSeoTitle },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: () => (
    <>
      <a
        className="sr-only z-60 rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-none focus:ring-3 focus:ring-ring/30"
        href="#main-content"
      >
        Skip to main content
      </a>
      <TopBar />
      <div id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
    </>
  ),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        <Toaster />
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
            { name: "Tanstack Query", render: <ReactQueryDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
