"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Check, Loader2, Sparkles } from "lucide-react";

/** Today's date in the viewer's locale (client-rendered to avoid server/client clock drift). */
export function TodayLabel() {
  return (
    <span suppressHydrationWarning className="text-[15px] text-foreground/80">
      {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
    </span>
  );
}

/** "Write a message" equivalent: describe a new agent and jump straight into generation. */
export function AgentComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <form
      className="flex h-14 items-center gap-3 rounded-2xl bg-muted/70 pr-2 pl-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length < 8) return;
        router.push(`/agents/new?prompt=${encodeURIComponent(text.trim())}`);
      }}
    >
      <Sparkles className="size-[18px] shrink-0 text-muted-foreground" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe a new agent…"
        aria-label="Describe a new agent"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/80"
      />
      <button
        type="submit"
        disabled={text.trim().length < 8}
        aria-label="Generate agent"
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-white transition-opacity disabled:cursor-default disabled:opacity-25"
      >
        <ArrowUp className="size-4" strokeWidth={2.4} />
      </button>
    </form>
  );
}

/** Approve every pending action of a paused run in one click; per-action review lives on the run timeline. */
export function ApproveAllButton({ approvalIds, reviewHref }: { approvalIds: string[]; reviewHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      <button
        type="button"
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
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[#141414] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {approvalIds.length > 1 ? `Approve all ${approvalIds.length}` : "Approve"}
      </button>
      <Link href={reviewHref} className="inline-flex h-9 items-center rounded-full bg-white/70 px-4 text-[13px] font-medium hover:bg-white">
        Review
      </Link>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </div>
  );
}
