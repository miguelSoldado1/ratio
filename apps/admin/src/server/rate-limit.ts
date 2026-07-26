const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";
const ADMIN_REQUEST_RATE_LIMITER_BINDING = "ADMIN_REQUEST_RATE_LIMITER";
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

type CloudflareWorkersModule = typeof import("cloudflare:workers");

export async function enforceAdminRequestRateLimit(request: Request): Promise<Response | null> {
  const rateLimiter = await getAdminRequestRateLimiter();
  if (!rateLimiter) return null;

  return await applyAdminRequestRateLimit(request, rateLimiter);
}

export async function applyAdminRequestRateLimit(request: Request, rateLimiter: RateLimit): Promise<Response | null> {
  const { success } = await rateLimiter.limit({ key: await createIdentityKey(request.headers) });
  if (success) return null;

  return new Response("Too many requests. Try again shortly.", {
    headers: {
      "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS),
      "X-Content-Type-Options": "nosniff",
    },
    status: 429,
  });
}

async function createIdentityKey(headers: Headers) {
  return await sha256(`ip:${getClientIp(headers)}`);
}

function getClientIp(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getAdminRequestRateLimiter() {
  const cloudflareWorkers = await getCloudflareWorkersModule();
  if (!cloudflareWorkers) return null;

  const workerEnv = cloudflareWorkers.env as unknown as Record<string, RateLimit | undefined>;

  return workerEnv[ADMIN_REQUEST_RATE_LIMITER_BINDING] ?? null;
}

async function getCloudflareWorkersModule(): Promise<CloudflareWorkersModule | null> {
  if (!isCloudflareWorkersRuntime()) return null;

  try {
    return await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
  } catch (error) {
    console.warn("Failed to load Cloudflare Workers bindings", error);
    return null;
  }
}

function isCloudflareWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
