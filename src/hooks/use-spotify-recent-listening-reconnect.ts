import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth-client";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";
import { SPOTIFY_RECENTLY_PLAYED_SCOPE } from "@/lib/auth/spotify-scopes";
import { spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";

export function useSpotifyRecentListeningReconnect(userId: string) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function requestReconnect() {
    setIsPending(true);

    const { data, error } = await authClient.linkSocial({
      callbackURL: "/",
      errorCallbackURL: "/",
      provider: "spotify",
      scopes: [SPOTIFY_RECENTLY_PLAYED_SCOPE],
    });

    if (error) {
      setIsPending(false);
      return toast.error("Couldn't reconnect Spotify", {
        description: error.message ? getAuthErrorMessage(error.message) : "Something went wrong. Try again.",
      });
    }

    if (!data) {
      setIsPending(false);
      return toast.error("Couldn't reconnect Spotify", {
        description: "Something went wrong. Try again.",
      });
    }

    if (data.url) {
      setIsPending(false);
      window.location.href = data.url;
      return;
    }

    await queryClient.invalidateQueries({ queryKey: spotifyQueryKeys.recentRotation(userId) });
    setIsPending(false);
  }

  return { isPending, requestReconnect };
}
