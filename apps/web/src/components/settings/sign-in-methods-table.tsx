import { authProviders } from "@ratio/auth-providers";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SectionIntro } from "./section-intro";
import type { AuthProviderId } from "@ratio/auth-providers";

export interface LinkedAccount {
  accountId: string;
  createdAt: Date | string;
  id: string;
  providerId: string;
  updatedAt: Date | string;
  userId: string;
}

interface SignInMethodsTableProps {
  linkedAccounts: LinkedAccount[];
  linkedProviderCount: number;
  onLink: (providerId: AuthProviderId) => void;
  onUnlink: (providerId: AuthProviderId, accountId?: string) => void;
  pendingProvider: AuthProviderId | null;
  unlinkingProvider: AuthProviderId | null;
}

export function SignInMethodsTable({
  linkedAccounts,
  linkedProviderCount,
  onLink,
  onUnlink,
  pendingProvider,
  unlinkingProvider,
}: SignInMethodsTableProps) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <SectionIntro
        description="Use any connected provider to sign in to the same Ratio account."
        title="Sign-in methods"
      />
      <div className="min-w-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Provider</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Linked</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {authProviders.map((provider) => {
              const linkedAccount = linkedAccounts.find((account) => account.providerId === provider.id);

              return (
                <ProviderTableRow
                  isLinkPending={pendingProvider === provider.id}
                  isUnlinkPending={unlinkingProvider === provider.id}
                  key={provider.id}
                  linkedAccount={linkedAccount}
                  linkedProviderCount={linkedProviderCount}
                  onLink={onLink}
                  onUnlink={onUnlink}
                  provider={provider}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

interface ProviderTableRowProps {
  isLinkPending: boolean;
  isUnlinkPending: boolean;
  linkedAccount?: LinkedAccount;
  linkedProviderCount: number;
  onLink: (providerId: AuthProviderId) => void;
  onUnlink: (providerId: AuthProviderId, accountId?: string) => void;
  provider: (typeof authProviders)[number];
}

function ProviderTableRow({
  isLinkPending,
  isUnlinkPending,
  linkedAccount,
  linkedProviderCount,
  onLink,
  onUnlink,
  provider,
}: ProviderTableRowProps) {
  const isLinked = Boolean(linkedAccount);
  const isLastProvider = isLinked && linkedProviderCount <= 1;
  const isPending = isLinkPending || isUnlinkPending;
  const Icon = getProviderTableIcon(provider.id) ?? provider.icon;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border/70",
              provider.id === "discord" && "text-muted-foreground",
              provider.id === "spotify" && "text-primary"
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{provider.label}</p>
            <p className="text-muted-foreground text-xs sm:hidden">{isLinked ? "Connected" : "Not connected"}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant={isLinked ? "secondary" : "outline"}>{isLinked ? "Connected" : "Available"}</Badge>
      </TableCell>
      <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
        {linkedAccount ? formatLinkedDate(linkedAccount.createdAt) : "Not linked"}
      </TableCell>
      <TableCell className="text-right">
        {isLinked ? (
          <Button
            disabled={isPending || isLastProvider}
            onClick={() => {
              onUnlink(provider.id, linkedAccount?.accountId);
            }}
            size="sm"
            title={isLastProvider ? "Link another provider before removing this one" : undefined}
            type="button"
            variant="outline"
          >
            Remove
          </Button>
        ) : (
          <Button
            disabled={isPending}
            onClick={() => {
              onLink(provider.id);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <KeyRound data-icon="inline-start" />
            Link
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

interface ProviderTableIconProps {
  className?: string;
}

function SpotifyTableIcon(props: ProviderTableIconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function DiscordTableIcon(props: ProviderTableIconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.373 2.8a13.73 13.73 0 0 0-.633 1.299 18.43 18.43 0 0 0-5.48 0A12.9 12.9 0 0 0 8.627 2.8a19.736 19.736 0 0 0-4.947 1.572C.55 9.002-.304 13.515.12 17.963a19.956 19.956 0 0 0 6.063 3.038 14.68 14.68 0 0 0 1.297-2.083 12.91 12.91 0 0 1-2.043-.976c.171-.124.338-.253.5-.386a14.15 14.15 0 0 0 12.126 0c.164.134.331.263.5.386-.651.382-1.337.71-2.045.977.376.733.81 1.43 1.298 2.082a19.918 19.918 0 0 0 6.064-3.039c.499-5.157-.851-9.629-3.563-13.593ZM8.02 15.226c-1.182 0-2.157-1.08-2.157-2.407 0-1.328.956-2.408 2.157-2.408 1.21 0 2.176 1.09 2.157 2.408 0 1.327-.956 2.407-2.157 2.407Zm7.96 0c-1.183 0-2.157-1.08-2.157-2.407 0-1.328.955-2.408 2.157-2.408 1.21 0 2.176 1.09 2.156 2.408 0 1.327-.946 2.407-2.156 2.407Z" />
    </svg>
  );
}

function getProviderTableIcon(providerId: AuthProviderId) {
  if (providerId === "spotify") return SpotifyTableIcon;
  if (providerId === "discord") return DiscordTableIcon;

  return null;
}

function formatLinkedDate(value: Date | string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Linked";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
