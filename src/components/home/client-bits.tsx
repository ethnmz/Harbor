"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Panel } from "@/components/ui/primitives";

/** Top-right card: describe a job and jump straight into the step-by-step builder. */
export function BuildAgentCard() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [hint, setHint] = useState(false);
  return (
    <Panel variant="glass" title="Build an agent" description="Say what the job is. Harbor does the rest, one step at a time.">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length < 8) {
            setHint(true);
            return input.current?.focus();
          }
          router.push(`/agents/new?prompt=${encodeURIComponent(text.trim())}`);
        }}
      >
        <Input
          ref={input}
          id="job"
          aria-label="What should the agent do?"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setHint(false);
          }}
          placeholder="Triage new tickets and alert #support-urgent"
          className="h-12 flex-1 border-white/80 bg-white/55 text-[15px]"
          aria-describedby={hint ? "job-hint" : undefined}
        />
        <Button type="submit" size="icon" className="size-12 shrink-0" aria-label="Create agent">
          <ArrowRight />
        </Button>
      </form>
      {hint && (
        <p id="job-hint" className="mt-2 text-[13px] text-danger">
          Add a sentence about what the agent should do.
        </p>
      )}
      <Link href="/agents?view=templates" className="mt-4 inline-block text-[14px] font-medium text-muted-foreground hover:text-foreground">
        or start from a template →
      </Link>
    </Panel>
  );
}

export function ApproveAllButton({ approvalIds, reviewHref }: { approvalIds: string[]; reviewHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          for (const id of approvalIds) {
            const res = await fetch(`/api/approvals/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "approved" }) });
            if (!res.ok && res.status !== 409) {
              setError("Could not approve. Try again from the run.");
              break;
            }
          }
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
        {approvalIds.length > 1 ? `Approve all ${approvalIds.length}` : "Approve"}
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href={reviewHref}>Review</Link>
      </Button>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </div>
  );
}
