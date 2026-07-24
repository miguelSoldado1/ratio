import type { ReactNode } from "react";
import type { ReviewAlbum } from "@/components/review-card";

interface ReviewPageShellProps {
  /** The reviewed album, once known. Omitted while loading or unavailable. */
  album?: ReviewAlbum;
  children: ReactNode;
  /** Keeps the route heading meaningful while review data is loading. */
  pending?: boolean;
}

/** Full-width profile-style rail for the standalone review. The visible album
 * identity belongs to the root review row, keeping one content hierarchy at
 * every breakpoint while this shell supplies the document heading. */
export function ReviewPageShell({ album, children, pending = false }: ReviewPageShellProps) {
  return (
    <div className="min-w-0">
      <h1 className="sr-only">
        Review
        {album && !pending ? ` of ${album.title} by ${album.artist}` : ""}
      </h1>
      {children}
    </div>
  );
}
