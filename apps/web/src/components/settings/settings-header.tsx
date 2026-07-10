export function SettingsHeader() {
  return (
    <header className="flex max-w-2xl flex-col gap-2">
      <h1 className="font-semibold text-3xl tracking-tight">Account settings</h1>
      <p className="text-muted-foreground text-sm">
        Keep sign-in access portable, close sessions you no longer use, or remove the account entirely.
      </p>
    </header>
  );
}
