import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";
const RATE_LIMIT_KEY_PREFIX = "rate-limit";
const BETTER_AUTH_RATE_LIMIT_KEY_PREFIX = `${RATE_LIMIT_KEY_PREFIX}:auth`;

const warnedMissingRateLimitBindings = new Set<string>();

type CloudflareWorkersModule = typeof import("cloudflare:workers");

export interface CloudflareRateLimitRule {
  bindingName: string;
}

export interface FixedWindowRateLimitRule {
  limit: number;
  scope: string;
  windowSeconds: number;
}

interface EnforceRateLimitOptions<TRule> {
  headers: Headers;
  rule: TRule;
  userId?: string;
}

interface FixedWindowRateLimitRecord {
  count: number;
  resetAt: number;
}

interface BetterAuthRateLimitRecord {
  count: number;
  windowStart: number;
}

class RateLimitError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(retryAfterSeconds?: number) {
    super("Too many requests. Try again shortly.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const spotifyCatalogRateLimit = defineCloudflareRateLimitRule({
  bindingName: "SPOTIFY_CATALOG_RATE_LIMITER",
});

export const spotifyRecentRotationRateLimit = defineCloudflareRateLimitRule({
  bindingName: "SPOTIFY_RECENT_ROTATION_RATE_LIMITER",
});

export const reviewCreateHourlyRateLimit = defineFixedWindowRateLimitRule({
  limit: 12,
  scope: "review-create-hourly",
  windowSeconds: 60 * 60,
});

export const listCreateHourlyRateLimit = defineFixedWindowRateLimitRule({
  limit: 15,
  scope: "list-create-hourly",
  windowSeconds: 60 * 60,
});

export const contentCreateRateLimit = defineCloudflareRateLimitRule({
  bindingName: "CONTENT_CREATE_RATE_LIMITER",
});

export const userMutationRateLimit = defineCloudflareRateLimitRule({
  bindingName: "USER_MUTATION_RATE_LIMITER",
});

export const uploadSignRateLimit = defineCloudflareRateLimitRule({
  bindingName: "UPLOAD_SIGN_RATE_LIMITER",
});

export const uploadSignHourlyRateLimit = defineFixedWindowRateLimitRule({
  limit: 20,
  scope: "upload-sign-hourly",
  windowSeconds: 60 * 60,
});

export function createCloudflareRateLimitMiddleware(rule: CloudflareRateLimitRule) {
  return createMiddleware().server(async ({ context, next }) => {
    await enforceCloudflareRateLimit({
      headers: getRequestHeaders(),
      rule,
      userId: getContextUserId(context),
    });

    return await next();
  });
}

export function createFixedWindowRateLimitMiddleware(rule: FixedWindowRateLimitRule) {
  return createMiddleware().server(async ({ context, next }) => {
    await enforceFixedWindowRateLimit({
      headers: getRequestHeaders(),
      rule,
      userId: getContextUserId(context),
    });

    return await next();
  });
}

export async function enforceCloudflareRateLimitForRequest(
  request: Request,
  rule: CloudflareRateLimitRule,
  userId?: string
) {
  await enforceCloudflareRateLimit({ headers: request.headers, rule, userId });
}

export async function enforceFixedWindowRateLimitForRequest(
  request: Request,
  rule: FixedWindowRateLimitRule,
  userId?: string
) {
  await enforceFixedWindowRateLimit({ headers: request.headers, rule, userId });
}

export function createBetterAuthRateLimitStorage() {
  return {
    async consume(key: string, rule: { max: number; window: number }) {
      const cache = await getCloudflareCache();

      if (!cache) {
        warnMissingRateLimitBinding("CACHE");
        return { allowed: true, retryAfter: null };
      }

      const storageKey = getBetterAuthRateLimitKey(key);
      const now = Date.now();
      const windowMs = rule.window * 1000;
      const record = await getBetterAuthRateLimitRecord(cache, storageKey);
      const activeRecord = record && now - record.windowStart < windowMs ? record : null;
      const currentCount = activeRecord?.count ?? 0;

      if (activeRecord && currentCount >= rule.max) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((activeRecord.windowStart + windowMs - now) / 1000)),
        };
      }

      try {
        await cache.put(
          storageKey,
          JSON.stringify({
            count: currentCount + 1,
            windowStart: activeRecord?.windowStart ?? now,
          } satisfies BetterAuthRateLimitRecord),
          { expirationTtl: rule.window + 60 }
        );
      } catch (error) {
        console.warn("Failed to write Better Auth rate limit state", error);
      }

      return { allowed: true, retryAfter: null };
    },
  };
}

