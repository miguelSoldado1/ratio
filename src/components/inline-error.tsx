import { cn } from "@/lib/utils";

interface InlineErrorProps {
  align?: "start" | "center";
  className?: string;
  description?: string;
  title: string;
}

export function InlineError({ align = "start", className, description, title }: InlineErrorProps) {
  return (
    <div className={cn("py-8", align === "center" && "text-center", className)} role="alert">
      <p className="font-medium text-sm">{title}</p>
      {description ? (
        <p className={cn("mt-1 max-w-md text-muted-foreground text-sm", align === "center" && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
