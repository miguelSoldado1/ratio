import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";

function getThumbCount(value: number | readonly number[] | undefined) {
  if (value === undefined) return 2;
  return typeof value === "number" ? 1 : value.length;
}

function Slider<Value extends number | readonly number[]>({
  className,
  defaultValue,
  value,
  ...props
}: SliderPrimitive.Root.Props<Value>) {
  const thumbCount = getThumbCount(value ?? defaultValue);

  return (
    <SliderPrimitive.Root
      className={cn("data-vertical:h-full data-horizontal:w-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none select-none items-center data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-disabled:opacity-50">
        <SliderPrimitive.Track
          className="relative grow select-none overflow-hidden rounded-full bg-input/90 data-horizontal:h-2 data-vertical:h-full data-horizontal:w-full data-vertical:w-2"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className="select-none bg-primary data-horizontal:h-full data-vertical:w-full"
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }, (_, index) => (
          <SliderPrimitive.Thumb
            className="block h-4 w-6 shrink-0 select-none rounded-full bg-background not-dark:bg-clip-padding shadow-md ring-1 ring-foreground/10 transition-[color,box-shadow,background-color] hover:ring-4 hover:ring-ring/30 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-vertical:h-6 data-vertical:w-4"
            data-slot="slider-thumb"
            // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are positional
            key={index}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
