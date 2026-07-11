import { cn } from "@/lib/utils";

interface UserAvatarProps {
  className?: string;
  name: string;
  src?: null | string;
}

export function UserAvatar({ className, name, src }: UserAvatarProps) {
  const initial = name.trim().charAt(0) || "R";

  return (
    <span
      aria-label={name}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground uppercase",
        className
      )}
      role="img"
    >
      <span aria-hidden="true">{initial}</span>
      {src ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          height={96}
          ref={handleAvatarImageRef}
          referrerPolicy="no-referrer"
          src={src}
          width={96}
        />
      ) : null}
    </span>
  );
}

function handleAvatarImageRef(node: HTMLImageElement | null) {
  if (!node) return;

  node.addEventListener("error", hideAvatarImage);
  node.addEventListener("load", showAvatarImage);

  return () => {
    node.removeEventListener("error", hideAvatarImage);
    node.removeEventListener("load", showAvatarImage);
  };
}

function hideAvatarImage(event: Event) {
  const image = event.currentTarget;

  if (image instanceof HTMLImageElement) {
    image.hidden = true;
  }
}

function showAvatarImage(event: Event) {
  const image = event.currentTarget;

  if (image instanceof HTMLImageElement) {
    image.hidden = false;
  }
}
