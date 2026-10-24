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

export function AgentLibrary({ items, initialView = "all" }: { items: LibraryItem[]; initialView?: View }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [category, setCategory] = useState<AgentCategory | "All">("All");
  const [query, setQuery] = useState("");
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
    <div className="grid gap-8 md:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="space-y-6 md:sticky md:top-6 md:self-start">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents"
            className="h-9 w-full rounded-full bg-tile pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground/70 focus:bg-tile-hover"
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {view !== "templates" && category === "All" && !query && (
            <Link
              href="/agents/new"
              className="group flex min-h-48 flex-col justify-between rounded-2xl border border-dashed border-input p-5 transition-colors hover:border-foreground/30 hover:bg-tile/60"
            >
              <span className="flex size-[18px] items-center justify-center rounded-full bg-foreground text-white">
                <Plus className="size-3" />
              </span>
              <div>
                <div className="text-[15px] font-medium">Describe a new agent</div>
                <p className="mt-1 text-[13px] text-muted-foreground">One sentence in, a tested agent with your company&apos;s guardrails out.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium">
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
        {!visible.length && <p className="py-16 text-center text-sm text-muted-foreground">No agents match. Try another filter, or describe a new one.</p>}
      </div>
    </div>
  );
}

function Tile({ item, busy }: { item: LibraryItem; busy: boolean }) {
  return (
    <div className="flex h-full min-h-48 flex-col rounded-2xl bg-tile p-5 transition-colors group-hover:bg-tile-hover">
      <div className="flex items-start gap-2.5">
        <AgentOrb seed={item.name} size={18} live={item.status === "live"} className="mt-0.5" />
        <h3 className="flex-1 text-[15px] leading-snug font-medium">{item.name}</h3>
        {item.kind === "agent" && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", item.status === "live" ? "bg-success-soft text-success" : "bg-card text-muted-foreground")}>
            {item.status === "live" ? "Live" : item.status === "paused" ? "Paused" : "Draft"}
          </span>
        )}
      </div>
      <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        <span className="text-foreground/80">{item.category}</span>
        {item.tags.map((t) => (
          <span key={t}>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-[12px] text-muted-foreground">
        {item.kind === "agent" ? (
          <span>{item.runs ? `${item.runs} runs · ${item.handledPct}% handled` : "Not run yet"}</span>
        ) : (
          <span>{item.source === "team" ? "From your team" : "Starter template"}</span>
        )}
        <span className="flex items-center gap-1 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
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
      <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">{label}</div>
      <ul className="space-y-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => onChange(o.value)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md py-1 text-left text-[13px] transition-colors",
                  active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full", active ? "bg-foreground" : "bg-transparent")} />
                <span className="flex-1">{o.label}</span>
                {o.n !== undefined && <span className="text-[11px] text-muted-foreground/70 tabular-nums">{o.n}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
