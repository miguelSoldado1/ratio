import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/auth-client";

const adminModeStorageKey = "ratio:admin-mode-enabled";
const adminModeChangedEventName = "ratio:admin-mode-changed";

export function useAdminMode() {
  const session = authClient.useSession();
  const isAdmin = isAdminRole(session.data?.user.role);
  const [adminModeEnabled, setAdminModeEnabledState] = useState(false);

  useEffect(() => {
    function syncAdminMode() {
      setAdminModeEnabledState(window.localStorage.getItem(adminModeStorageKey) === "true");
    }

    if (!isAdmin) {
      return setAdminModeEnabledState(false);
    }

    syncAdminMode();
    window.addEventListener(adminModeChangedEventName, syncAdminMode);

    return () => {
      window.removeEventListener(adminModeChangedEventName, syncAdminMode);
    };
  }, [isAdmin]);

  function setAdminModeEnabled(enabled: boolean) {
    if (!isAdmin) {
      return setAdminModeEnabledState(false);
    }

    setAdminModeEnabledState(enabled);
    window.localStorage.setItem(adminModeStorageKey, String(enabled));
    window.dispatchEvent(new Event(adminModeChangedEventName));
  }

  return {
    adminModeEnabled: isAdmin && adminModeEnabled,
    isAdmin,
    setAdminModeEnabled,
  };
}

function isAdminRole(role?: string | null) {
  return role?.split(",").some((userRole) => userRole.trim() === "admin") ?? false;
}
