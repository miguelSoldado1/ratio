import { Heart, PencilLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AlbumActions({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(compact ? "grid grid-cols-[1fr_auto_auto] gap-2" : "flex flex-wrap items-center gap-3", className)}
    >
      <Button className="bg-[#1DB954] px-5 text-[#06150b] hover:bg-[#41d873]" size="lg" type="button">
        <PencilLine className="size-4" />
        Add a review
      </Button>
      <Button
        aria-label="Save album"
        className="text-muted-foreground hover:border-[#B7B2A8]/60 hover:text-foreground"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Plus className="size-5" />
      </Button>
      <Button
        aria-label="Like album"
        className="text-muted-foreground hover:border-[#FF6B4A]/70 hover:text-[#FF6B4A]"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Heart className="size-5" />
      </Button>
    </div>
  );
}
