import { CalendarIcon, XCircle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { formatDate, toUTCMidnight } from "@/lib/format";
import type { Column } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";

type DateSelection = Date[] | DateRange;

function getIsDateRange(value: DateSelection): value is DateRange {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return;
  const numericTimestamp = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseColumnFilterValue(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "number" || typeof item === "string");
  }

  if (typeof value === "string" || typeof value === "number") {
    return [value];
  }

  return [];
}

interface DataTableDateFilterProps<TData> {
  column: Column<TData, unknown>;
  multiple?: boolean;
  title?: string;
}

export function DataTableDateFilter<TData>({ column, title, multiple }: DataTableDateFilterProps<TData>) {
  const columnFilterValue = column.getFilterValue();

  const selectedDates = React.useMemo<DateSelection>(() => {
    if (!columnFilterValue) {
      return multiple ? { from: undefined, to: undefined } : [];
    }

    if (multiple) {
      const timestamps = parseColumnFilterValue(columnFilterValue);
      return {
        from: parseAsDate(timestamps[0]),
        to: parseAsDate(timestamps[1]),
      };
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    const date = parseAsDate(timestamps[0]);
    return date ? [date] : [];
  }, [columnFilterValue, multiple]);

  const onSelect = React.useCallback(
    (date: Date | DateRange | undefined) => {
      if (!date) {
        column.setFilterValue(undefined);
        return;
      }

      if (multiple && !("getTime" in date)) {
        const from = date.from ? toUTCMidnight(date.from) : undefined;
        const to = date.to ? toUTCMidnight(date.to) : undefined;
        column.setFilterValue(from || to ? [from, to] : undefined);
      } else if (!multiple && "getTime" in date) {
        column.setFilterValue(toUTCMidnight(date));
      }
    },
    [column, multiple]
  );

  const onReset = React.useCallback(
    (event: React.SyntheticEvent) => {
      event.stopPropagation();
      column.setFilterValue(undefined);
    },
    [column]
  );

  const hasValue = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return false;
      return selectedDates.from || selectedDates.to;
    }
    if (!Array.isArray(selectedDates)) return false;
    return selectedDates.length > 0;
  }, [multiple, selectedDates]);

  const formatDateRange = React.useCallback((range: DateRange) => {
    if (!(range.from || range.to)) return "";
    if (range.from && range.to) {
      return `${formatDate(range.from, { hour: undefined, minute: undefined })} - ${formatDate(range.to, { hour: undefined, minute: undefined })}`;
    }
    return formatDate(range.from ?? range.to, {
      hour: undefined,
      minute: undefined,
    });
  }, []);

  const label = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return null;

      const hasSelectedDates = selectedDates.from || selectedDates.to;
      const dateText = hasSelectedDates ? formatDateRange(selectedDates) : "Select date range";

      return (
        <span className="flex items-center gap-2">
          <span>{title}</span>
          {hasSelectedDates && (
            <>
              <Separator className="mx-0.5 data-[orientation=vertical]:h-4" orientation="vertical" />
              <span>{dateText}</span>
            </>
          )}
        </span>
      );
    }

    if (getIsDateRange(selectedDates)) return null;

    const hasSelectedDate = selectedDates.length > 0;
    const dateText = hasSelectedDate
      ? formatDate(selectedDates[0], { hour: undefined, minute: undefined })
      : "Select date";

    return (
      <span className="flex items-center gap-2">
        <span>{title}</span>
        {hasSelectedDate && (
          <>
            <Separator className="mx-0.5 data-[orientation=vertical]:h-4" orientation="vertical" />
            <span>{dateText}</span>
          </>
        )}
      </span>
    );
  }, [selectedDates, multiple, formatDateRange, title]);

  return (
    <Popover>
      <PopoverTrigger render={<Button className="border-dashed" size="sm" variant="outline" />}>
        {hasValue ? (
          // biome-ignore lint/a11y/useSemanticElements: rendered inside the trigger button, so a nested <button> would be invalid
          <div
            aria-label={`Clear ${title} filter`}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={onReset}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onReset(event);
            }}
            role="button"
            tabIndex={0}
          >
            <XCircle />
          </div>
        ) : (
          <CalendarIcon />
        )}
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {multiple ? (
          <Calendar
            autoFocus
            mode="range"
            onSelect={onSelect}
            selected={getIsDateRange(selectedDates) ? selectedDates : { from: undefined, to: undefined }}
          />
        ) : (
          <Calendar
            autoFocus
            mode="single"
            onSelect={onSelect}
            selected={getIsDateRange(selectedDates) ? undefined : selectedDates[0]}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
