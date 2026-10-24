import { createFileRoute } from "@tanstack/react-router";
import { getSitemapXml } from "@/server/services/sitemap-service";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(await getSitemapXml(), {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
});
