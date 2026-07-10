import discordLogo from "../assets/discord-logo-icon-white.png?url";
import googleLogo from "../assets/google-logo.png?url";
import spotifyLogo from "../assets/spotify-logo-icon-white.svg?url";
import { authProviders as providerMetadata } from "./index";
import type { AuthProviderId } from "./index";

interface AuthProviderIconProps {
  className?: string;
  "data-icon"?: string;
}

const providerIcons: Record<AuthProviderId, (props: AuthProviderIconProps) => React.JSX.Element> = {
  discord: (props) => <img alt="" aria-hidden="true" height="18" src={discordLogo} width="18" {...props} />,
  google: (props) => <img alt="" aria-hidden="true" height="18" src={googleLogo} width="18" {...props} />,
  spotify: (props) => <img alt="" aria-hidden="true" height="18" src={spotifyLogo} width="18" {...props} />,
};

export const authProviders = providerMetadata.map((provider) => ({
  ...provider,
  icon: providerIcons[provider.id],
}));

export type AuthProviderWithIcon = (typeof authProviders)[number];
