export const albumQueryKeys = {
  all: () => ["album"] as const,
  details: (albumId: string) => ["album", albumId, "details"] as const,
  review: (albumId: string) => ["album", albumId, "review"] as const,
  reviewDetail: (albumId: string, reviewId: string, userId?: string) =>
    userId
      ? ([...albumQueryKeys.review(albumId), "detail", reviewId, userId] as const)
      : ([...albumQueryKeys.review(albumId), "detail", reviewId] as const),
  hasMyReview: (albumId: string, userId?: string) => [...albumQueryKeys.review(albumId), "me", userId] as const,
  ratingSummary: (albumId: string) => [...albumQueryKeys.review(albumId), "rating-summary"] as const,
  reviews: (albumId: string, userId?: string) => [...albumQueryKeys.review(albumId), "list", userId] as const,
  search: (query: string) => ["album-search", query] as const,
};

export const reviewQueryKeys = {
  all: () => ["review"] as const,
  likes: (reviewId: string, viewerUserId?: string) =>
    viewerUserId ? (["review", reviewId, "likes", viewerUserId] as const) : (["review", reviewId, "likes"] as const),
};

export const feedQueryKeys = {
  all: () => ["feed"] as const,
  root: (viewerUserId?: string) => (viewerUserId ? (["feed", viewerUserId] as const) : (["feed"] as const)),
};

export const userQueryKeys = {
  all: () => ["user"] as const,
  followers: (profileUserId: string, viewerUserId?: string) =>
    viewerUserId
      ? (["user", profileUserId, "followers", viewerUserId] as const)
      : (["user", profileUserId, "followers"] as const),
  following: (profileUserId: string, viewerUserId?: string) =>
    viewerUserId
      ? (["user", profileUserId, "following", viewerUserId] as const)
      : (["user", profileUserId, "following"] as const),
  profile: (username: string, userId?: string) =>
    userId ? (["user", username, "profile", userId] as const) : (["user", username, "profile"] as const),
  reviews: (reviewedUserId: string, viewerUserId?: string) =>
    viewerUserId
      ? (["user", reviewedUserId, "reviews", viewerUserId] as const)
      : (["user", reviewedUserId, "reviews"] as const),
  search: (query: string, viewerUserId?: string) =>
    viewerUserId
      ? ([...userQueryKeys.all(), "search", query, viewerUserId] as const)
      : ([...userQueryKeys.all(), "search", query] as const),
};

export const accountQueryKeys = {
  providers: () => ["account", "providers"] as const,
};
