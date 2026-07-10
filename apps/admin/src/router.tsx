import { createRouter } from "@tanstack/react-router";
import * as TanstackQuery from "@/lib/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryContext = TanstackQuery.getContext();

  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    Wrap: ({ children }: { children: React.ReactNode }) => (
      <TanstackQuery.Provider {...queryContext}>{children}</TanstackQuery.Provider>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
