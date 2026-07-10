import { Badge } from "@/components/ui/badge";
import type { ComponentProps, ReactNode } from "react";

interface AuthMethodBadgeProps {
  children: ReactNode;
  variant: ComponentProps<typeof Badge>["variant"];
}

export function AuthMethodBadge({ children, variant }: AuthMethodBadgeProps) {
  return (
    <Badge className="absolute -top-2 -right-2 px-1.5 py-0 text-2xs" variant={variant}>
      {children}
    </Badge>
  );
}
