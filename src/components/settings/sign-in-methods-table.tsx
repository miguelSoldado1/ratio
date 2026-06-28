import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authProviders } from "@/lib/auth/providers";
import { cn } from "@/lib/utils";
import { SectionIntro } from "./section-intro";
import type { AuthProviderId } from "@/lib/auth/providers";

export interface LinkedAccount {
  accountId: string;
  createdAt: Date | string;
  id: string;
  providerId: string;
  scopes?: string[];
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
  const Icon = provider.icon;

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

function formatLinkedDate(value: Date | string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Linked";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
