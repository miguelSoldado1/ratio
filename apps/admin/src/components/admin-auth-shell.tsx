import type { ReactNode } from "react";

interface AdminAuthShellProps {
  children: ReactNode;
}

export function AdminAuthShell({ children }: AdminAuthShellProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-4 py-12 *:w-full *:max-w-sm">
      {children}
    </main>
  );
}
