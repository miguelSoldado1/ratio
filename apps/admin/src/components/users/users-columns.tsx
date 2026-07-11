import { ExternalLinkIcon } from "lucide-react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { parseRoles } from "@/lib/roles";
import { getWebAppHref } from "@/lib/web-app";
import { UserActionsMenu } from "./user-actions-menu";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminUserRow } from "@/server/services/user-service";

export const usersColumns: ColumnDef<AdminUserRow>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Id" />,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    meta: { label: "Id", variant: "text", placeholder: "Search by id..." },
    enableSorting: false,
    enableColumnFilter: true,
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => {
      const account = row.original;

      if (!account.username) return <span className="truncate">{account.name}</span>;

      return (
        <a
          aria-label={`Open ${account.name}'s profile on Ratio`}
          className="group inline-flex max-w-full items-center gap-1.5 truncate font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={getWebAppHref(`/user/${encodeURIComponent(account.username)}`)}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{account.name}</span>
          <ExternalLinkIcon
            aria-hidden
            className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </a>
      );
    },
    meta: { label: "Name", variant: "text", placeholder: "Search name..." },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "email",
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    meta: { label: "Email", variant: "text", placeholder: "Search email..." },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "role",
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        {parseRoles(row.original.role).map((role) => (
          <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>
            {role}
          </Badge>
        ))}
      </div>
    ),
    meta: {
      label: "Role",
    },
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    id: "banned",
    accessorKey: "banned",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ getValue }) => {
      const isBanned = getValue<boolean | null>();

      return <Badge variant={isBanned ? "destructive" : "secondary"}>{isBanned ? "Banned" : "Unbanned"}</Badge>;
    },
    meta: {
      label: "Status",
      options: [
        { label: "Banned", value: "true" },
        { label: "Unbanned", value: "false" },
      ],
      variant: "select",
    },
    enableSorting: false,
    enableColumnFilter: true,
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created Date" />,
    cell: ({ getValue }) => formatDate(getValue<Date>()),
    meta: { label: "Created date" },
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <UserActionsMenu user={row.original} />,
    size: 20,
  },
];
