export const albumQueryKeys = {
  details: (albumId: string) => ["album", albumId, "details"] as const,
  review: (albumId: string) => ["album", albumId, "review"] as const,
  hasMyReview: (albumId: string, userId?: string) => [...albumQueryKeys.review(albumId), "me", userId] as const,
  ratingSummary: (albumId: string) => [...albumQueryKeys.review(albumId), "rating-summary"] as const,
  reviews: (albumId: string, userId?: string) => [...albumQueryKeys.review(albumId), "list", userId] as const,
  search: (query: string) => ["album-search", query] as const,
};

export const userQueryKeys = {
  profile: (username: string, userId?: string) =>
    userId ? (["user", username, "profile", userId] as const) : (["user", username, "profile"] as const),
  reviews: (username: string, userId?: string) =>
    userId ? (["user", username, "reviews", userId] as const) : (["user", username, "reviews"] as const),
};
