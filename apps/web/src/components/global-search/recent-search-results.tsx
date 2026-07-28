import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandGroup, CommandItem, CommandShortcut } from "@/components/ui/command";
import type { RecentSearch } from "./recent-searches";

interface RecentSearchResultsProps {
  onClear: () => void;
  onRemove: (normalizedQuery: string) => void;
  onSelect: (query: string) => void;
  recentSearches: RecentSearch[];
}

export function RecentSearchResults({ onClear, onRemove, onSelect, recentSearches }: RecentSearchResultsProps) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
        <span className="font-medium text-2xs text-muted-foreground uppercase tracking-widest">Recent searches</span>
        <Button
          className="font-normal text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
          onClick={onClear}
          size="xs"
          type="button"
          variant="ghost"
        >
          Clear
        </Button>
      </div>
      <CommandGroup className="pt-0">
        {recentSearches.map((search) => (
          <CommandItem
            className="items-center gap-3 py-2.5 in-data-[selection-visible=true]:data-selected:bg-transparent data-selected:text-foreground data-selected:*:[svg]:text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:*:[svg]:text-foreground"
            key={search.normalizedQuery}
            onSelect={() => onSelect(search.query)}
            value={`recent:${search.normalizedQuery}`}
          >
            <History className="text-muted-foreground" />
            <span className="truncate text-left font-medium text-foreground text-sm">{search.query}</span>
            <CommandShortcut className="flex w-12 shrink-0 justify-center">
              <Button
                aria-label={`Remove ${search.query} from recent searches`}
                className="text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove(search.normalizedQuery);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                shape="pill"
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </CommandShortcut>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
