"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Hand, Inbox, LayoutDashboard, LayoutTemplate, ScrollText, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents/new", label: "New agent", icon: Sparkles },
  { href: "/agents", label: "Agents", icon: Bot, exact: true },
  { href: "/approvals", label: "Approvals", icon: Hand, badge: "approvals" },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/activity", label: "Activity log", icon: ScrollText },
  { href: "/onboarding", label: "Workspace", icon: Settings2 },
] as const;

export function Nav({ pendingApprovals }: { pendingApprovals: number }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map((item) => {
        const active =
          "exact" in item && item.exact
            ? path === item.href || (path.startsWith("/agents/") && !path.startsWith("/agents/new"))
            : path === item.href || path.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-card text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(16,24,40,0.05)]",
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground/80")} />
            <span className="flex-1">{item.label}</span>
            {"badge" in item && pendingApprovals > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white tabular-nums">
                {pendingApprovals}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
