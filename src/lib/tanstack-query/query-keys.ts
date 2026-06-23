export const albumQueryKeys = {
  details: (albumId: string) => ["album", albumId, "details"] as const,
  review: (albumId: string) => ["album", albumId, "review"] as const,
  hasMyReview: (albumId: string, userId?: string) => [...albumQueryKeys.review(albumId), "me", userId] as const,
  ratingSummary: (albumId: string) => [...albumQueryKeys.review(albumId), "rating-summary"] as const,
  reviews: (albumId: string, userId?: string) => [...albumQueryKeys.review(albumId), "list", userId] as const,
  search: (query: string) => ["album-search", query] as const,
};

export const userQueryKeys = {
  profile: (username: string) => ["user", username, "profile"] as const,
  reviews: (username: string, userId?: string) => [...userQueryKeys.profile(username), "reviews", userId] as const,
};
