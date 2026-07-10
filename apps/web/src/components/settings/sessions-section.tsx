import { MonitorX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionIntro } from "./section-intro";
import { SettingsActionCard } from "./settings-action-card";

interface SessionsSectionProps {
  isPending: boolean;
  onSignOutOthers: () => void;
}

export function SessionsSection({ isPending, onSignOutOthers }: SessionsSectionProps) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <SectionIntro description="End active logins on other browsers and devices." title="Sessions" />
      <SettingsActionCard
        action={
          <Button disabled={isPending} onClick={onSignOutOthers} type="button" variant="outline">
            Sign out others
          </Button>
        }
        description="Your current session stays active."
        icon={<MonitorX />}
        title="Other sessions"
      />
    </section>
  );
}
