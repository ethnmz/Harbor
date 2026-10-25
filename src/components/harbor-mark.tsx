import { Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

/** The anchor tile: black on light surfaces, white on the black rail (`onDark`). */
export function HarborMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn("flex size-7 items-center justify-center rounded-lg", onDark ? "size-12 rounded-xl bg-white text-rail" : "bg-rail text-white", className)}>
      <Anchor className={onDark ? "size-6" : "size-4"} strokeWidth={2.4} />
    </span>
  );
}
