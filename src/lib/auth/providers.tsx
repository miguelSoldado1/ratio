interface AuthProviderIconProps {
  className?: string;
  "data-icon"?: string;
}

export const GoogleIcon = (props: AuthProviderIconProps) => (
  <img alt="" aria-hidden="true" height="18" src="/brand/google-logo.png" width="18" {...props} />
);

export const DiscordIcon = (props: AuthProviderIconProps) => (
  <img alt="" aria-hidden="true" height="18" src="/brand/discord-logo-icon-white.png" width="18" {...props} />
);

export const SpotifyIcon = (props: AuthProviderIconProps) => (
  <img alt="" aria-hidden="true" height="18" src="/brand/spotify-logo-icon-white.svg" width="18" {...props} />
);

export const authProviders = [
  {
    icon: SpotifyIcon,
    id: "spotify",
    label: "Spotify",
  },
  {
    icon: GoogleIcon,
    id: "google",
    label: "Google",
  },
  {
    icon: DiscordIcon,
    id: "discord",
    label: "Discord",
  },
] as const;

export type AuthProvider = (typeof authProviders)[number];
export type AuthProviderId = AuthProvider["id"];
