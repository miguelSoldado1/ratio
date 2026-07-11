import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminBrand() {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <Link aria-label="Ratio Admin home" className={buttonVariants({ size: "icon", variant: "link" })} to="/users">
        <img alt="" className="size-8" height={32} src="/favicon.svg" width={32} />
      </Link>
      <Link className={cn(buttonVariants({ size: "sm", variant: "link" }), "text-foreground")} to="/users">
        Users
      </Link>
    </div>
  );
}
