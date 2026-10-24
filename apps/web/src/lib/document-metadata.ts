import { createCanonicalLink, createJsonLdScript, createSeoMeta } from "@/lib/seo";

export const DOCUMENT_METADATA_SCRIPT_ID = "ratio-document-metadata";
export const DOCUMENT_JSON_LD_SCRIPT_ID = "ratio-document-json-ld";
export const DOCUMENT_METADATA_BOOTSTRAP_FALLBACK = "window.__RATIO_DOCUMENT_METADATA__=null;";
const trailingSlashesPattern = /\/+$/;

type AdditionalMeta =
  | { content: string; name: string; property?: never }
  | { content: string; name?: never; property: string };

export interface DocumentMetadata {
  additionalMeta?: AdditionalMeta[];
  description: string;
  image: string | null;
  imageAlt: string;
  jsonLd?: Record<string, unknown>;
  path: string;
  title: string;
  type: "article" | "music.album" | "profile";
}

export function createDocumentRouteHead(metadata: DocumentMetadata) {
  return {
    links: [createCanonicalLink(metadata.path)],
    meta: [
      ...createSeoMeta({
        description: metadata.description,
        image: metadata.image,
        imageAlt: metadata.imageAlt,
        path: metadata.path,
        title: metadata.title,
        twitterCard: "summary",
        type: metadata.type,
      }),
      ...(metadata.additionalMeta ?? []),
    ],
    scripts: metadata.jsonLd ? [{ ...createJsonLdScript(metadata.jsonLd), id: DOCUMENT_JSON_LD_SCRIPT_ID }] : [],
  };
}

export function getInitialDocumentMetadata(pathname?: string) {
  if (typeof window === "undefined") return null;

  const metadata = (
    window as typeof window & {
      __RATIO_DOCUMENT_METADATA__?: DocumentMetadata | null;
    }
  ).__RATIO_DOCUMENT_METADATA__;

  // The snapshot is valid only for the initial document path, including return navigation.
  return metadata &&
    normalizeDocumentPath(metadata.path) === normalizeDocumentPath(pathname ?? window.location.pathname)
    ? metadata
    : null;
}

function normalizeDocumentPath(path: string) {
  return path.replace(trailingSlashesPattern, "") || "/";
}
