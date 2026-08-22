import { createDocumentRouteHead, DOCUMENT_METADATA_SCRIPT_ID, type DocumentMetadata } from "@/lib/document-metadata";

const managedHeadSelectors = [
  "title",
  'link[rel="canonical"]',
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[name^="twitter:"]',
  'meta[property^="og:"]',
  'meta[property="profile:username"]',
];
const closingHeadPattern = /<\/head>/i;
const canonicalLinkPattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi;
const managedNamedMetaPattern = /<meta\b(?=[^>]*\bname=["'](?:description|robots|twitter:[^"']+)["'])[^>]*>/gi;
const managedPropertyMetaPattern = /<meta\b(?=[^>]*\bproperty=["'](?:og:[^"']+|profile:username)["'])[^>]*>/gi;
const titlePattern = /<title\b[^>]*>[\s\S]*?<\/title>/gi;
const metadataScriptPattern = new RegExp(
  `(<script\\b(?=[^>]*\\bid=["']${DOCUMENT_METADATA_SCRIPT_ID}["'])[^>]*>)[\\s\\S]*?(<\\/script>)`,
  "i"
);

export function decorateDocumentResponse(response: Response, metadata: DocumentMetadata) {
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const markup = createDocumentHeadMarkup(metadata);
  const bootstrap = createDocumentMetadataBootstrap(metadata);

  // Cloudflare provides a streaming rewriter; local Node development uses the buffered fallback below.
  const HtmlRewriter = Reflect.get(globalThis, "HTMLRewriter") as typeof HTMLRewriter | undefined;

  if (HtmlRewriter) {
    let rewriter = new HtmlRewriter();

    for (const selector of managedHeadSelectors) {
      rewriter = rewriter.on(selector, {
        element(element) {
          element.remove();
        },
      });
    }

    return rewriter
      .on(`script#${DOCUMENT_METADATA_SCRIPT_ID}`, {
        element(element) {
          element.setInnerContent(bootstrap);
        },
      })
      .on("head", {
        element(element) {
          element.append(markup, { html: true });
        },
      })
      .transform(response);
  }

  return decorateBufferedDocumentResponse(response, markup, bootstrap);
}

export function createDocumentHeadMarkup(metadata: DocumentMetadata) {
  const head = createDocumentRouteHead(metadata);
  const metaMarkup = head.meta.map(createMetaMarkup);
  const linkMarkup = head.links.map((link) => `<link rel="${escapeHtml(link.rel)}" href="${escapeHtml(link.href)}">`);

  return [...metaMarkup, ...linkMarkup].join("");
}

export function createDocumentMetadataBootstrap(metadata: DocumentMetadata) {
  const serializedMetadata = JSON.stringify(metadata).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  );

  return `window.__RATIO_DOCUMENT_METADATA__=${serializedMetadata};`;
}

async function decorateBufferedDocumentResponse(response: Response, markup: string, bootstrap: string) {
  const html = await response.text();
  const strippedHtml = stripManagedHeadMarkup(html);
  const bootstrappedHtml = strippedHtml.replace(metadataScriptPattern, (_match, openingTag, closingTag) =>
    [openingTag, bootstrap, closingTag].join("")
  );
  const decoratedHtml = bootstrappedHtml.replace(closingHeadPattern, `${markup}</head>`);
  const headers = new Headers(response.headers);

  headers.delete("content-encoding");
  headers.delete("content-length");

  return new Response(decoratedHtml, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function createMetaMarkup(tag: { content?: string; name?: string; property?: string; title?: string }) {
  if (tag.title) return `<title>${escapeHtml(tag.title)}</title>`;
  if (tag.name && tag.content) return createMetaTag("name", tag.name, tag.content);
  if (tag.property && tag.content) return createMetaTag("property", tag.property, tag.content);

  return "";
}

function stripManagedHeadMarkup(html: string) {
  return html
    .replace(titlePattern, "")
    .replace(canonicalLinkPattern, "")
    .replace(managedNamedMetaPattern, "")
    .replace(managedPropertyMetaPattern, "");
}

function createMetaTag(attribute: "name" | "property", key: string, content: string) {
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}">`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
