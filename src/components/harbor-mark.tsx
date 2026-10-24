import { Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

export function HarborMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm", className)}>
      <Anchor className="size-4" strokeWidth={2.25} />
    </span>
  );
}
