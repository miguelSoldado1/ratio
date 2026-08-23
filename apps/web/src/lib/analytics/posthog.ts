import type { PostHog, Properties } from "posthog-js/dist/module.slim.no-external";

export type SocialAction = "follow" | "reply" | "reply_like" | "review_like";

export interface AnalyticsAlbum {
  artist: string;
  id: string;
  title: string;
}

interface AlbumAnalyticsProperties {
  album_artist: string;
  album_id: string;
  album_title: string;
}

interface AnalyticsEventProperties {
  album_opened: AlbumAnalyticsProperties;
  review_published: AlbumAnalyticsProperties & { has_body: boolean };
  social_action_completed: { action: SocialAction };
}

type AnalyticsEvent = keyof AnalyticsEventProperties;
const postHogApiHost = "https://us.i.posthog.com";
const postHogProjectToken = "phc_BB3kfJ3WiFoMaqE5puvsVo9WzDJSAZXarTB8S4MGj6UU";
const productionOrigin = "https://ratiomusic.live";

const dynamicPathSegments = [
  { pattern: /^\/album\/[^/]+/, replacement: "/album/:albumId" },
  { pattern: /^\/list\/[^/]+/, replacement: "/list/:listId" },
  { pattern: /^\/review\/[^/]+/, replacement: "/review/:reviewId" },
  { pattern: /^\/user\/[^/]+/, replacement: "/user/:username" },
] as const;

const pathnamePropertyKeys = ["$initial_pathname", "$pathname", "$prev_pageview_pathname", "$session_entry_pathname"];
const urlPropertyKeys = ["$current_url", "$initial_current_url", "$session_entry_url"];
const referrerPropertyKeys = ["$initial_referrer", "$referrer", "$session_entry_referrer"];
const personalCampaignParams = [
  "_kx",
  "dclid",
  "epik",
  "fbclid",
  "gbraid",
  "gclid",
  "gclsrc",
  "igshid",
  "irclid",
  "li_fat_id",
  "mc_cid",
  "msclkid",
  "qclid",
  "rdt_cid",
  "sccid",
  "ttclid",
  "twclid",
  "wbraid",
] as const;
const omittedPropertyKeys = new Set([
  "$initial_ph_keyword",
  "$session_entry_ph_keyword",
  "ph_keyword",
  "title",
  ...personalCampaignParams.flatMap((param) => [param, `$initial_${param}`, `$session_entry_${param}`]),
]);

let clientPromise: Promise<PostHog | null> | undefined;

function getClient(): Promise<PostHog | null> {
  if (import.meta.env.SSR || !import.meta.env.PROD || window.location.origin !== productionOrigin) {
    return Promise.resolve(null);
  }
  if (clientPromise) return clientPromise;

  clientPromise = import("posthog-js/dist/module.slim.no-external")
    .then(({ default: posthog }) => {
      posthog.init(postHogProjectToken, {
        advanced_disable_feature_flags: true,
        advanced_disable_feature_flags_on_first_load: true,
        advanced_disable_flags: true,
        api_host: postHogApiHost,
        autocapture: false,
        before_send: (event) => {
          if (!event) return null;

          return {
            ...event,
            properties: sanitizeAnalyticsProperties(event.properties, window.location.origin),
          };
        },
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_pageleave: true,
        capture_pageview: "history_change",
        capture_performance: false,
        cookieless_mode: "always",
        defaults: "2026-05-30",
        disable_conversations: true,
        disable_external_dependency_loading: true,
        disable_product_tours: true,
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        mask_all_element_attributes: true,
        mask_all_text: true,
        mask_personal_data_properties: true,
        person_profiles: "never",
        rageclick: false,
        respect_dnt: true,
        save_campaign_params: true,
        save_referrer: true,
      });

      return posthog;
    })
    .catch(() => null);

  return clientPromise;
}

export function initializeAnalytics() {
  getClient().catch(() => undefined);
}

export function trackAlbumOpened(album: AnalyticsAlbum) {
  capture("album_opened", getAlbumAnalyticsProperties(album));
}

export function trackReviewPublished(album: AnalyticsAlbum, hasBody: boolean) {
  capture("review_published", { ...getAlbumAnalyticsProperties(album), has_body: hasBody });
}

export function trackSocialActionCompleted(action: SocialAction) {
  capture("social_action_completed", { action });
}

export function normalizeAnalyticsPath(pathname: string) {
  for (const { pattern, replacement } of dynamicPathSegments) {
    if (pattern.test(pathname)) return pathname.replace(pattern, replacement);
  }

  return pathname;
}

export function sanitizeAnalyticsProperties(properties: Properties, currentOrigin: string) {
  const sanitizedProperties = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !omittedPropertyKeys.has(key))
  );

  for (const key of pathnamePropertyKeys) {
    if (typeof properties[key] === "string") {
      sanitizedProperties[key] = normalizeAnalyticsPath(properties[key]);
    }
  }
  for (const key of urlPropertyKeys) {
    if (typeof properties[key] === "string") {
      sanitizedProperties[key] = sanitizeUrl(properties[key], currentOrigin, false);
    }
  }
  for (const key of referrerPropertyKeys) {
    if (typeof properties[key] === "string") {
      sanitizedProperties[key] = sanitizeUrl(properties[key], currentOrigin, true);
    }
  }

  return sanitizedProperties;
}

function capture<TEvent extends AnalyticsEvent>(event: TEvent, properties: AnalyticsEventProperties[TEvent]) {
  getClient()
    .then((client) => {
      client?.capture(event, properties);
    })
    .catch(() => undefined);
}

export function getAlbumAnalyticsProperties(album: AnalyticsAlbum): AlbumAnalyticsProperties {
  return {
    album_artist: album.artist,
    album_id: album.id,
    album_title: album.title,
  };
}

function sanitizeUrl(value: string, currentOrigin: string, originOnlyWhenExternal: boolean) {
  if (!value || value === "$direct") return value;

  try {
    const url = new URL(value, currentOrigin);
    if (originOnlyWhenExternal && url.origin !== currentOrigin) return url.origin;

    url.pathname = normalizeAnalyticsPath(url.pathname);
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return "";
  }
}
