import { siteName } from "./seo";

export function createAlbumPageTitle(albumTitle: string, primaryArtist: string | undefined) {
  return `${albumTitle} by ${primaryArtist ?? "Unknown Artist"} — Reviews | ${siteName}`;
}

export function createReviewPageTitle(albumTitle: string, authorDisplayName: string) {
  return `${albumTitle} review by ${authorDisplayName} | ${siteName}`;
}

export function createProfilePageTitle(displayName: string, username: string) {
  return `${displayName} (@${username}) — Album Reviews | ${siteName}`;
}
