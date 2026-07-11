import { flexRender } from "@tanstack/react-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCommonPinningStyles } from "@/lib/data-table";
import { cn } from "@/lib/utils";
import type { Table as TanstackTable } from "@tanstack/react-table";
import type * as React from "react";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  actionBar?: React.ReactNode;
  getRowLabel?: (row: TData) => string;
  onRowActivate?: (row: TData) => void;
  pageSizeOptions?: number[];
  showPagination?: boolean;
  table: TanstackTable<TData>;
}

export function DataTable<TData>({
  table,
  actionBar,
  getRowLabel,
  onRowActivate,
  pageSizeOptions,
  showPagination = true,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  return (
    <div className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)} {...props}>
      {children}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    colSpan={header.colSpan}
                    key={header.id}
                    style={{
                      ...getCommonPinningStyles({ column: header.column }),
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  aria-haspopup={onRowActivate ? "dialog" : undefined}
                  aria-label={getRowLabel?.(row.original)}
                  className={cn(
                    onRowActivate &&
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  )}
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={(event) => {
                    if (onRowActivate && !isInteractiveTarget(event.target)) {
                      onRowActivate(row.original);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!(onRowActivate && (event.key === "Enter" || event.key === " "))) return;
                    if (isInteractiveTarget(event.target)) return;

                    event.preventDefault();
                    onRowActivate(row.original);
                  }}
                  tabIndex={onRowActivate ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        ...getCommonPinningStyles({ column: cell.column }),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-24 text-center" colSpan={table.getAllColumns().length}>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2.5">
        {showPagination && <DataTablePagination pageSizeOptions={pageSizeOptions} table={table} />}
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}

const INTERACTIVE_ELEMENT_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [role="menuitem"], [data-no-row-activate]';

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(INTERACTIVE_ELEMENT_SELECTOR) !== null;
}
