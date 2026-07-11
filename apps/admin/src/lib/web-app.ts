const fallbackWebAppUrl = "https://ratiomusic.live";

export function getWebAppHref(path: string) {
  return new URL(path, import.meta.env.VITE_SITE_URL ?? fallbackWebAppUrl).href;
}
