import { Share2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tryCatch } from "@/try-catch";

interface ListShareButtonProps {
  authorDisplayName: string;
  className?: string;
  itemCount: number;
  listId: string;
  title: string;
}

export function ListShareButton({ authorDisplayName, className, itemCount, listId, title }: ListShareButtonProps) {
  const sharingRef = useRef(false);

  async function handleShareClick() {
    if (sharingRef.current) return;

    sharingRef.current = true;
    const permalink = new URL(`/list/${encodeURIComponent(listId)}`, window.location.origin).href;
    const albumLabel = itemCount === 1 ? "album" : "albums";
    const shareText = `${title} — a list of ${itemCount} ${albumLabel} by ${authorDisplayName}\n${permalink}`;

    const { data: copiedToClipboard, error } = await tryCatch(shareList(shareText));
    sharingRef.current = false;

    if (error) {
      return toast.error("Couldn't copy list", { description: "Something went wrong while copying the link." });
    }

    if (copiedToClipboard) {
      return toast.success("List copied", { description: "The link is on your clipboard." });
    }
  }

  return (
    <Button aria-label="Share list" className={className} onClick={handleShareClick} type="button" variant="outline">
      <Share2 data-icon="inline-start" />
      Share
    </Button>
  );
}

async function shareList(shareText: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    const { error } = await tryCatch(navigator.share({ text: shareText }));

    if (!error || isNativeShareCancellation(error)) return false;
  }

  await navigator.clipboard.writeText(shareText);

  return true;
}

function isNativeShareCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
