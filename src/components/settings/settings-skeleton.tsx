import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const providerRows = ["spotify", "google", "discord"] as const;

export function SettingsSkeleton() {
  return (
    <main
      aria-label="Loading account settings"
      className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 xl:px-0"
    >
      <header className="flex max-w-2xl flex-col gap-2">
        <Skeleton className="h-9 w-64 max-w-full rounded-sm" />
        <Skeleton className="h-4 w-full max-w-xl rounded-sm" />
      </header>

      <section className="flex flex-col gap-4 border-border border-t pt-6">
        <div className="flex max-w-2xl flex-col gap-2">
          <Skeleton className="h-5 w-36 rounded-sm" />
          <Skeleton className="h-4 w-full max-w-md rounded-sm" />
        </div>
        <div className="flex flex-col">
          {providerRows.map((provider) => (
            <div className="flex items-center gap-3 border-border border-b py-4" key={provider}>
              <Skeleton className="size-8 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28 rounded-sm" />
                <Skeleton className="mt-2 h-3 w-20 rounded-sm sm:hidden" />
              </div>
              <Skeleton className="hidden h-6 w-22 rounded-full sm:block" />
              <Skeleton className="hidden h-4 w-24 rounded-sm md:block" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </section>

      <SettingsActionSkeleton destructive={false} titleWidth="w-24" />
      <SettingsActionSkeleton destructive titleWidth="w-28" />
    </main>
  );
}

function SettingsActionSkeleton({ destructive, titleWidth }: { destructive: boolean; titleWidth: string }) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <Skeleton className="h-5 w-28 rounded-sm" />
        <Skeleton className="h-4 w-full max-w-sm rounded-sm" />
      </div>
      <div className="flex flex-col gap-3 rounded-3xl bg-muted/20 p-4 ring-1 ring-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className={destructive ? "size-9 rounded-full bg-destructive/10" : "size-9 rounded-full"} />
          <div className="min-w-0 flex-1">
            <Skeleton className={cn("h-4 rounded-sm", titleWidth)} />
            <Skeleton className="mt-2 h-4 w-full max-w-md rounded-sm" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </section>
  );
}
