import { RefreshCwIcon, XIcon } from "lucide-react";
import * as React from "react";
import { DataTableDateFilter } from "@/components/data-table/data-table-date-filter";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputClear } from "@/components/ui/input-clear";
import { cn } from "@/lib/utils";
import type { Column, Table } from "@tanstack/react-table";

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
  isLoading?: boolean;
  refetch?: () => void;
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  isLoading,
  refetch,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = React.useMemo(() => table.getAllColumns().filter((column) => column.getCanFilter()), [table]);

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  return (
    <div
      aria-orientation="horizontal"
      className={cn("flex w-full items-start justify-between gap-2 p-1", className)}
      role="toolbar"
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {columns.map((column) => (
          <DataTableToolbarFilter column={column} key={column.id} />
        ))}
        {refetch && (
          <Button aria-label="Refresh data" onClick={refetch} size="sm" variant="outline">
            <RefreshCwIcon className={cn(isLoading && "animate-spin")} />
            Refresh
          </Button>
        )}
        {isFiltered && (
          <Button aria-label="Reset filters" className="border-dashed" onClick={onReset} size="sm" variant="outline">
            <XIcon />
            Reset
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}

interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({ column }: DataTableToolbarFilterProps<TData>) {
  const columnMeta = column.columnDef.meta;

  const onFilterRender = React.useCallback(() => {
    if (!columnMeta?.variant) return null;

    switch (columnMeta.variant) {
      case "text":
        return (
          <InputClear
            className="h-8 w-40 lg:w-56"
            onChange={(event) => column.setFilterValue(event.target.value)}
            onClear={() => column.setFilterValue("")}
            placeholder={columnMeta.placeholder ?? columnMeta.label}
            value={(column.getFilterValue() as string) ?? ""}
          />
        );

      case "number":
        return (
          <div className="relative">
            <Input
              className={cn("h-8 w-[120px]", columnMeta.unit && "pr-8")}
              inputMode="numeric"
              onChange={(event) => column.setFilterValue(event.target.value)}
              placeholder={columnMeta.placeholder ?? columnMeta.label}
              type="number"
              value={(column.getFilterValue() as string) ?? ""}
            />
            {columnMeta.unit && (
              <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-muted-foreground text-sm">
                {columnMeta.unit}
              </span>
            )}
          </div>
        );

      case "date":
      case "dateRange":
        return (
          <DataTableDateFilter
            column={column}
            multiple={columnMeta.variant === "dateRange"}
            title={columnMeta.label ?? column.id}
          />
        );

      case "select":
      case "multiSelect":
        return (
          <DataTableFacetedFilter
            column={column}
            multiple={columnMeta.variant === "multiSelect"}
            options={columnMeta.options ?? []}
            title={columnMeta.label ?? column.id}
          />
        );

      default:
        return null;
    }
  }, [column, columnMeta]);

  return onFilterRender();
}
