import { ArrowLeft, Check, ListPlus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyListForAlbum } from "@/server/services/list-service";

const maxListItems = 100;
const pickerSkeletonRowIds = ["first", "second", "third", "fourth"] as const;

interface AlbumListPickerDialogProps {
  failedListIds: Set<string>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  lists: MyListForAlbum[];
  loadError: boolean;
  onCreateList: () => void;
  onLoadMore: () => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onSelect: (list: MyListForAlbum) => void;
  open: boolean;
  pendingListIds: Set<string>;
}

export function AlbumListPickerDialog({
  failedListIds,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  lists,
  loadError,
  onCreateList,
  onLoadMore,
  onOpenChange,
  onRetry,
  onSelect,
  open,
  pendingListIds,
}: AlbumListPickerDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return setInputValue("");
    }

    inputRef.current?.focus();
  }, [open]);

  return (
    <CommandDialog
      className="top-0 left-0 h-svh max-h-svh max-w-none translate-x-0 rounded-none! sm:top-18 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-4.5rem)] sm:max-w-lg sm:-translate-x-1/2 sm:rounded-4xl!"
      description="Choose one or more of your lists for this album."
      onOpenChange={onOpenChange}
      open={open}
      title="Add to list"
    >
      <Command className="relative h-full rounded-none sm:h-auto sm:rounded-4xl">
        <div className="flex shrink-0 items-center gap-2 border-border/70 border-b p-3 sm:block sm:border-b-0 sm:p-0">
          <Button
            aria-label="Close list picker"
            className="shrink-0 text-muted-foreground hover:text-foreground sm:hidden"
            onClick={() => onOpenChange(false)}
            shape="pill"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft />
          </Button>
          <CommandInput
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            autoFocus
            inputGroupClassName="h-10 sm:h-11"
            onClear={() => {
              setInputValue("");
              inputRef.current?.focus();
            }}
            onValueChange={setInputValue}
            placeholder="Search your lists..."
            ref={inputRef}
            spellCheck={false}
            value={inputValue}
            wrapperClassName="min-w-0 flex-1 p-0 sm:p-2 sm:pb-1"
          />
        </div>
        <CommandList className="max-h-none min-h-0 flex-1 scroll-py-2 sm:max-h-[min(60svh,26rem)] sm:flex-none">
          <CommandGroup forceMount>
            <CommandItem forceMount onSelect={onCreateList} value="create a new list">
              <Plus />
              <span className="min-w-0 flex-1 truncate">New list</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <AlbumListPickerResults
            failedListIds={failedListIds}
            isLoading={isLoading}
            lists={lists}
            loadError={loadError}
            onRetry={onRetry}
            onSelect={onSelect}
            pendingListIds={pendingListIds}
          />
        </CommandList>
        <div className="flex shrink-0 items-center justify-between gap-3 border-border/70 border-t px-4 py-2.5">
          <div className="min-w-0">
            {hasNextPage ? (
              <Button disabled={isFetchingNextPage} onClick={onLoadMore} size="sm" type="button" variant="ghost">
                Load more
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">You can add this album to more than one list.</p>
            )}
          </div>
          <Button
            className="-mr-2 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Done
          </Button>
        </div>
      </Command>
    </CommandDialog>
  );
}

interface AlbumListPickerResultsProps {
  failedListIds: Set<string>;
  isLoading: boolean;
  lists: MyListForAlbum[];
  loadError: boolean;
  onRetry: () => void;
  onSelect: (list: MyListForAlbum) => void;
  pendingListIds: Set<string>;
}

function AlbumListPickerResults({
  failedListIds,
  isLoading,
  lists,
  loadError,
  onRetry,
  onSelect,
  pendingListIds,
}: AlbumListPickerResultsProps) {
  if (isLoading) return <AlbumListPickerSkeleton />;

  if (loadError && lists.length === 0) {
    return (
      <EmptyState
        align="center"
        className="px-4"
        description="Your lists could not be loaded right now."
        title="Lists unavailable"
      >
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Try again
        </Button>
      </EmptyState>
    );
  }

  if (lists.length === 0) {
    return (
      <EmptyState
        align="center"
        className="px-4"
        description="Create one here and this album will be added to it."
        title="No lists yet"
      />
    );
  }

  return (
    <>
      <CommandEmpty className="text-muted-foreground">No matching lists</CommandEmpty>
      <CommandGroup heading="Your lists">
        {lists.map((list) => {
          const pending = pendingListIds.has(list.id);
          const failed = failedListIds.has(list.id);
          const full = list.itemCount >= maxListItems;

          return (
            <CommandItem
              className="gap-3 py-2.5"
              disabled={list.containsAlbum || pending || full}
              key={list.id}
              onSelect={() => onSelect(list)}
              value={`list:${list.title}:${list.id}`}
            >
              <ListPlus />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-foreground text-sm">{list.title}</p>
                <p className="text-muted-foreground text-xs">
                  {list.itemCount} {list.itemCount === 1 ? "album" : "albums"}
                </p>
              </div>
              <ListPickerStatus containsAlbum={list.containsAlbum} failed={failed} full={full} />
            </CommandItem>
          );
        })}
      </CommandGroup>
    </>
  );
}

interface ListPickerStatusProps {
  containsAlbum: boolean;
  failed: boolean;
  full: boolean;
}

function ListPickerStatus({ containsAlbum, failed, full }: ListPickerStatusProps) {
  if (containsAlbum) {
    return (
      <Badge variant="secondary">
        <Check data-icon="inline-start" />
        Added
      </Badge>
    );
  }

  if (failed) return <Badge variant="destructive">Retry</Badge>;
  if (full) return <Badge variant="outline">Full</Badge>;

  return null;
}

function AlbumListPickerSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {pickerSkeletonRowIds.map((rowId) => (
        <div className="flex items-center gap-3 px-2 py-2" key={rowId}>
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
