import { CircleXIcon } from "lucide-react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputClearProps extends React.ComponentProps<"input"> {
  onClear?: () => void;
}

export function InputClear({ className, onClear, ...props }: InputClearProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClearInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    if (onClear) {
      onClear();
    }
  };

  const showClearButton = props.value ? props.value.toString().length > 0 : false;

  return (
    <div className="relative">
      <Input className={cn("pe-9", className)} ref={inputRef} type="text" {...props} />
      {showClearButton && (
        <button
          aria-label="Clear input"
          className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleClearInput}
          type="button"
        >
          <CircleXIcon aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );
}
