import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useQueryTable } from "@/hooks/use-query-table";
import { adminReviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getTableReviews } from "@/server/functions/review-functions";
import { ReviewDetailsDialog } from "./review-details-dialog";
import { reviewsColumns } from "./reviews-columns";
import type { AdminReviewRow } from "@/server/services/review-service";

export function ReviewsTable() {
  const getTableFn = useServerFn(getTableReviews);
  const [selectedReview, setSelectedReview] = useState<AdminReviewRow | null>(null);

  const { table, query } = useQueryTable({
    columns: reviewsColumns,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { right: ["actions"] },
    },
    queryOptions: (params) => ({
      queryKey: adminReviewQueryKeys.table(params),
      queryFn: () => getTableFn({ data: params }),
    }),
  });

  if (query.isLoading) {
    return <DataTableSkeleton columnCount={7} filterCount={4} rowCount={10} />;
  }

  return (
    <>
      <DataTable
        getRowLabel={(review) => {
          const author = review.userDisplayUsername ?? review.username ?? review.userName;
          return `Read ${author}'s review of ${review.albumTitle}`;
        }}
        onRowActivate={setSelectedReview}
        table={table}
      >
        <DataTableToolbar isLoading={query.isFetching} refetch={query.refetch} table={table}>
          <DataTableSortList table={table} />
        </DataTableToolbar>
      </DataTable>
      {selectedReview ? (
        <ReviewDetailsDialog
          onOpenChange={(open) => {
            if (!open) setSelectedReview(null);
          }}
          open
          review={selectedReview}
        />
      ) : null}
    </>
  );
}
