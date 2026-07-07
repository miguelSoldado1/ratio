import { Link, useLocation } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="min-h-[calc(100vh-65px)] bg-background text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-375 flex-col px-5 pt-6 pb-10 sm:justify-center sm:pt-0 sm:pb-24 lg:px-10 xl:px-14 2xl:px-20">
        <article className="mx-auto w-full max-w-lg py-8 sm:-mt-4">
          <p className="font-medium text-muted-foreground text-sm tabular-nums">
            404 <span className="text-muted-foreground-subtle">/</span> Page not found
          </p>

          <div className="mt-4 min-w-0">
            <h1 className="font-semibold text-2xl tracking-normal sm:text-3xl">No page at this address.</h1>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              This address does not match a Ratio page. Head back to the feed, or use search from the top bar.
            </p>

            <div className="mt-4 flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
              <span className="shrink-0 font-medium">Address</span>
              <code className="min-w-0 truncate rounded-md bg-muted/50 px-2 py-1 font-medium">{location.pathname}</code>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-6">
            <Link className={buttonVariants({ size: "sm" })} to="/">
              <Home data-icon="inline-start" />
              Go home
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
