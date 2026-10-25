"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rail icon button that wipes demo data and re-seeds the inbox. */
export function ResetDemoButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Reset demo"
      className={cn(
        "group relative flex size-12 cursor-pointer items-center justify-center rounded-xl text-foreground/50 transition-colors hover:bg-white/60 hover:text-foreground disabled:opacity-60",
        className,
      )}
      onClick={async () => {
        if (!confirm("Reset the demo? This deletes all agents, runs, approvals and logs, and re-seeds the inbox. Workspace settings are kept.")) return;
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        setBusy(false);
        router.push("/agents/new");
        router.refresh();
      }}
    >
      <RotateCcw className={cn("size-[21px]", busy && "animate-spin")} strokeWidth={1.8} />
      <span className="tip">{busy ? "Resetting…" : "Reset demo"}</span>
    </button>
  );
}
