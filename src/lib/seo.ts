const fallbackSiteUrl = "https://ratio.sticky-puddingz.workers.dev";

export const siteName = "Ratio";
export const defaultSeoTitle = "Ratio - Album Reviews and Ratings";
export const defaultSeoDescription =
  "Discover, rate, and review albums with a social music community built for focused music discovery.";
export const defaultSeoImage = "/web-app-manifest-512x512.png";

export function getSiteUrl() {
  return getAbsoluteUrl(import.meta.env.VITE_SITE_URL ?? fallbackSiteUrl);
}

export function getCanonicalUrl(path: string) {
  return new URL(path, getSiteUrl()).href;
}

export function getAbsoluteAssetUrl(path: string | null | undefined) {
  if (!path) return getCanonicalUrl(defaultSeoImage);

  return getAbsoluteUrl(path).href;
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

  return [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: siteName },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: imageUrl },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
  ];
}

export function createCanonicalLink(path: string) {
  return { rel: "canonical", href: getCanonicalUrl(path) };
}

export function createJsonLdScript(data: unknown) {
  return {
    attrs: { type: "application/ld+json" },
    children: JSON.stringify(data),
  };
}

function getAbsoluteUrl(pathOrUrl: string) {
  try {
    return new URL(pathOrUrl);
  } catch {
    return new URL(pathOrUrl, fallbackSiteUrl);
  }
}
