import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { TopBar } from "@/components/top-bar";
import { Toaster } from "@/components/ui/sonner";
import { defaultSeoDescription, defaultSeoTitle, faviconLinks } from "@/lib/seo";
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
    links: [{ rel: "stylesheet", href: appCss }, ...faviconLinks],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
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
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html className="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Toaster />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
