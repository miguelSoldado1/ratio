import { useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth-client";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";

export function useAuthRedirectErrorToast(setAuthDialogOpen: (open: boolean) => void) {
  const session = authClient.useSession();

  useEffect(() => {
    if (session.isPending) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    if (!error) return;

    const toastTimeoutId = window.setTimeout(() => {
      toast.error("Couldn't sign in", { description: getAuthErrorMessage(error), id: `auth-error-${error}` });
      if (!session.data?.user) {
        setAuthDialogOpen(true);
      }
    }, 0);

    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    return () => window.clearTimeout(toastTimeoutId);
  }, [session.data?.user, session.isPending, setAuthDialogOpen]);
}
