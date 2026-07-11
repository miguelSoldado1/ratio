import { AdminAccountMenu } from "@/components/admin-account-menu";
import { AdminBrand } from "@/components/admin-brand";
import type { AdminUser } from "@/server/admin-access";

interface TopBarProps {
  user: AdminUser;
}

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-border/80 border-b bg-background/95 px-5 py-3 backdrop-blur-md lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <AdminBrand />
        <AdminAccountMenu user={user} />
      </div>
    </header>
  );
}