async function getBetterAuthRateLimitRecord(cache: KVNamespace, key: string) {
  try {
    const value = await cache.get<unknown>(key, "json");
    if (typeof value !== "object" || value === null) return null;
    if (!("count" in value && "windowStart" in value)) return null;
    if (typeof value.count !== "number" || typeof value.windowStart !== "number") return null;

    return {
      count: value.count,
      windowStart: value.windowStart,
    } satisfies BetterAuthRateLimitRecord;
  } catch (error) {
    console.warn("Failed to read Better Auth rate limit state", error);
    return null;
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function createRateLimitResponse(error: RateLimitError) {
  const headers = new Headers();
  if (error.retryAfterSeconds) {
    headers.set("Retry-After", String(error.retryAfterSeconds));
  }

  return new Response(error.message, {
    headers,
    status: 429,
  });
}

function defineCloudflareRateLimitRule(rule: CloudflareRateLimitRule) {
  return rule;
}

function defineFixedWindowRateLimitRule(rule: FixedWindowRateLimitRule) {
  return rule;
}

async function enforceCloudflareRateLimit({ headers, rule, userId }: EnforceRateLimitOptions<CloudflareRateLimitRule>) {
  const rateLimiter = await getCloudflareRateLimiter(rule.bindingName);

  if (!rateLimiter) {
    warnMissingRateLimitBinding(rule.bindingName);
    return;
  }

  const { success } = await rateLimiter.limit({
    key: await createIdentityKey(headers, userId),
  });

  if (!success) {
    throw new RateLimitError();
  }
}

async function enforceFixedWindowRateLimit({
  headers,
  rule,
  userId,
}: EnforceRateLimitOptions<FixedWindowRateLimitRule>) {
  const cache = await getCloudflareCache();

  if (!cache) {
    warnMissingRateLimitBinding("CACHE");
    return;
  }

  const now = Date.now();
  const resetAt = getWindowResetAt(now, rule.windowSeconds);
  const key = await createFixedWindowRateLimitKey({ headers, resetAt, rule, userId });
  const record = await getFixedWindowRateLimitRecord(cache, key);
  const currentCount = record?.resetAt === resetAt ? record.count : 0;

  if (currentCount >= rule.limit) {
    throw new RateLimitError(Math.max(1, Math.ceil((resetAt - now) / 1000)));
  }

  try {
    await cache.put(
      key,
      JSON.stringify({
        count: currentCount + 1,
        resetAt,
      } satisfies FixedWindowRateLimitRecord),
      { expirationTtl: rule.windowSeconds + 60 }
    );
  } catch (error) {
    console.warn("Failed to write fixed-window rate limit state", error);
  }
}

async function getFixedWindowRateLimitRecord(cache: KVNamespace, key: string) {
  try {
    const value = await cache.get<unknown>(key, "json");
    if (typeof value !== "object" || value === null) return null;
    if (!("count" in value && "resetAt" in value)) return null;
    if (typeof value.count !== "number" || typeof value.resetAt !== "number") return null;

    return {
      count: value.count,
      resetAt: value.resetAt,
    } satisfies FixedWindowRateLimitRecord;
  } catch (error) {
    console.warn("Failed to read fixed-window rate limit state", error);
    return null;
  }
}

async function createFixedWindowRateLimitKey({
  headers,
  resetAt,
  rule,
  userId,
}: {
  headers: Headers;
  resetAt: number;
  rule: FixedWindowRateLimitRule;
  userId?: string;
}) {
  return `${RATE_LIMIT_KEY_PREFIX}:${rule.scope}:${resetAt}:${await createIdentityKey(headers, userId)}`;
}

async function createIdentityKey(headers: Headers, userId?: string) {
  const identity = userId ? `user:${userId}` : `ip:${getClientIp(headers)}`;

  return await sha256(identity);
}

function getWindowResetAt(now: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;

  return Math.floor(now / windowMs) * windowMs + windowMs;
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

async function getCloudflareCache() {
  const cloudflareWorkers = await getCloudflareWorkersModule();
  return cloudflareWorkers?.env.CACHE ?? null;
}

async function getCloudflareRateLimiter(bindingName: string) {
  const cloudflareWorkers = await getCloudflareWorkersModule();
  if (!cloudflareWorkers) return null;

  const env = cloudflareWorkers.env as unknown as Record<string, RateLimit | undefined>;
  return env[bindingName] ?? null;
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

function warnMissingRateLimitBinding(bindingName: string) {
  if (!isCloudflareWorkersRuntime() || warnedMissingRateLimitBindings.has(bindingName)) return;

  warnedMissingRateLimitBindings.add(bindingName);
  console.warn(`Rate limit binding ${bindingName} is unavailable; requests using it are not being limited`);
}

function getContextUserId(context: unknown) {
  if (typeof context !== "object" || context === null) return;
  if (!("user" in context)) return;

  const { user } = context;
  if (typeof user !== "object" || user === null) return;
  if (!("id" in user) || typeof user.id !== "string") return;

  return user.id;
}

function getBetterAuthRateLimitKey(key: string) {
  return `${BETTER_AUTH_RATE_LIMIT_KEY_PREFIX}:${key}`;
}
