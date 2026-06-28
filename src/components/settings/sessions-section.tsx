import { MonitorX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionIntro } from "./section-intro";

interface SessionsSectionProps {
  isPending: boolean;
  onSignOutOthers: () => void;
}

export function SessionsSection({ isPending, onSignOutOthers }: SessionsSectionProps) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <SectionIntro description="End active logins on other browsers and devices." title="Sessions" />
      <div className="flex flex-col gap-3 rounded-3xl bg-muted/20 p-4 ring-1 ring-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border/70">
            <MonitorX className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm">Other sessions</p>
            <p className="text-muted-foreground text-sm">Your current session stays active.</p>
          </div>
        </div>
        <Button disabled={isPending} onClick={onSignOutOthers} type="button" variant="outline">
          Sign out others
        </Button>
      </div>
    </section>
  );
}
