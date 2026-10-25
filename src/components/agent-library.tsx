"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Search } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { CATEGORIES, type AgentCategory } from "@/lib/agent-meta";
import { cn } from "@/lib/utils";

export type LibraryItem = {
  kind: "agent" | "template";
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  tags: string[];
  approvals: number;
  status?: string;
  runs?: number;
  handledPct?: number;
  source?: "starter" | "team";
};

type View = "all" | "agents" | "templates";

export function AgentLibrary({ items, initialView = "all", initialQuery = "" }: { items: LibraryItem[]; initialView?: View; initialQuery?: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [category, setCategory] = useState<AgentCategory | "All">("All");
  const [query, setQuery] = useState(initialQuery);
  const [opening, setOpening] = useState<string | null>(null);

  const counts = {
    all: items.length,
    agents: items.filter((i) => i.kind === "agent").length,
    templates: items.filter((i) => i.kind === "template").length,
  };
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (view === "all" || (view === "agents" ? i.kind === "agent" : i.kind === "template")) &&
        (category === "All" || i.category === category) &&
        (!q || `${i.name} ${i.description} ${i.tags.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [items, view, category, query]);

  async function startFromTemplate(id: string) {
    setOpening(id);
    const res = await fetch(`/api/templates/${id}/use`, { method: "POST" });
    const data = await res.json();
    if (res.ok) router.push(`/agents/new?draft=${data.agentId}`);
    else setOpening(null);
  }

  return (
    <div className="grid gap-8 md:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="space-y-7 md:sticky md:top-6 md:self-start">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter"
            aria-label="Filter agents and templates"
            className="h-11 w-full rounded-xl border border-input bg-muted pr-3 pl-10 text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/80 focus:border-foreground/35 focus:bg-card"
          />
        </div>
        <FilterGroup
          label="Library"
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: "all", label: "All", n: counts.all },
            { value: "agents", label: "Your agents", n: counts.agents },
            { value: "templates", label: "Templates", n: counts.templates },
          ]}
        />
        <FilterGroup
          label="Category"
          value={category}
          onChange={(v) => setCategory(v as AgentCategory | "All")}
          options={[{ value: "All", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c, n: items.filter((i) => i.category === c).length }))]}
        />
      </aside>

      <div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {view !== "templates" && category === "All" && !query && (
            <Link
              href="/agents/new"
              className="group flex min-h-52 flex-col justify-between rounded-2xl border-2 border-dashed border-input p-5 transition-colors hover:border-foreground/30 hover:bg-muted/60"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-white">
                <Plus className="size-[18px]" strokeWidth={2.4} />
              </span>
              <div>
                <div className="text-[16px] font-semibold">Describe a new agent</div>
                <p className="mt-1 text-[14px] text-muted-foreground">One sentence in, a tested agent with your company&apos;s guardrails out.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold">
                  Start <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )}
          {visible.map((item) => {
            const body = <Tile item={item} busy={opening === item.id} />;
            return item.kind === "agent" ? (
              <Link key={item.id} href={`/agents/${item.id}`} className="group block">
                {body}
              </Link>
            ) : (
              <button key={item.id} type="button" onClick={() => startFromTemplate(item.id)} disabled={!!opening} className="group block cursor-pointer text-left">
                {body}
              </button>
            );
          })}
        </div>
        {!visible.length && <p className="py-16 text-center text-[14px] text-muted-foreground">No agents match. Try another filter, or describe a new one.</p>}
      </div>
    </div>
  );
}

function Tile({ item, busy }: { item: LibraryItem; busy: boolean }) {
  return (
    <div className="flex h-full min-h-52 flex-col rounded-2xl bg-muted p-5 transition-colors group-hover:bg-tile-hover">
      <div className="flex items-center gap-3">
        <AgentOrb seed={item.name} size={40} shape="tile" live={item.status === "live"} />
        <h3 className="flex-1 text-[16px] leading-snug font-semibold">{item.name}</h3>
        {item.kind === "agent" && (
          <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", item.status === "live" ? "bg-success-soft text-success" : "bg-card text-muted-foreground")}>
            {item.status === "live" ? "Live" : item.status === "paused" ? "Paused" : "Draft"}
          </span>
        )}
      </div>
      <p className="mt-4 line-clamp-3 flex-1 text-[14px] leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        <span className="text-foreground/80">{item.category}</span>
        {item.tags.map((t) => (
          <span key={t}>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-[13px] text-muted-foreground">
        {item.kind === "agent" ? (
          <span>{item.runs ? `${item.runs} ${item.runs === 1 ? "run" : "runs"} · ${item.handledPct}% handled` : "Not run yet"}</span>
        ) : (
          <span>{item.source === "team" ? "From your team" : "Starter template"}</span>
        )}
        <span className="flex items-center gap-1 font-semibold text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {item.kind === "agent" ? "Open" : "Use template"} <ArrowRight className="size-3.5" />
        </span>
      </div>
      {item.approvals > 0 && <span className="sr-only">{item.approvals} actions need approval</span>}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; n?: number }[];
}) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">{label}</div>
      <ul className="space-y-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => onChange(o.value)}
                className={cn(
                  "flex h-9 w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 text-left text-[14px] transition-colors",
                  active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="flex-1">{o.label}</span>
                {o.n !== undefined && <span className="text-[13px] text-muted-foreground tabular-nums">{o.n}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
