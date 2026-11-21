import type { ReactNode } from "react";
import type { ReviewAlbum } from "@/components/review-card";

interface ReviewPageShellProps {
  album?: ReviewAlbum;
  children: ReactNode;
  pending?: boolean;
}

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
