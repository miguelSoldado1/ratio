import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  align?: "start" | "center";
  children?: ReactNode;
  className?: string;
  description?: string;
  title: string;
}

export function EmptyState({ children, align = "start", className, description, title }: EmptyStateProps) {
  return (
    <div className={cn("py-8", align === "center" && "text-center", className)}>
      <p className="font-medium text-sm">{title}</p>
      {description ? (
        <p className={cn("mt-1 max-w-md text-muted-foreground text-sm", align === "center" && "mx-auto")}>
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
