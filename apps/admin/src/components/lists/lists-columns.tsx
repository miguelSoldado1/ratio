import { ExternalLinkIcon } from "lucide-react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ListCover } from "@/components/lists/list-cover";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { getWebAppHref } from "@/lib/web-app";
import { ListActionsMenu } from "./list-actions-menu";
import type { ColumnDef } from "@tanstack/react-table";
import type { DataTableFeatures } from "@/lib/data-table";
import type { AdminListRow } from "@/server/services/list-service";

export const listsColumns: ColumnDef<DataTableFeatures, AdminListRow>[] = [
  {
    id: "user",
    accessorFn: (list) => list.userDisplayUsername ?? list.username ?? list.userName,
    header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
    cell: ({ row }) => {
      const list = row.original;
      const displayName = list.userDisplayUsername ?? list.username ?? list.userName;
      const username = list.username ? `@${list.username}` : list.userName;

      const userContent = (
        <>
          <UserAvatar className="size-8" name={displayName} src={list.userImage} />
          <div className="min-w-0">
            <div className="max-w-44 truncate font-medium">{displayName}</div>
            <div className="max-w-44 truncate text-muted-foreground text-xs">{username}</div>
          </div>
          {list.username ? (
            <ExternalLinkIcon
              aria-hidden
              className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          ) : null}
        </>
      );

      return list.username ? (
        <a
          aria-label={`Open ${displayName}'s profile on Ratio`}
          className="group flex min-w-44 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={getWebAppHref(`/user/${encodeURIComponent(list.username)}`)}
          rel="noreferrer"
          target="_blank"
        >
          {userContent}
        </a>
      ) : (
        <div className="flex min-w-44 items-center gap-2.5">{userContent}</div>
      );
    },
    meta: { label: "User", variant: "text", placeholder: "Search user..." },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "title",
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="List" />,
    cell: ({ row }) => {
      const list = row.original;

      return (
        <a
          aria-label={`Open ${list.title} list on Ratio`}
          className="group/list flex min-w-48 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={getWebAppHref(`/list/${encodeURIComponent(list.id)}`)}
          rel="noreferrer"
          target="_blank"
        >
          <ListCover albums={list.coverAlbums} className="size-9 rounded" coverUrl={list.coverUrl} size={36} />
          <div className="min-w-0">
            <div className="flex max-w-56 items-center gap-1.5 truncate font-medium">
              <span className="truncate">{list.title}</span>
              <ExternalLinkIcon
                aria-hidden
                className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/list:opacity-100 group-focus-visible/list:opacity-100"
              />
            </div>
            <div className="max-w-56 truncate text-muted-foreground text-xs">
              {list.description ?? "No description"}
            </div>
          </div>
        </a>
      );
    },
    meta: { label: "List", variant: "text", placeholder: "Search title or description..." },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "albums",
    accessorKey: "itemCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Albums" />,
    cell: ({ getValue }) => <span className="tabular-nums">{formatCompactNumber(getValue<number>())}</span>,
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    id: "isRanked",
    accessorKey: "isRanked",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Numbered" />,
    cell: ({ getValue }) =>
      getValue<boolean>() ? (
        <Badge variant="secondary">Numbered</Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Updated Date" />,
    cell: ({ getValue }) => formatDate(getValue<Date>()),
    meta: { label: "Updated date" },
    enableSorting: true,
    enableColumnFilter: false,
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
    cell: ({ row }) => <ListActionsMenu list={row.original} />,
    size: 20,
  },
];
