import type { ColumnSort, Row, RowData } from "@tanstack/react-table";
import type { DataTableConfig } from "@/config/data-table";
import type { DataTableFeatures } from "@/lib/data-table";
import type { FilterItemSchema } from "@/lib/parsers";

export interface DataTableColumnMeta {
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  label?: string;
  options?: Option[];
  placeholder?: string;
  range?: [number, number];
  unit?: string;
  variant?: FilterVariant;
}

export interface Option {
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}

export type FilterOperator = DataTableConfig["operators"][number];
export type FilterVariant = DataTableConfig["filterVariants"][number];
export type JoinOperator = DataTableConfig["joinOperators"][number];

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, "id"> {
  id: Extract<keyof TData, string>;
}

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: Extract<keyof TData, string>;
}

export interface DataTableRowAction<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
  variant: "update" | "delete";
}
