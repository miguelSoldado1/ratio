import { Badge } from "@/components/ui/badge";

export function LastUsedBadge() {
  return (
    <Badge className="absolute -top-2 -right-2 px-1.5 py-0 text-2xs" variant="secondary">
      Last used
    </Badge>
  );
}
