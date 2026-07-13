import { PageContainer, PageContainerContent } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const providerRows = ["spotify", "google", "discord"] as const;

export function SettingsSkeleton() {
  return (
    <main aria-label="Loading account settings" className="min-h-screen bg-background text-foreground">
      <PageContainer className="max-w-5xl">
        <PageContainerContent className="flex flex-col gap-10">
          <header className="flex max-w-2xl flex-col gap-2">
            <Skeleton className="h-9 w-64 max-w-full rounded-sm" />
            {/* Description wraps to two lines below sm and collapses to one at sm+ (matches SettingsHeader copy). */}
            <Skeleton className="h-10 w-full max-w-xl rounded-sm sm:h-5" />
          </header>

          <section className="flex flex-col gap-4 border-border border-t pt-6">
            <SectionIntroSkeleton descriptionWidth="max-w-md" />
            <div className="min-w-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>
                      <Skeleton className="h-4 w-16 rounded-sm" />
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      <Skeleton className="h-4 w-14 rounded-sm" />
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <Skeleton className="h-4 w-14 rounded-sm" />
                    </TableHead>
                    <TableHead className="text-right">
                      <Skeleton className="ml-auto h-4 w-14 rounded-sm" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerRows.map((provider) => (
                    <TableRow className="hover:bg-transparent" key={provider}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Skeleton className="size-8 shrink-0 rounded-full" />
                          <div className="min-w-0">
                            <Skeleton className="h-4 w-24 rounded-sm" />
                            <Skeleton className="mt-2 h-3 w-20 rounded-sm sm:hidden" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-4 w-24 rounded-sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-8 w-20 rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <SettingsActionSkeleton descriptionLines={1} destructive={false} />
          <SettingsActionSkeleton descriptionLines={2} destructive />
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}

function SectionIntroSkeleton({ descriptionWidth }: { descriptionWidth: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-4 w-28 rounded-sm" />
      <Skeleton className={cn("h-5 w-full rounded-sm", descriptionWidth)} />
    </div>
  );
}

function SettingsActionSkeleton({ descriptionLines, destructive }: { descriptionLines: 1 | 2; destructive: boolean }) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <SectionIntroSkeleton descriptionWidth="max-w-sm" />
      <div
        className={cn(
          "flex flex-col gap-4 rounded-3xl p-4 ring-1 sm:flex-row sm:items-center sm:justify-between",
          destructive ? "bg-destructive/5 ring-destructive/20" : "bg-muted/20 ring-border/60"
        )}
      >
        <div className="flex items-start gap-3">
          <Skeleton className={cn("size-9 shrink-0 rounded-full", destructive && "bg-destructive/10")} />
          <div className="min-w-0">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <Skeleton className="mt-2 h-4 w-full max-w-md rounded-sm" />
            {/* Danger-zone copy wraps to a second line until it fits on one at lg. */}
            {descriptionLines > 1 && <Skeleton className="mt-1.5 h-4 w-2/3 max-w-xs rounded-sm lg:hidden" />}
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </section>
  );
}
