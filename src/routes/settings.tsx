import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6 xl:px-0">
      <h1 className="font-semibold text-2xl tracking-tight">Account settings</h1>
    </main>
  );
}
