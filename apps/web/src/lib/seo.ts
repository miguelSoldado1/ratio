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
  path: string;
  title?: string;
  type?: string;
}

export function createSeoMeta({
  description = defaultSeoDescription,
  image = defaultSeoImage,
  path,
  title = defaultSeoTitle,
  type = "website",
}: CreateSeoMetaParams) {
  const canonicalUrl = getCanonicalUrl(path);
  const imageUrl = getAbsoluteAssetUrl(image);
  const imageAlt = `${title} preview image`;
  const defaultImageMetadata =
    image === defaultSeoImage
      ? [
          { property: "og:image:width", content: String(defaultSeoImageWidth) },
          { property: "og:image:height", content: String(defaultSeoImageHeight) },
        ]
      : [];

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow, max-image-preview:large" },
    { property: "og:site_name", content: siteName },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: imageUrl },
    { property: "og:image:alt", content: imageAlt },
    ...defaultImageMetadata,
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}

export function createCanonicalLink(path: string) {
  return { rel: "canonical", href: getCanonicalUrl(path) };
}

export function createJsonLdScript(data: unknown) {
  return {
    children: JSON.stringify(data),
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
