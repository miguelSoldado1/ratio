import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedRoute,
});

function AuthenticatedRoute() {
  const accessQuery = useAdminAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const accessStatus = accessQuery.data?.status;

  useEffect(() => {
    const redirectTarget = getSafeAuthRedirect(location.href);

    if (accessStatus === "unauthenticated") {
      navigate({ replace: true, search: { redirect: redirectTarget }, to: "/sign-in" });
    }

    if (accessStatus === "forbidden") {
      navigate({ replace: true, search: { redirect: redirectTarget }, to: "/access-denied" });
    }
  }, [accessStatus, location.href, navigate]);

  return accessStatus === "authorized" ? <Outlet /> : null;
}
