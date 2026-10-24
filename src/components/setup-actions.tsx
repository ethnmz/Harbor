"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SetupButton() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/setup", { method: "POST" });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; log?: string[]; error?: string };
          setLog(data.log ?? []);
          if (res.ok && data.ok) {
            window.location.href = "/onboarding";
            return;
          }
          setError(data.error ?? `Setup failed (${res.status})`);
          setBusy(false);
        }}
      >
        {busy && <Loader2 className="animate-spin" />}
        {busy ? "Setting up…" : "Set up database"}
      </Button>
      {log.length > 0 && <pre className="rounded-xl bg-muted px-4 py-3 font-mono text-[12px] leading-5 whitespace-pre-wrap">{log.join("\n")}</pre>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}

export function RetryButton() {
  return (
    <Button variant="outline" onClick={() => window.location.reload()}>
      <RotateCcw /> Try again
    </Button>
  );
}
