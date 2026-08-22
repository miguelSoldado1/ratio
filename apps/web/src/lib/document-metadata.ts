import { createCanonicalLink, createSeoMeta } from "@/lib/seo";

export const DOCUMENT_METADATA_SCRIPT_ID = "ratio-document-metadata";
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
  };
}

export function getInitialDocumentMetadata() {
  if (typeof window === "undefined") return null;

  const metadata = (
    window as typeof window & {
      __RATIO_DOCUMENT_METADATA__?: DocumentMetadata | null;
    }
  ).__RATIO_DOCUMENT_METADATA__;

  // The snapshot belongs to the initial document and must not leak into later client navigation.
  return metadata && normalizeDocumentPath(metadata.path) === normalizeDocumentPath(window.location.pathname)
    ? metadata
    : null;
}

function normalizeDocumentPath(path: string) {
  return path.replace(trailingSlashesPattern, "") || "/";
}
