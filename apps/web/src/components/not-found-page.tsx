import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search } from "lucide-react";
import { useOpenGlobalSearch } from "@/components/global-search/global-search-provider";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { buttonVariants } from "@/components/ui/button";

const FLATLINE_BARS = ["bar-1", "bar-2", "bar-3", "bar-4", "bar-5", "bar-6", "bar-7"];

export function NotFoundPage() {
  const location = useLocation();
  const openSearch = useOpenGlobalSearch();

  return (
    <main className="bg-background text-foreground">
      <PageContainer>
        <PageContainerContent className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center pb-24 text-center">
          <div aria-hidden="true" className="flex items-center gap-1.5">
            {FLATLINE_BARS.map((bar) => (
              <span className="h-2.5 w-1 rounded-full bg-muted-foreground-subtle/70" key={bar} />
            ))}
          </div>

          <p className="heading-section mt-6 tabular-nums">404</p>
          <h1 className="mt-3 font-semibold text-3xl leading-tight sm:text-4xl">Page not found</h1>
          <p className="mt-3 max-w-md text-muted-foreground text-sm leading-6 sm:text-base sm:leading-7">
            There's nothing at <span className="break-all text-foreground">{location.pathname}</span>. The link may be
            mistyped, or what it pointed to was removed.
          </p>

          <div className="mt-8 grid w-full max-w-xs grid-cols-2 gap-2 sm:flex sm:w-auto sm:max-w-none">
            <Link className={buttonVariants({ size: "lg" })} to="/">
              <Home data-icon="inline-start" />
              Back to feed
            </Link>
            <button className={buttonVariants({ size: "lg", variant: "secondary" })} onClick={openSearch} type="button">
              <Search data-icon="inline-start" />
              Search
            </button>
          </div>
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}
