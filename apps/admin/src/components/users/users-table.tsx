import { useServerFn } from "@tanstack/react-start";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useQueryTable } from "@/hooks/use-query-table";
import { adminUserQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getTableUsers } from "@/server/functions/user-functions";
import { usersColumns } from "./users-columns";

export function UsersTable() {
  const getTableFn = useServerFn(getTableUsers);

  const { table, query } = useQueryTable({
    columns: usersColumns,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { right: ["actions"] },
      columnVisibility: { role: false },
    },
    queryOptions: (params) => ({
      queryKey: adminUserQueryKeys.table(params),
      queryFn: () => getTableFn({ data: params }),
    }),
  });

  if (query.isLoading) {
    return <DataTableSkeleton columnCount={7} filterCount={3} rowCount={10} />;
  }

  return (
    <DataTable table={table}>
      <DataTableToolbar isLoading={query.isFetching} refetch={query.refetch} table={table}>
        <DataTableSortList table={table} />
      </DataTableToolbar>
    </DataTable>
  );
}
