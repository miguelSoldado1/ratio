import { afterEach, describe, expect, it } from "vitest";
import { createDocumentRouteHead, type DocumentMetadata, getInitialDocumentMetadata } from "@/lib/document-metadata";

const metadata = {
  description: "Read the album reviews.",
  image: "cover.jpg",
  imageAlt: "Album cover",
  path: "/album/album-a",
  title: "Album by Artist — Reviews | Ratio",
  type: "music.album",
} satisfies DocumentMetadata;

const metadataWindow = window as typeof window & {
  __RATIO_DOCUMENT_METADATA__?: DocumentMetadata | null;
};

afterEach(() => {
  metadataWindow.__RATIO_DOCUMENT_METADATA__ = undefined;
  window.history.replaceState(null, "", "/");
});

describe("initial document metadata", () => {
  it("is available only while the browser remains on its initial path", () => {
    metadataWindow.__RATIO_DOCUMENT_METADATA__ = metadata;
    window.history.replaceState(null, "", metadata.path);

    expect(getInitialDocumentMetadata()).toBe(metadata);

    window.history.replaceState(null, "", `${metadata.path}/`);

    expect(getInitialDocumentMetadata()).toBe(metadata);

    window.history.replaceState(null, "", "/user/listener");

    expect(getInitialDocumentMetadata()).toBeNull();
  });

  it("creates the same route head descriptors used by the document decorator", () => {
    const head = createDocumentRouteHead(metadata);

    expect(head.links).toContainEqual({
      href: "https://ratiomusic.live/album/album-a",
      rel: "canonical",
    });
    expect(head.meta).toContainEqual({ property: "og:title", content: metadata.title });
    expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary" });
  });
});
