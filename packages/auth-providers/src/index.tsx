const spotifyLogo = new URL("../assets/spotify-logo-icon-white.svg", import.meta.url).href;
const googleLogo = new URL("../assets/google-logo.png", import.meta.url).href;
const discordLogo = new URL("../assets/discord-logo-icon-white.png", import.meta.url).href;

interface AuthProviderIconProps {
  className?: string;
  "data-icon"?: string;
}

export const authProviders = [
  {
    icon: (props: AuthProviderIconProps) => (
      <img alt="" aria-hidden="true" height="18" src={spotifyLogo} width="18" {...props} />
    ),
    id: "spotify",
    label: "Spotify",
  },
  {
    icon: (props: AuthProviderIconProps) => (
      <img alt="" aria-hidden="true" height="18" src={googleLogo} width="18" {...props} />
    ),
    id: "google",
    label: "Google",
  },
  {
    icon: (props: AuthProviderIconProps) => (
      <img alt="" aria-hidden="true" height="18" src={discordLogo} width="18" {...props} />
    ),
    id: "discord",
    label: "Discord",
  },
] as const;

export type AuthProvider = (typeof authProviders)[number];
export type AuthProviderId = AuthProvider["id"];
