import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SettingsActionCardProps {
  action: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  title: string;
  variant?: "default" | "destructive";
}

export function SettingsActionCard({ action, description, icon, title, variant = "default" }: SettingsActionCardProps) {
  const isDestructive = variant === "destructive";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-3xl p-4 ring-1 sm:flex-row sm:items-center sm:justify-between",
        isDestructive ? "bg-destructive/5 ring-destructive/20" : "bg-muted/20 ring-border/60"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
            isDestructive
              ? "bg-destructive/10 text-destructive"
              : "bg-background text-muted-foreground ring-1 ring-border/70"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
