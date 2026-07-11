import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TopBar } from "@/components/top-bar";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedRoute,
});

function AuthenticatedRoute() {
  const { data } = useAdminAccess();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const redirectTarget = getSafeAuthRedirect(location.href);

    if (data?.status === "unauthenticated") {
      navigate({ replace: true, search: { redirect: redirectTarget }, to: "/sign-in" });
    }

    if (data?.status === "forbidden") {
      navigate({ replace: true, search: { redirect: redirectTarget }, to: "/access-denied" });
    }
  }, [data?.status, location.href, navigate]);

  if (data?.status !== "authorized") return null;

  return (
    <>
      <TopBar user={data.user} />
      <Outlet />
    </>
  );
}
