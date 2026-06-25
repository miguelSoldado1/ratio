import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlobalSearchTriggerProps {
  className?: string;
  compact?: boolean;
  onOpen: () => void;
}

export function GlobalSearchTrigger({ className, compact = false, onOpen }: GlobalSearchTriggerProps) {
  if (compact) {
    return (
      <Button
        aria-keyshortcuts="/"
        aria-label="Search albums and users"
        className={cn("rounded-3xl text-muted-foreground hover:text-foreground active:scale-[0.97]", className)}
        onClick={onOpen}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Search />
      </Button>
    );
  }

  return (
    <Button
      aria-keyshortcuts="/"
      aria-label="Search albums and users"
      className={cn(
        "group h-10 w-full justify-start rounded-4xl border-border/70 bg-card/40 px-2.5 text-muted-foreground shadow-none transition-[background-color,border-color,transform] hover:border-border hover:bg-muted/60 hover:text-foreground active:scale-[0.99]",
        className
      )}
      onClick={onOpen}
      type="button"
      variant="outline"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Search data-icon="inline-start" />
        <span className="truncate text-sm">Search...</span>
      </span>
    </Button>
  );
}
