import { cn } from "@/lib/utils";

/** Frosted speech bubble for a mascot's line, Duolingo-style. The tail points at the mascot. */
export function SpeechBubble({ tail = "left", className, children }: { tail?: "left" | "top" | "bottom"; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("glass relative rounded-[20px] px-5 py-3.5 text-[15px] leading-relaxed text-foreground", className)}>
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute size-0 border-transparent",
          tail === "left" && "top-7 -left-[9px] border-y-[8px] border-r-[10px] border-r-white/80",
          tail === "top" && "-top-[9px] left-1/2 -translate-x-1/2 border-x-[8px] border-b-[10px] border-b-white/80",
          tail === "bottom" && "-bottom-[9px] left-10 border-x-[8px] border-t-[10px] border-t-white/80",
        )}
      />
    </div>
  );
}
