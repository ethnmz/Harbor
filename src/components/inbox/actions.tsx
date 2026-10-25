"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { cn } from "@/lib/utils";

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Request failed (${res.status})`);
  return res.json();
}

/** "Assignee" chip: picking an agent runs it on this ticket right away. */
export function AssignAgent({ ticketId, current, agents }: { ticketId: string; current: string | null; agents: { id: string; name: string; live: boolean }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!agents.length)
    return (
      <Link href="/agents/new" className="inline-flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold hover:bg-muted">
        Create an agent
      </Link>
    );
  return (
    <div className="relative">
      <label className="relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border bg-card pr-8 pl-2.5 text-[13px] font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:bg-muted/60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : current ? <AgentOrb seed={current} size={18} /> : <span className="size-[18px] rounded-full border-2 border-dashed border-input" />}
        <span className="max-w-36 truncate">{busy ? "Starting…" : (current ?? "Assign an agent")}</span>
        <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
        <select
          aria-label="Hand this ticket to an agent"
          value=""
          disabled={busy}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={async (e) => {
            const agentId = e.target.value;
            if (!agentId) return;
            setBusy(true);
            setError(null);
            try {
              await call(`/api/agents/${agentId}/runs`, "POST", { ticketId });
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="">Hand to an agent…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.live ? "" : " (draft)"}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="absolute top-full right-0 mt-1 w-56 text-right text-[12px] text-danger">{error}</p>}
    </div>
  );
}

export function ResolveToggle({ ticketId, resolved }: { ticketId: string; resolved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await call(`/api/tickets/${ticketId}`, "PATCH", { status: resolved ? "open" : "resolved" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors disabled:opacity-60",
        resolved ? "bg-card hover:bg-muted/60" : "border-foreground bg-foreground text-white hover:bg-foreground/85",
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : resolved ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
      {resolved ? "Reopen" : "Resolve"}
    </button>
  );
}

/** Reply box: sends an email to the customer from the signed-in person (sandbox outbox). */
export function ReplyComposer({ ticketId, to, ownerName }: { ticketId: string; to: string; ownerName: string }) {
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [resolve, setResolve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await call(`/api/tickets/${ticketId}/reply`, "POST", { body: text.trim(), resolve });
      setText("");
      setResolve(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="border-t px-4 pt-3 pb-4 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border bg-white py-2 pr-2 pl-4 shadow-[0_6px_24px_-12px_rgba(16,24,40,0.18)] focus-within:border-foreground/30">
        <textarea
          ref={box}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type your reply…"
          aria-label={`Reply to ${to}`}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send reply"
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-foreground text-white transition-opacity disabled:cursor-default disabled:opacity-25"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-muted-foreground">
        <span>
          Emails {to} as {ownerName}. Enter sends, Shift+Enter adds a line.
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 font-medium text-foreground/80">
          <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="size-3.5 accent-foreground" />
          Resolve after sending
        </label>
      </div>
      {error && <p className="mt-1 px-1 text-[12px] text-danger">{error}</p>}
    </form>
  );
}

/** Keeps a conversation pinned to its newest message when the ticket or its message count changes. */
export function ThreadScroll({ watch, className, children }: { watch: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [watch]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
