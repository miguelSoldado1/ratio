export const albumQueryKeys = {
  details: (albumId: string) => ["album", albumId, "details"] as const,
  review: (albumId: string) => ["album", albumId, "review"] as const,
  hasMyReview: (albumId: string) => [...albumQueryKeys.review(albumId), "me"] as const,
  ratingSummary: (albumId: string) => [...albumQueryKeys.review(albumId), "rating-summary"] as const,
  reviews: (albumId: string) => [...albumQueryKeys.review(albumId), "list"] as const,
  search: (query: string) => ["album-search", query] as const,
};
