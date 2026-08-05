import { Plus } from "lucide-react";
import { listRowClassName } from "./list-row-styles";

// Additive actions are rows rather than floating buttons: they scroll with the content they belong
// to, which matters most inside the profile's swipeable tabs where the tab bar overlays the panel.

interface ListAddRowProps {
  description: string;
  label: string;
  onClick: () => void;
}

export function ListAddRow({ description, label, onClick }: ListAddRowProps) {
  return (
    <li className={listRowClassName}>
      <button
        className="group/add-row focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-sm py-3 text-left outline-none sm:gap-4"
        onClick={onClick}
        type="button"
      >
        <span className="flex size-14 shrink-0 items-center justify-center border border-border border-dashed bg-muted/40 text-muted-foreground [transition:background-color_150ms_ease,border-color_150ms_ease,color_150ms_ease] group-hover/add-row:border-primary/50 group-hover/add-row:bg-primary/10 group-hover/add-row:text-primary">
          <Plus className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground text-sm leading-snug">{label}</span>
          <span className="mt-1 block truncate text-muted-foreground text-xs">{description}</span>
        </span>
      </button>
    </li>
  );
}
