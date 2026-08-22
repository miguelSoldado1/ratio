import { describe, expect, it } from "vitest";
import {
  createDocumentHeadMarkup,
  createDocumentMetadataBootstrap,
  decorateDocumentResponse,
} from "@/server/document-head";
import type { DocumentMetadata } from "@/lib/document-metadata";

const albumMetadata = {
  description: "Read A & B's album.",
  image: "https://image.example/album.jpg",
  imageAlt: "A & B album cover",
  path: "/album/album-a",
  title: "A & B <Live> by Artist — Reviews | Ratio",
  type: "music.album",
} satisfies DocumentMetadata;

describe("document head decoration", () => {
  it("replaces generic managed tags in an HTML shell", async () => {
    const shell = new Response(
      '<!doctype html><html><head><title>Generic</title><meta name="description" content="Generic"><meta property="og:title" content="Generic"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="https://ratiomusic.live/"><script id="ratio-document-metadata">window.__RATIO_DOCUMENT_METADATA__=null;</script></head><body>Shell</body></html>',
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );

    const response = await decorateDocumentResponse(shell, albumMetadata);
    const html = await response.text();

    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("<title>A &amp; B &lt;Live&gt; by Artist — Reviews | Ratio</title>");
    expect(html).toContain('<meta property="og:image" content="https://image.example/album.jpg">');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
    expect(html).toContain('<link rel="canonical" href="https://ratiomusic.live/album/album-a">');
    expect(html).not.toContain('content="Generic"');
    expect(html).toContain(createDocumentMetadataBootstrap(albumMetadata));
    expect(html).toContain("<body>Shell</body>");
  });

  it("adds default image dimensions when route artwork is unavailable", () => {
    const markup = createDocumentHeadMarkup({
      ...albumMetadata,
      image: null,
      imageAlt: "Ratio album reviews",
    });

    expect(markup).toContain('<meta property="og:image" content="https://ratiomusic.live/og-image.png">');
    expect(markup).toContain('<meta property="og:image:width" content="1200">');
    expect(markup).toContain('<meta property="og:image:height" content="630">');
  });

  it("leaves non-HTML responses untouched", () => {
    const response = new Response("{}", { headers: { "content-type": "application/json" } });

    expect(decorateDocumentResponse(response, albumMetadata)).toBe(response);
  });

  it("serializes bootstrap metadata without allowing a closing script tag", () => {
    const bootstrap = createDocumentMetadataBootstrap({
      ...albumMetadata,
      description: "</script><script>alert('no')</script>",
    });

    expect(bootstrap).not.toContain("</script>");
    expect(bootstrap).toContain("\\u003c/script\\u003e");
  });
});
