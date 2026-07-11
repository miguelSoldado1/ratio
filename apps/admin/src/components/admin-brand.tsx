import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";

export function AdminBrand() {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <Link aria-label="Ratio Admin home" className={buttonVariants({ size: "icon", variant: "link" })} to="/users">
        <img alt="" className="size-8" height={32} src="/favicon.svg" width={32} />
      </Link>
      <Button className="text-foreground" render={<Link to="/users" />} size="sm" variant="link">
        Users
      </Button>
    </div>
  );
}
