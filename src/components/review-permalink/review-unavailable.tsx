import { ArrowLeft, MessageCircleX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewUnavailableProps {
  onClose: () => void;
}

export function ReviewUnavailable({ onClose }: ReviewUnavailableProps) {
  return (
    <article className="border-0 py-0">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MessageCircleX aria-hidden="true" className="size-3.5" />
        </div>
        <span className="font-medium text-foreground/75 text-sm">Review unavailable</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center bg-muted text-muted-foreground">
          <MessageCircleX aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="font-semibold text-foreground text-sm leading-snug">This review cannot be shown</h2>
          <p className="mt-1 max-w-md text-muted-foreground text-sm leading-6">
            It may have been deleted, moved, or made unavailable.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center">
        <Button className="active:scale-[0.97]" onClick={onClose} size="sm" type="button" variant="secondary">
          <ArrowLeft data-icon="inline-start" />
          Back to album
        </Button>
      </div>
    </article>
  );
}
