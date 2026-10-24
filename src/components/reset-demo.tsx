"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="flex h-10 w-full cursor-pointer items-center gap-3.5 rounded-xl px-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      onClick={async () => {
        if (!confirm("Reset the demo? This deletes all agents, runs, approvals and logs, and re-seeds the inbox. Workspace settings are kept.")) return;
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        setBusy(false);
        router.push("/agents/new");
        router.refresh();
      }}
    >
      <RotateCcw className={busy ? "size-[19px] animate-spin" : "size-[19px]"} strokeWidth={1.8} />
      {busy ? "Resetting…" : "Reset demo"}
    </button>
  );
}
