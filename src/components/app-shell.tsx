import Link from "next/link";
import { Settings2 } from "lucide-react";
import { HarborMark } from "@/components/harbor-mark";
import { Nav } from "@/components/nav";
import { ResetDemoButton } from "@/components/reset-demo";
import type { Workspace } from "@/lib/db/schema";
import { integrationStatus, pendingApprovalCount } from "@/lib/queries";

/** Promo-style card in the sidebar: how close the workspace is to fully live. */
function GoLiveCard() {
  const s = integrationStatus();
  const simulated = [!s.llm.live && "the model", !s.serpapi.live && "SerpApi", !s.slack.live && "Slack"].filter(Boolean) as string[];
  const allLive = simulated.length === 0;
  return (
    <div className="rounded-[22px] bg-muted/70 px-5 py-6 text-center">
      <div className="text-[15px] font-semibold tracking-tight">{allLive ? "All systems live" : "Go live"}</div>
      <p className="mx-auto mt-2 max-w-44 text-[13px] leading-relaxed text-muted-foreground">
        {allLive
          ? `Every run is logged to ${s.db.label === "Tiger Cloud" ? "Tiger Postgres" : "Postgres"}.`
          : `${simulated
              .join(", ")
              .replace(/, ([^,]*)$/, " and $1")
              .replace(/^\w/, (c) => c.toUpperCase())} ${simulated.length === 1 ? "is" : "are"} simulated. Add keys to go live.`}
      </p>
      <Link
        href={allLive ? "/activity" : "/onboarding"}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-soft-blue-strong px-7 text-sm font-medium text-[#1d3b63] transition-colors hover:bg-[#bfd6f3]"
      >
        {allLive ? "View activity" : "Connect"}
      </Link>
    </div>
  );
}

export async function AppShell({ ws, children }: { ws: Workspace; children: React.ReactNode }) {
  const pending = await pendingApprovalCount();
  return (
    <div className="flex min-h-screen bg-card">
      <aside className="hidden w-[264px] shrink-0 flex-col border-r px-6 pt-10 pb-8 md:sticky md:top-0 md:flex md:h-screen md:self-start">
        <Link href="/dashboard" className="mb-12 flex items-center gap-2.5 px-3">
          <HarborMark className="size-8 rounded-[10px]" />
          <span className="text-[22px] font-semibold tracking-tight">Harbor</span>
        </Link>
        <Nav pendingApprovals={pending} />
        <div className="mt-auto space-y-6">
          <GoLiveCard />
          <div className="space-y-1">
            <Link href="/onboarding" className="flex h-10 items-center gap-3.5 rounded-xl px-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground">
              <Settings2 className="size-[19px]" strokeWidth={1.8} /> Workspace
            </Link>
            <ResetDemoButton />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-3 md:hidden">
          <HarborMark />
          <span className="font-semibold">Harbor</span>
          <nav className="ml-auto flex gap-3 text-sm text-muted-foreground">
            <Link href="/dashboard">Home</Link>
            <Link href="/agents">Agents</Link>
            <Link href="/approvals">Approvals{pending ? ` (${pending})` : ""}</Link>
          </nav>
        </header>
        <main className="w-full min-w-0 flex-1 px-5 py-8 md:px-12 md:py-11" data-workspace={ws.company}>
          {children}
        </main>
      </div>
    </div>
  );
}
