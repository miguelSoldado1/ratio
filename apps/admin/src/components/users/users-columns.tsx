import { CopyIcon, MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminUserRow } from "@/server/services/users-service";

function parseRoles(role: string | null) {
  return (role ?? "user")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

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
        {row.original.banned ? <Badge variant="destructive">banned</Badge> : null}
      </div>
    ),
    meta: {
      label: "Role",
    },
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
    cell: ({ row }) => <UserActionsMenu user={row.original} />,
    size: 20,
  },
];

function UserActionsMenu({ user }: { user: AdminUserRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button aria-label={`Actions for ${user.name}`} size="icon" variant="ghost" />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={async () => {
            await navigator.clipboard.writeText(user.id);
            toast.success("User id copied to clipboard");
          }}
        >
          <CopyIcon />
          Copy user id
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
