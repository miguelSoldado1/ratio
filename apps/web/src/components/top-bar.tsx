import { Link, useRouterState } from "@tanstack/react-router";
import { type MouseEvent, useState } from "react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { GlobalSearch } from "@/components/global-search/global-search";
import { GlobalSearchTrigger } from "@/components/global-search/global-search-trigger";
import { HeaderAuthActions } from "@/components/header-auth-actions";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/auth-client";
import { useAuthRedirectErrorToast } from "@/lib/auth/use-auth-redirect-error-toast";

function LogoHomeLink() {
  const isHome = useRouterState({ select: (state) => state.location.pathname === "/" });

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const isModifiedClick = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (!(isHome && !event.defaultPrevented && !isModifiedClick)) return;

    event.preventDefault();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = prefersReducedMotion ? "auto" : "smooth";
    const activeTimeline = document.querySelector<HTMLElement>(
      '[data-swipeable-tabs-scroll-panel][aria-hidden="false"]'
    );

    if (activeTimeline) return activeTimeline.scrollTo({ behavior, top: 0 });

    window.scrollTo({ behavior, top: 0 });
  }

  return (
    <Link
      aria-label="Go to home"
      className="inline-flex size-10 items-center justify-start rounded-3xl transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      onClick={handleClick}
      resetScroll
      to="/"
    >
      <img alt="" className="size-10 shrink-0" height={32} src="/favicon.svg" width={32} />
    </Link>
  );
}

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const session = authClient.useSession();
  const userId = session.data?.user.id;

  useAuthRedirectErrorToast(setAuthDialogOpen);

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <GlobalSearch onOpenChange={setSearchOpen} open={searchOpen} />
      <div className="sticky top-0 z-40 border-border/80 border-b bg-background/95 px-5 py-3 backdrop-blur-md lg:px-10">
        <div className="mx-auto grid w-full max-w-375 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <LogoHomeLink />
          <div className="hidden min-w-0 justify-center lg:flex">
            <GlobalSearchTrigger className="max-w-108" onOpen={() => setSearchOpen(true)} />
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <GlobalSearchTrigger className="lg:hidden" compact onOpen={() => setSearchOpen(true)} />
            <div className="flex w-28 shrink-0 items-center justify-end sm:w-32 lg:w-72">
              {session.isPending ? (
                <Skeleton aria-hidden="true" className="h-9 w-full rounded-full" />
              ) : (
                <div className="flex min-w-0 items-center justify-end gap-1.5">
                  {userId ? <NotificationsDropdown userId={userId} /> : null}
                  <HeaderAuthActions onAuthClick={() => setAuthDialogOpen(true)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
