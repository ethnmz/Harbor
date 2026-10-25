"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Hand, House, Inbox, Plus, ScrollText, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ElementType; badge?: boolean; match?: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/agents", label: "Agents", icon: Bot, match: (p) => p === "/agents" || p.startsWith("/agents/") || p.startsWith("/runs/") },
  { href: "/approvals", label: "Approvals", icon: Hand, badge: true },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/activity", label: "Activity", icon: ScrollText },
];

const isActive = (item: Item, path: string) => (item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/"));

/** One square icon button on the black rail, with its label as a hover tip. */
export function RailButton({
  href,
  label,
  icon: Icon,
  active,
  count,
  tipBelow,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  count?: number;
  tipBelow?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label} (${count} waiting)` : label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors",
        active ? "bg-rail-active text-white" : "text-rail-icon hover:bg-rail-active/60 hover:text-white",
      )}
    >
      <Icon className="size-[21px]" strokeWidth={active ? 2.2 : 1.8} />
      {!!count && (
        <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-series-3 px-1 text-[11px] font-bold text-rail tabular-nums ring-2 ring-rail">
          {count}
        </span>
      )}
      {!tipBelow && <span className="tip">{label}</span>}
    </Link>
  );
}

export function RailNav({ pendingApprovals, horizontal }: { pendingApprovals: number; horizontal?: boolean }) {
  const path = usePathname();
  return (
    <nav className={cn("flex gap-3", horizontal ? "flex-row" : "flex-col")}>
      {ITEMS.map((item) => (
        <RailButton
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={isActive(item, path)}
          count={item.badge ? pendingApprovals : undefined}
          tipBelow={horizontal}
        />
      ))}
    </nav>
  );
}

export function RailSettings() {
  const path = usePathname();
  return <RailButton href="/onboarding" label="Workspace settings" icon={Settings} active={path.startsWith("/onboarding")} />;
}

function sectionTitle(path: string) {
  if (path === "/agents/new") return "New agent";
  if (path.startsWith("/agents") || path.startsWith("/runs")) return "Agents";
  if (path.startsWith("/onboarding")) return "Workspace";
  return ITEMS.find((i) => isActive(i, path))?.label ?? "Harbor";
}

/** Page header: section title on the left; search, the primary action and the owner's avatar on the right. */
export function TopBar({ ownerName }: { ownerName: string }) {
  const path = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const initials = ownerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <header className="flex items-center gap-3 md:gap-4 md:pl-8">
      <h1 className="display mr-auto truncate text-[28px] md:text-[32px]">{sectionTitle(path)}</h1>
      <form
        role="search"
        className="glass hidden h-12 w-[320px] items-center gap-3 rounded-xl px-4 focus-within:bg-white/80 lg:flex"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/agents?q=${encodeURIComponent(q.trim())}` : "/agents");
        }}
      >
        <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agents"
          aria-label="Search agents and templates"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
      </form>
      <Link
        href="/agents/new"
        className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-primary px-4 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-primary/85 md:px-6"
      >
        <span className="hidden sm:inline">New agent</span>
        <Plus className="size-[18px]" strokeWidth={2.4} />
      </Link>
      <Link
        href="/onboarding"
        title={`${ownerName} · workspace settings`}
        aria-label={`${ownerName}, workspace settings`}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-white bg-[#f1e4d8] text-[14px] font-bold text-[#7a4b2a] shadow-[0_2px_8px_rgba(16,24,40,0.12)]"
      >
        {initials}
      </Link>
    </header>
  );
}
