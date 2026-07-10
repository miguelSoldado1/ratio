type SpotifyLogContext = Record<string, boolean | number | string | null | undefined>;

export class SpotifyTokenError extends Error {
  constructor(cause: unknown) {
    super("Spotify token request failed", { cause });
    this.name = "SpotifyTokenError";
  }
}

export function logSpotifyApiError(operation: string, error: unknown, context: SpotifyLogContext = {}) {
  console.error("spotify_api_error", {
    operation,
    ...context,
    ...getErrorFields(error),
  });
}

export function logSpotifyCacheError(operation: string, error: unknown, context: SpotifyLogContext = {}) {
  console.warn("spotify_cache_error", {
    operation,
    ...context,
    ...getErrorFields(error),
  });
}

export function logSpotifyInvalidCache(operation: string, error: unknown, context: SpotifyLogContext = {}) {
  console.warn("spotify_invalid_cache", {
    operation,
    ...context,
    ...getErrorFields(error),
  });
}

export function logSpotifyTokenError(operation: string, error: unknown, context: SpotifyLogContext = {}) {
  console.error("spotify_token_error", {
    operation,
    ...context,
    ...getErrorFields(error),
  });
}

export function getSpotifyErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return 500;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  if ("cause" in error) return getSpotifyErrorStatus(error.cause);
  return 500;
}

function getErrorFields(error: unknown) {
  return {
    errorMessage: getErrorMessage(error),
    errorName: getErrorName(error),
    status: getSpotifyErrorStatus(error),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return null;
}

function getErrorName(error: unknown) {
  if (error instanceof Error) return error.name;
  return null;
}
