import { Check, PlusCircle, XCircle } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Column } from "@tanstack/react-table";
import type { Option } from "@/types/data-table";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  multiple?: boolean;
  onSearchChange?: (value: string) => void;
  options: Option[];
  searchValue?: string;
  selectedOptions?: Option[];
  title?: string;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  selectedOptions,
  multiple,
  searchValue,
  onSearchChange,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);

  const columnFilterValue = column?.getFilterValue();
  const selectedValues = React.useMemo(
    () => new Set(Array.isArray(columnFilterValue) ? columnFilterValue : []),
    [columnFilterValue]
  );

  const displayOptions = React.useMemo(() => {
    if (selectedOptions && selectedOptions.length > 0) return selectedOptions;
    return options;
  }, [options, selectedOptions]);

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;

      if (multiple) {
        const newSelectedValues = new Set(selectedValues);
        if (isSelected) {
          newSelectedValues.delete(option.value);
        } else {
          newSelectedValues.add(option.value);
        }
        const filterValues = Array.from(newSelectedValues);
        column.setFilterValue(filterValues.length ? filterValues : undefined);
      } else {
        column.setFilterValue(isSelected ? undefined : [option.value]);
        setOpen(false);
      }
    },
    [column, multiple, selectedValues]
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      column?.setFilterValue(undefined);
    },
    [column]
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={<Button className="border-dashed" size="sm" variant="outline" />}>
        {selectedValues?.size > 0 ? (
          // biome-ignore lint/a11y/useSemanticElements: rendered inside the trigger button, so a nested <button> would be invalid
          <div
            aria-label={`Clear ${title} filter`}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={onReset}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onReset();
            }}
            role="button"
            tabIndex={0}
          >
            <XCircle />
          </div>
        ) : (
          <PlusCircle />
        )}
        {title}
        {selectedValues?.size > 0 && (
          <>
            <Separator className="mx-0.5 data-[orientation=vertical]:h-4" orientation="vertical" />
            <Badge className="rounded-sm px-1 font-normal lg:hidden" variant="secondary">
              {selectedValues.size}
            </Badge>
            <div className="hidden items-center gap-1 lg:flex">
              {selectedValues.size > 2 ? (
                <Badge className="rounded-sm px-1 font-normal" variant="secondary">
                  {selectedValues.size} selected
                </Badge>
              ) : (
                displayOptions
                  .filter((option) => selectedValues.has(option.value))
                  .map((option) => (
                    <Badge className="rounded-sm px-1 font-normal" key={option.value} variant="secondary">
                      {option.label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-50 p-0">
        <Command>
          <CommandInput onValueChange={onSearchChange} placeholder={title} value={searchValue} />
          <CommandList className="max-h-full">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="max-h-75 overflow-y-auto overflow-x-hidden">
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem key={option.value} onSelect={() => onItemSelect(option, isSelected)}>
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected ? "bg-primary" : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check />
                    </div>
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    {option.count && <span className="ml-auto font-mono text-xs">{option.count}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem className="justify-center text-center" onSelect={() => onReset()}>
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
