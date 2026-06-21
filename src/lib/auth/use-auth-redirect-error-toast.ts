import { useEffect } from "react";
import { toast } from "sonner";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";

export function useAuthRedirectErrorToast(setAuthDialogOpen: (open: boolean) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    if (!error) return;

    const toastTimeoutId = window.setTimeout(() => {
      toast.error("Authentication failed", { description: getAuthErrorMessage(error), id: `auth-error-${error}` });
      setAuthDialogOpen(true);
    }, 0);

    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    return () => window.clearTimeout(toastTimeoutId);
  }, [setAuthDialogOpen]);
}
