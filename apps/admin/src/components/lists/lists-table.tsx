import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useQueryTable } from "@/hooks/use-query-table";
import { adminListQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getTableLists } from "@/server/functions/list-functions";
import { ListDetailsDialog } from "./list-details-dialog";
import { listsColumns } from "./lists-columns";
import type { AdminListRow } from "@/server/services/list-service";

export function ListsTable() {
  const [selectedList, setSelectedList] = useState<AdminListRow | null>(null);

  const getTableFn = useServerFn(getTableLists);
  const { table, query } = useQueryTable({
    columns: listsColumns,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { start: [], end: ["actions"] },
    },
    queryOptions: (params) => ({
      queryKey: adminListQueryKeys.table(params),
      queryFn: () => getTableFn({ data: params }),
    }),
  });

  if (query.isLoading) {
    return <DataTableSkeleton columnCount={7} filterCount={2} rowCount={10} />;
  }

  return (
    <>
      <DataTable
        getRowLabel={(list) => {
          const owner = list.userDisplayUsername ?? list.username ?? list.userName;
          return `View ${owner}'s list ${list.title}`;
        }}
        onRowActivate={setSelectedList}
        table={table}
      >
        <DataTableToolbar isLoading={query.isFetching} refetch={query.refetch} table={table}>
          <DataTableSortList table={table} />
        </DataTableToolbar>
      </DataTable>
      {selectedList ? (
        <ListDetailsDialog
          list={selectedList}
          onOpenChange={(open) => {
            if (!open) setSelectedList(null);
          }}
          open
        />
      ) : null}
    </>
  );
}
