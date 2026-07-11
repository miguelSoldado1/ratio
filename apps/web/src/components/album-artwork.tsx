import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

interface AlbumArtworkProps
  extends Omit<ComponentPropsWithoutRef<"img">, "alt" | "className" | "height" | "src" | "width"> {
  alt: string;
  className?: string;
  height: number;
  src?: null | string;
  width: number;
}

export function AlbumArtwork({ alt, className, height, src, width, ...imageProps }: AlbumArtworkProps) {
  return (
    <span aria-label={alt} className={cn("relative block shrink-0 overflow-hidden bg-muted", className)} role="img">
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-muted-foreground/35">
        <Disc3 className="size-1/2 max-h-20 max-w-20" />
      </span>
      {src ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          height={height}
          ref={handleArtworkImageRef}
          referrerPolicy="no-referrer"
          src={src}
          width={width}
          {...imageProps}
        />
      ) : null}
    </span>
  );
}

function handleArtworkImageRef(node: HTMLImageElement | null) {
  if (!node) return;

  node.addEventListener("error", hideArtworkImage);
  node.addEventListener("load", showArtworkImage);

  return () => {
    node.removeEventListener("error", hideArtworkImage);
    node.removeEventListener("load", showArtworkImage);
  };
}

function hideArtworkImage(event: Event) {
  const image = event.currentTarget;

  if (image instanceof HTMLImageElement) {
    image.hidden = true;
  }
}

function showArtworkImage(event: Event) {
  const image = event.currentTarget;

  if (image instanceof HTMLImageElement) {
    image.hidden = false;
  }
}
