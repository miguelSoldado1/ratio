import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search } from "lucide-react";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The equalizer echoes the Ratio brand mark — a nod at a track that can't be played.
const EQUALIZER_BARS = [
  { className: "bg-muted-foreground/40", delay: "0ms", height: "38%", id: "bar-1" },
  { className: "bg-muted-foreground/60", delay: "220ms", height: "64%", id: "bar-2" },
  { className: "bg-primary/70", delay: "80ms", height: "86%", id: "bar-3" },
  { className: "bg-primary", delay: "320ms", height: "100%", id: "bar-4" },
  { className: "bg-primary/70", delay: "140ms", height: "78%", id: "bar-5" },
  { className: "bg-muted-foreground/60", delay: "260ms", height: "56%", id: "bar-6" },
  { className: "bg-muted-foreground/40", delay: "100ms", height: "34%", id: "bar-7" },
];

function openSearch() {
  // Reuse the global "/" shortcut handler owned by the top bar's search dialog.
  document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "/" }));
}

export function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-background text-foreground">
      <PageContainer>
        <PageContainerContent className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center py-12">
          <article className="flex w-full max-w-md flex-col items-center text-center">
            {/* Missing "cover art" — the visualizer has fallen silent. */}
            <div className="relative">
              <div aria-hidden="true" className="absolute inset-0 -z-10 rounded-overlay bg-primary/15 blur-2xl" />
              <div className="flex size-40 items-center justify-center rounded-overlay border border-border bg-card shadow-black/20 shadow-lg sm:size-48">
                <div className="flex h-20 items-end gap-1.5 sm:h-24">
                  {EQUALIZER_BARS.map((bar) => (
                    <span
                      className={cn("w-2 animate-equalizer rounded-full sm:w-2.5", bar.className)}
                      key={bar.id}
                      style={{ animationDelay: bar.delay, height: bar.height }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-8 font-medium text-muted-foreground text-sm tabular-nums">
              404 <span className="text-muted-foreground-subtle">·</span> Page not found
            </p>

            <h1 className="mt-3 font-semibold text-3xl tracking-normal sm:text-4xl">This one isn't in our library.</h1>

            <p className="mt-3 max-w-sm text-muted-foreground text-sm leading-6">
              We couldn't find an album, review, or profile at this address. Head back to the feed, or search for what
              you were after.
            </p>

            <div className="mt-6 flex min-w-0 max-w-full items-center gap-2 text-muted-foreground text-xs">
              <span className="shrink-0 font-medium">Address</span>
              <code className="min-w-0 truncate rounded-md bg-muted/50 px-2 py-1 font-medium">{location.pathname}</code>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <Link className={buttonVariants({ size: "lg" })} to="/">
                <Home data-icon="inline-start" />
                Back to feed
              </Link>
              <button className={buttonVariants({ size: "lg", variant: "outline" })} onClick={openSearch} type="button">
                <Search data-icon="inline-start" />
                Search Ratio
              </button>
            </div>
          </article>
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}
