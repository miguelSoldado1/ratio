import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Users", to: "/users" },
  { label: "Reviews", to: "/reviews" },
] as const;

export function AdminBrand() {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link aria-label="Ratio Admin" className="mr-1 flex shrink-0 items-center" to="/users">
        <img alt="" className="size-8" height={32} src="/favicon.svg" width={32} />
      </Link>
      <nav className="flex items-center gap-0.5">
        {NAV_LINKS.map((link) => (
          <Link
            className={cn(
              "rounded-full px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
              "data-[status=active]:bg-muted data-[status=active]:text-foreground"
            )}
            key={link.to}
            to={link.to}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
