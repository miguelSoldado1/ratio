import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  createDocumentRouteHead,
  DOCUMENT_JSON_LD_SCRIPT_ID,
  getInitialDocumentMetadata,
} from "@/lib/document-metadata";
import { createJsonLdScript } from "@/lib/seo";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "__RATIO_DOCUMENT_METADATA__");
  window.history.replaceState(null, "", "/");
});

it("lets TanStack remove and restore album JSON-LD during navigation", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  const jsonLd = { "@type": "MusicAlbum", name: "Album </script> & Artist" };
  const metadata = {
    description: "Album reviews",
    image: null,
    imageAlt: "Album cover",
    jsonLd,
    path: "/album/album-a",
    title: "Album",
    type: "music.album",
  };
  Object.assign(window, { __RATIO_DOCUMENT_METADATA__: metadata });
  window.history.replaceState(null, "", metadata.path);
  const rootRoute = createRootRoute({ component: DocumentShell });
  const albumRoute = createRoute({
    getParentRoute: () => rootRoute,
    head: ({ params }) => {
      const initialMetadata = getInitialDocumentMetadata(`/album/${params.albumId}`);
      return initialMetadata
        ? createDocumentRouteHead(initialMetadata)
        : { scripts: [{ ...createJsonLdScript([]), id: DOCUMENT_JSON_LD_SCRIPT_ID }] };
    },
    path: "/album/$albumId",
  });
  const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/user/$username" });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [metadata.path] }),
    routeTree: rootRoute.addChildren([albumRoute, profileRoute]),
  });
  await router.load();
  render(<RouterProvider router={router} />, { container: document });
  await waitFor(() => expect(readJsonLd()).toEqual(jsonLd));

  await act(() => router.navigate({ params: { username: "listener" }, to: "/user/$username" }));
  expect(document.getElementById(DOCUMENT_JSON_LD_SCRIPT_ID)).toBeNull();

  await act(() => router.navigate({ params: { albumId: "another-album" }, to: "/album/$albumId" }));
  expect(readJsonLd()).toEqual([]);

  await act(() => router.navigate({ params: { albumId: "album-a" }, to: "/album/$albumId" }));
  expect(readJsonLd()).toEqual(jsonLd);
  expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
});

function DocumentShell() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}

function readJsonLd() {
  return JSON.parse(document.getElementById(DOCUMENT_JSON_LD_SCRIPT_ID)?.textContent ?? "null");
}
