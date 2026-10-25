import { Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

/** The anchor tile in black ink. `large` is the rail's 48 px version. */
export function HarborMark({ className, large }: { className?: string; large?: boolean }) {
  return (
    <span className={cn("flex items-center justify-center bg-rail text-white", large ? "size-12 rounded-xl shadow-[0_6px_16px_-6px_rgba(16,24,40,0.45)]" : "size-7 rounded-lg", className)}>
      <Anchor className={large ? "size-6" : "size-4"} strokeWidth={2.4} />
    </span>
  );
}
