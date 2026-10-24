"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCopy, Copy, Inbox, Loader2, Pause, Pencil, Play, Rocket, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Input, Label, Select, Textarea } from "@/components/ui/primitives";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export function AgentActions({
  agentId,
  agentName,
  status,
  published,
  tickets,
  openInbox,
}: {
  agentId: string;
  agentName: string;
  status: string;
  published: boolean;
  tickets: { id: string; subject: string }[];
  openInbox: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [ticket, setTicket] = useState(tickets[0]?.id ?? "");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "live" ? (
          <Button variant="outline" disabled={!!busy} onClick={() => run("status", async () => (await post(`/api/agents/${agentId}/deploy`, { status: "paused" }), router.refresh()))}>
            {busy === "status" ? <Loader2 className="animate-spin" /> : <Pause />} Pause
          </Button>
        ) : (
          <Button disabled={!!busy} onClick={() => run("status", async () => (await post(`/api/agents/${agentId}/deploy`, { status: "live" }), router.refresh()))}>
            {busy === "status" ? <Loader2 className="animate-spin" /> : <Rocket />} Deploy
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/agents/new?draft=${agentId}`}>
            <Pencil /> Edit &amp; re-test
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setCloneOpen(true)}>
          <Copy /> Clone
        </Button>
        <Button
          variant="ghost"
          disabled={!!busy || published}
          onClick={() =>
            run("publish", async () => {
              await post(`/api/agents/${agentId}/publish`);
              setMsg("Published to the template gallery.");
              router.refresh();
            })
          }
        >
          <BookCopy /> {published ? "In template gallery" : "Save as template"}
        </Button>
      </div>

      <Card className="flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-60 flex-1 space-y-1">
          <Label htmlFor="ticket" className="text-xs text-muted-foreground">
            Run on a single ticket
          </Label>
          <Select id="ticket" value={ticket} onChange={(e) => setTicket(e.target.value)}>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.subject}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="secondary"
          disabled={!!busy || !ticket}
          onClick={() =>
            run("ticket", async () => {
              const r = await post<{ runIds: string[] }>(`/api/agents/${agentId}/runs`, { ticketId: ticket });
              router.push(`/runs/${r.runIds[0]}`);
            })
          }
        >
          {busy === "ticket" ? <Loader2 className="animate-spin" /> : <Play />} Run
        </Button>
        {status === "live" && (
          <Button
            variant="secondary"
            disabled={!!busy || !openInbox}
            onClick={() =>
              run("inbox", async () => {
                const r = await post<{ runIds: string[] }>(`/api/agents/${agentId}/runs`, { inbox: true });
                setMsg(`${agentName} picked up ${r.runIds.length} new tickets from the inbox.`);
                setTimeout(() => router.refresh(), 1500);
              })
            }
          >
            {busy === "inbox" ? <Loader2 className="animate-spin" /> : <Inbox />} Work the inbox ({openInbox} open)
          </Button>
        )}
      </Card>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      {cloneOpen && <CloneDialog agentId={agentId} agentName={agentName} onClose={() => setCloneOpen(false)} />}
    </div>
  );
}

const CLONE_IDEAS = [
  { name: "Refund Agent", change: "Handle refund requests: verify the charge on the customer's invoices, refund it if it's within policy, and email the customer to confirm." },
  { name: "Outage Watcher", change: "Only look for outages: check live news for third-party incidents and alert #support-urgent with evidence." },
];

function CloneDialog({ agentId, agentName, onClose }: { agentId: string; agentName: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(CLONE_IDEAS[0].name);
  const [change, setChange] = useState(CLONE_IDEAS[0].change);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <Card className="w-full max-w-lg p-5 shadow-2xl animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Clone {agentName}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Keeps the workspace setup, model and guardrails. Tell Harbor what&apos;s different.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="clone-name">New agent name</Label>
            <Input id="clone-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="clone-change">What should it do differently?</Label>
            <Textarea id="clone-change" value={change} onChange={(e) => setChange(e.target.value)} className="min-h-24" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CLONE_IDEAS.map((i) => (
              <button
                key={i.name}
                type="button"
                onClick={() => {
                  setName(i.name);
                  setChange(i.change);
                }}
                className="cursor-pointer rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary"
              >
                {i.name}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await post<{ agentId: string }>(`/api/agents/${agentId}/clone`, { name, change });
                router.push(`/agents/new?draft=${r.agentId}`);
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {busy ? "Adapting…" : "Clone agent"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
