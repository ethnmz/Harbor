import { MASCOTS, type MascotKind } from "@/lib/mascots";
import { cn } from "@/lib/utils";

/** Frosted speech bubble for a mascot's line, Duolingo-style. The tail points at the speaker. */
export function SpeechBubble({ speaker, tail = "left", className, children }: { speaker?: MascotKind; tail?: "left" | "bottom"; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("glass relative rounded-[20px] px-5 py-3.5 text-[15px] leading-relaxed text-foreground", className)}>
      {speaker && (
        <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          <span className="size-2 rounded-full" style={{ background: MASCOTS[speaker].color }} />
          {MASCOTS[speaker].name}
        </div>
      )}
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute size-0 border-transparent",
          tail === "left" ? "top-7 -left-[9px] border-y-[8px] border-r-[10px] border-r-white/80" : "-bottom-[9px] left-10 border-x-[8px] border-t-[10px] border-t-white/80",
        )}
      />
    </div>
  );
}
