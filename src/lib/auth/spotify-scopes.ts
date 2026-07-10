export const SPOTIFY_RECENTLY_PLAYED_SCOPE = "user-read-recently-played";

const SCOPE_SEPARATOR_PATTERN = /[,\s]+/;

export function hasSpotifyRecentlyPlayedScope(scopes: readonly string[] | string | null | undefined) {
  if (!scopes) return false;

  const scopeValues = typeof scopes === "string" ? [scopes] : scopes;

  return scopeValues.some((value) =>
    value.split(SCOPE_SEPARATOR_PATTERN).some((scope) => scope.trim() === SPOTIFY_RECENTLY_PLAYED_SCOPE)
  );
}
