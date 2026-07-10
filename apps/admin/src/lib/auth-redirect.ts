import { z } from "zod";

const internalUrlBase = "https://ratio-admin.internal";
const publicAuthPaths = new Set(["/access-denied", "/sign-in"]);

export const authRedirectSearchSchema = z.object({
  error: z.string().optional().catch(undefined),
  redirect: z.string().optional().catch(undefined),
});

export function getSafeAuthRedirect(value: string | undefined): string {
  if (!value) return "/";

  try {
    const url = new URL(value, internalUrlBase);

    if (url.origin !== internalUrlBase) return "/";
    if (publicAuthPaths.has(url.pathname) || url.pathname.startsWith("/api/")) return "/";

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function getSignInHref(redirect: string): string {
  const search = new URLSearchParams({ redirect: getSafeAuthRedirect(redirect) });
  return `/sign-in?${search.toString()}`;
}
