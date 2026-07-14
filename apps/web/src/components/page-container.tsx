import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type PageContainerProps = ComponentProps<"div">;
type PageContainerContentProps = ComponentProps<"div">;

export function PageContainer({ className, ...props }: PageContainerProps) {
  return <div className={cn("mx-auto w-full max-w-375 bg-background", className)} {...props} />;
}

export function PageContainerContent({ className, ...props }: PageContainerContentProps) {
  return <div className={cn("mx-auto w-full max-w-375 px-5 py-8 lg:px-10", className)} {...props} />;
}
