"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Hand, House, Inbox, Plus, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ElementType; plus?: string; badge?: boolean; match?: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Home", icon: House },
  {
    href: "/agents",
    label: "Agents",
    icon: Bot,
    plus: "/agents/new",
    match: (p) => p === "/agents" || p.startsWith("/agents/") || p.startsWith("/runs/"),
  },
  { href: "/approvals", label: "Approvals", icon: Hand, badge: true },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/activity", label: "Activity", icon: ScrollText },
];

export function Nav({ pendingApprovals }: { pendingApprovals: number }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-2">
      {ITEMS.map((item) => {
        const active = item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <div key={item.href} className="flex items-center">
            <Link
              href={item.href}
              className={cn(
                "flex h-11 flex-1 items-center gap-3.5 rounded-xl px-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground",
                active && "font-medium text-foreground",
              )}
            >
              <Icon className={cn("size-[19px]", active ? "text-foreground" : "text-muted-foreground/80")} strokeWidth={active ? 2.1 : 1.8} />
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingApprovals > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-semibold text-white tabular-nums">
                  {pendingApprovals}
                </span>
              )}
            </Link>
            {item.plus && (
              <Link
                href={item.plus}
                aria-label="New agent"
                title="New agent"
                className={cn(
                  "ml-1 flex size-7 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-tile-hover",
                  path === item.plus && "bg-foreground text-white hover:bg-foreground/85",
                )}
              >
                <Plus className="size-3.5" strokeWidth={2.4} />
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
