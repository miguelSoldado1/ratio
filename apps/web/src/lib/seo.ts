const fallbackSiteUrl = "https://ratiomusic.live";

export const siteName = "Ratio";
export const defaultSeoTitle = "Ratio - Album Reviews";
export const defaultSeoDescription =
  "Discover, rate, and review albums with a social music community built for focused music discovery.";
export const defaultSeoImage = "/og-image.png";
export const defaultSeoImageHeight = 630;
export const defaultSeoImageWidth = 1200;

export const faviconLinks = [
  { rel: "icon", href: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
  { rel: "icon", href: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
  { rel: "manifest", href: "/site.webmanifest" },
];

export function getSiteUrl() {
  return getAbsoluteUrl(import.meta.env.VITE_SITE_URL ?? fallbackSiteUrl);
}

export function getCanonicalUrl(path: string) {
  return new URL(path, getSiteUrl()).href;
}

export function getAbsoluteAssetUrl(path: string | null | undefined) {
  if (!path) return getCanonicalUrl(defaultSeoImage);

  try {
    return new URL(path).href;
  } catch {
    return new URL(path, getSiteUrl()).href;
  }
}

interface CreateSeoMetaParams {
  description?: string;
  image?: string | null;
  imageAlt?: string;
  path: string;
  robots?: string | null;
  title?: string;
  twitterCard?: "summary" | "summary_large_image";
  type?: string;
}

export function createSeoMeta(params: CreateSeoMetaParams) {
  const description = params.description ?? defaultSeoDescription;
  const image = params.image ?? defaultSeoImage;
  const robots = params.robots === undefined ? "index, follow, max-image-preview:large" : params.robots;
  const title = params.title ?? defaultSeoTitle;
  const imageAlt = params.imageAlt ?? `${title} preview image`;
  const twitterCard = params.twitterCard ?? "summary_large_image";
  const type = params.type ?? "website";

  const canonicalUrl = getCanonicalUrl(params.path);
  const imageUrl = getAbsoluteAssetUrl(image);

  const defaultImageUrl = getAbsoluteAssetUrl(defaultSeoImage);
  const defaultImageMetadata =
    imageUrl === defaultImageUrl
      ? [
          { property: "og:image:width", content: String(defaultSeoImageWidth) },
          { property: "og:image:height", content: String(defaultSeoImageHeight) },
        ]
      : [];

  return [
    { title },
    { name: "description", content: description },
    ...(robots ? [{ name: "robots", content: robots }] : []),
    { property: "og:site_name", content: siteName },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: imageUrl },
    { property: "og:image:alt", content: imageAlt },
    ...defaultImageMetadata,
    { name: "twitter:card", content: twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}

export function createCanonicalLink(path: string) {
  return { rel: "canonical", href: getCanonicalUrl(path) };
}

const jsonLdEscapeLookup: Record<string, string> = {
  "&": "\\u0026",
  "<": "\\u003c",
  ">": "\\u003e",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

const jsonLdEscapePattern = /[&<>\u2028\u2029]/g;

export function createJsonLdScript(data: unknown) {
  const json = JSON.stringify(data).replace(jsonLdEscapePattern, (match) => jsonLdEscapeLookup[match] ?? match);

  return {
    children: json,
    type: "application/ld+json",
  };
}

function getAbsoluteUrl(pathOrUrl: string) {
  try {
    return new URL(pathOrUrl);
  } catch {
    return new URL(pathOrUrl, fallbackSiteUrl);
  }
}
