import { cn } from "@/lib/utils";

interface UserAvatarProps {
  alt?: string;
  className?: string;
  fallbackInitial?: string;
  height: number;
  imageClassName?: string;
  name: string;
  src?: null | string;
  width?: number;
}

export function UserAvatar({
  alt,
  className,
  fallbackInitial = "U",
  height,
  imageClassName,
  name,
  src,
  width = height,
}: UserAvatarProps) {
  const initial = name.trim().charAt(0) || fallbackInitial;

  if (src) {
    return (
      <img
        alt={alt ?? name}
        className={cn("shrink-0 rounded-full object-cover", className, imageClassName)}
        height={height}
        referrerPolicy="no-referrer"
        src={src}
        width={width}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground uppercase",
        className
      )}
    >
      {initial}
    </div>
  );
}
