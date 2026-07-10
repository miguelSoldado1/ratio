import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import * as TanstackQuery from "@/lib/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const rqContext = TanstackQuery.getContext();

  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    Wrap: (props: { children: React.ReactNode }) => (
      <TanstackQuery.Provider {...rqContext}>{props.children}</TanstackQuery.Provider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
