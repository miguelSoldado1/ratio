export const authProviders = [
  { id: "spotify", label: "Spotify" },
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
] as const;

export const authProviderIds = authProviders.map(({ id }) => id);

export type AuthProvider = (typeof authProviders)[number];
export type AuthProviderId = AuthProvider["id"];
