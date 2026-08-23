import { describe, expect, it } from "vitest";
import {
  getAlbumAnalyticsProperties,
  normalizeAnalyticsPath,
  sanitizeAnalyticsProperties,
} from "@/lib/analytics/posthog";

describe("analytics privacy boundary", () => {
  it("keeps album events limited to public catalog identity", () => {
    const album = {
      artist: "Floating Points, Pharoah Sanders & The London Symphony Orchestra",
      coverUrl: "https://private.example/cover.jpg",
      id: "3ShtO5VCYa3ctlR5uzLWBa",
      rating: 5,
      title: "Promises",
    };

    expect(getAlbumAnalyticsProperties(album)).toEqual({
      album_artist: album.artist,
      album_id: album.id,
      album_title: album.title,
    });
  });

  it.each([
    ["/album/spotify-album-id", "/album/:albumId"],
    ["/album/spotify-album-id/reviews", "/album/:albumId/reviews"],
    ["/list/0198a-private-id", "/list/:listId"],
    ["/review/0198b-private-id", "/review/:reviewId"],
    ["/user/private-username", "/user/:username"],
    ["/settings", "/settings"],
  ])("normalizes %s to %s", (pathname, expected) => {
    expect(normalizeAnalyticsPath(pathname)).toBe(expected);
  });

  it("removes dynamic paths, query parameters, hashes, and external referrer paths", () => {
    expect(
      sanitizeAnalyticsProperties(
        {
          $current_url: "https://ratiomusic.live/user/private-username?token=secret#section",
          $pathname: "/user/private-username",
          $prev_pageview_pathname: "/review/0198b-private-id",
          $referrer: "https://search.example/results?q=private-search",
          $session_entry_pathname: "/album/spotify-album-id",
          $session_entry_referrer: "$direct",
          $session_entry_url: "https://ratiomusic.live/album/spotify-album-id?private=true",
          $session_entry_gclid: "private-click-id",
          $session_entry_ph_keyword: "private search",
          gclid: "private-click-id",
          title: "Private Username | Ratio",
          source: "search",
        },
        "https://ratiomusic.live"
      )
    ).toEqual({
      $current_url: "https://ratiomusic.live/user/:username",
      $pathname: "/user/:username",
      $prev_pageview_pathname: "/review/:reviewId",
      $referrer: "https://search.example",
      $session_entry_pathname: "/album/:albumId",
      $session_entry_referrer: "$direct",
      $session_entry_url: "https://ratiomusic.live/album/:albumId",
      source: "search",
    });
  });

  it("drops malformed URLs instead of forwarding their original value", () => {
    expect(
      sanitizeAnalyticsProperties(
        {
          $current_url: "https://[invalid",
          $referrer: "https://[invalid",
        },
        "https://ratiomusic.live"
      )
    ).toEqual({
      $current_url: "",
      $referrer: "",
    });
  });
});
