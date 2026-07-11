import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableSkeletonProps extends React.ComponentProps<"div"> {
  cellWidths?: string[];
  columnCount: number;
  filterCount?: number;
  rowCount?: number;
  shrinkZero?: boolean;
  withBorder?: boolean;
  withPagination?: boolean;
  withViewOptions?: boolean;
}

function skeletonKeys(prefix: string, length: number) {
  return Array.from({ length }, (_, index) => `${prefix}-${index}`);
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  filterCount = 0,
  cellWidths = ["auto"],
  withViewOptions = true,
  withPagination = true,
  withBorder = true,
  shrinkZero = false,
  className,
  ...props
}: DataTableSkeletonProps) {
  const cozyCellWidths = Array.from(
    { length: columnCount },
    (_, index) => cellWidths[index % cellWidths.length] ?? "auto"
  );

  const filterKeys = skeletonKeys("filter", filterCount);
  const columnKeys = skeletonKeys("column", columnCount);
  const rowKeys = skeletonKeys("row", rowCount);

  return (
    <div className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)} {...props}>
      <div className="flex w-full items-center justify-between gap-2 overflow-auto p-1">
        <div className="flex flex-1 items-center gap-2">
          {filterKeys.map((key) => (
            <Skeleton className="h-7 w-[4.5rem] border-dashed" key={key} />
          ))}
        </div>
        {withViewOptions ? <Skeleton className="ml-auto hidden h-7 w-[4.5rem] lg:flex" /> : null}
      </div>
      <div className={withBorder ? "rounded-md border" : undefined}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columnKeys.map((key, columnIndex) => (
                <TableHead
                  key={key}
                  style={{
                    width: cozyCellWidths[columnIndex],
                    minWidth: shrinkZero ? cozyCellWidths[columnIndex] : "auto",
                  }}
                >
                  <Skeleton className="h-6 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowKeys.map((rowKey) => (
              <TableRow className="hover:bg-transparent" key={rowKey}>
                {columnKeys.map((columnKey, columnIndex) => (
                  <TableCell
                    key={`${rowKey}-${columnKey}`}
                    style={{
                      width: cozyCellWidths[columnIndex],
                      minWidth: shrinkZero ? cozyCellWidths[columnIndex] : "auto",
                    }}
                  >
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {withPagination ? (
        <div className="flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8">
          <Skeleton className="h-7 w-40 shrink-0" />
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-[4.5rem]" />
            </div>
            <div className="flex items-center justify-center font-medium text-sm">
              <Skeleton className="h-7 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="hidden size-7 lg:block" />
              <Skeleton className="size-7" />
              <Skeleton className="size-7" />
              <Skeleton className="hidden size-7 lg:block" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
