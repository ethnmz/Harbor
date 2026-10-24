"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

export function ApprovalActions({ approvalId, onDecided, compact }: { approvalId: string; onDecided?: (resumed: boolean) => void; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError(null);
    const res = await fetch(`/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: note || undefined }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not record decision");
      return;
    }
    onDecided?.(data.resumed);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {showNote && <Input autoFocus placeholder="Optional note for the agent and audit log" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-xs" />}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="success" disabled={!!busy} onClick={() => decide("approved")}>
          {busy === "approved" ? <Loader2 className="animate-spin" /> : <Check />} Approve
        </Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => decide("rejected")}>
          {busy === "rejected" ? <Loader2 className="animate-spin" /> : <X />} Reject
        </Button>
        {!compact && !showNote && (
          <button type="button" className="cursor-pointer text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowNote(true)}>
            Add note
          </button>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
