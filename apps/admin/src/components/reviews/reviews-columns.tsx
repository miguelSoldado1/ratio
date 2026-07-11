import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { ReviewActionsMenu } from "./review-actions-menu";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminReviewRow } from "@/server/services/review-service";

export const reviewsColumns: ColumnDef<AdminReviewRow>[] = [
  {
    id: "user",
    accessorFn: (review) => review.userDisplayUsername ?? review.username ?? review.userName,
    header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
    cell: ({ row }) => {
      const review = row.original;
      const displayName = review.userDisplayUsername ?? review.username ?? review.userName;
      const username = review.username ? `@${review.username}` : review.userName;

      return (
        <div className="flex min-w-44 items-center gap-2.5">
          <UserAvatar className="size-8" name={displayName} src={review.userImage} />
          <div className="min-w-0">
            <div className="max-w-44 truncate font-medium">{displayName}</div>
            <div className="max-w-44 truncate text-muted-foreground text-xs">{username}</div>
          </div>
        </div>
      );
    },
    meta: { label: "User", variant: "text", placeholder: "Search user name..." },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "album",
    accessorKey: "albumTitle",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Album" />,
    cell: ({ row }) => {
      const review = row.original;

      return (
        <div className="flex min-w-48 items-center gap-2.5">
          {review.albumCoverUrl ? (
            <img alt="" className="size-9 rounded object-cover" height={36} src={review.albumCoverUrl} width={36} />
          ) : (
            <div aria-hidden className="size-9 rounded bg-muted" />
          )}
          <div className="min-w-0">
            <div className="max-w-56 truncate font-medium">{review.albumTitle}</div>
            <div className="max-w-56 truncate text-muted-foreground text-xs">{review.albumArtistNames.join(", ")}</div>
          </div>
        </div>
      );
    },
    meta: { label: "Album", variant: "text", placeholder: "Search album..." },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "rating",
    accessorKey: "rating",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
    cell: ({ getValue }) => <Badge variant="secondary">{getValue<number>() / 2} / 5</Badge>,
    meta: { label: "Rating", variant: "number", placeholder: "1–10" },
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    id: "body",
    accessorKey: "body",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Review" />,
    cell: ({ getValue }) => {
      const body = getValue<string | null>();
      return body ? (
        <span className="block max-w-80 truncate">{body}</span>
      ) : (
        <span className="text-muted-foreground">-----------------</span>
      );
    },
    meta: { label: "Review", variant: "text", placeholder: "Search review body..." },
    enableSorting: false,
    enableColumnFilter: true,
  },
  {
    id: "likes",
    accessorKey: "likeCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Likes" />,
    cell: ({ getValue }) => <span className="tabular-nums">{formatCompactNumber(getValue<number>())}</span>,
    enableSorting: false,
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
    cell: ({ row }) => <ReviewActionsMenu review={row.original} />,
    size: 20,
  },
];
