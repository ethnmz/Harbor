"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Reset the demo? This deletes all agents, runs, approvals and logs, and re-seeds the inbox. Workspace settings are kept.")) return;
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        setBusy(false);
        router.push("/agents/new");
        router.refresh();
      }}
    >
      <RotateCcw className={busy ? "animate-spin" : ""} />
      {busy ? "Resetting…" : "Reset demo"}
    </Button>
  );
}
