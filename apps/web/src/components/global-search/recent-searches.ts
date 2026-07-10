export interface RecentSearch {
  normalizedQuery: string;
  query: string;
  searchedAt: number;
}

export const recentSearchesStorageKey = "ratio:recent-searches:v1";

const maxRecentSearches = 10;
const minRecentSearchQueryLength = 2;
const whitespacePattern = /\s+/g;

export function getRecentSearches() {
  const storage = getStorage();

  if (!storage) return [];

  try {
    return parseRecentSearches(storage.getItem(recentSearchesStorageKey));
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string) {
  const normalized = normalizeQuery(query);

  if (!normalized || normalized.query.length < minRecentSearchQueryLength) {
    return getRecentSearches();
  }

  const recentSearch: RecentSearch = {
    query: normalized.query,
    normalizedQuery: normalized.normalizedQuery,
    searchedAt: Date.now(),
  };

  const nextSearches = [
    recentSearch,
    ...getRecentSearches().filter((search) => search.normalizedQuery !== normalized.normalizedQuery),
  ].slice(0, maxRecentSearches);

  const storage = getStorage();

  if (!storage) return nextSearches;

  try {
    storage.setItem(recentSearchesStorageKey, JSON.stringify(nextSearches));
  } catch {
    // Keep the in-memory result useful for the current render even if persistence fails.
  }

  return nextSearches;
}

export function removeRecentSearch(normalizedQuery: string) {
  const nextSearches = getRecentSearches().filter((search) => search.normalizedQuery !== normalizedQuery);
  const storage = getStorage();

  if (!storage) return nextSearches;

  try {
    storage.setItem(recentSearchesStorageKey, JSON.stringify(nextSearches));
  } catch {
    // Keep the in-memory result useful for the current render even if persistence fails.
  }

  return nextSearches;
}

function parseRecentSearches(value: string | null) {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .flatMap((item): RecentSearch[] => {
        if (!isRecentSearch(item)) return [];

        const normalized = normalizeQuery(item.query);

        if (
          !normalized ||
          normalized.query.length < minRecentSearchQueryLength ||
          normalized.normalizedQuery !== item.normalizedQuery
        ) {
          return [];
        }

        return [
          {
            query: normalized.query,
            normalizedQuery: normalized.normalizedQuery,
            searchedAt: item.searchedAt,
          },
        ];
      })
      .sort((a, b) => b.searchedAt - a.searchedAt)
      .slice(0, maxRecentSearches);
  } catch {
    return [];
  }
}

function isRecentSearch(value: unknown) {
  if (!value || typeof value !== "object") return false;

  const maybeSearch = value as Partial<RecentSearch>;

  return (
    typeof maybeSearch.query === "string" &&
    typeof maybeSearch.normalizedQuery === "string" &&
    Number.isFinite(maybeSearch.searchedAt)
  );
}

function normalizeQuery(query: string) {
  const normalizedWhitespaceQuery = query.trim().replace(whitespacePattern, " ");

  if (!normalizedWhitespaceQuery) return null;

  return {
    query: normalizedWhitespaceQuery,
    normalizedQuery: normalizedWhitespaceQuery.toLowerCase(),
  };
}

function getStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
