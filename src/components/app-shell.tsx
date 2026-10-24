import Link from "next/link";
import { HarborMark } from "@/components/harbor-mark";
import { Nav } from "@/components/nav";
import { ResetDemoButton } from "@/components/reset-demo";
import { integrationStatus, pendingApprovalCount } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { cn } from "@/lib/utils";

function StatusRow({ label, live, detail }: { label: string; live: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]" title={detail}>
      <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted-foreground/40")} />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("ml-auto", live ? "text-foreground" : "text-muted-foreground")}>{live ? "Live" : "Simulated"}</span>
    </div>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [ws, pending] = await Promise.all([getWorkspace(), pendingApprovalCount()]);
  const s = integrationStatus();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
        <Link href="/dashboard" className="mb-5 flex items-center gap-2.5 px-1.5">
          <HarborMark />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Harbor</div>
            <div className="text-[11px] text-muted-foreground">{ws.company} workspace</div>
          </div>
        </Link>
        <Nav pendingApprovals={pending} />
        <div className="mt-auto space-y-3">
          <div className="space-y-1.5 rounded-lg border bg-card px-3 py-2.5">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Connections</div>
            <StatusRow label="Model" live={s.llm.live} detail={s.llm.label} />
            <StatusRow label="SerpApi" live={s.serpapi.live} detail={s.serpapi.detail} />
            <StatusRow label="Slack" live={s.slack.live} detail={s.slack.detail} />
            <StatusRow label={s.db.label} live detail="Every run, step and approval is stored here" />
          </div>
          <ResetDemoButton />
          <div className="flex items-center gap-2 px-1.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
              {ws.ownerName
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium">{ws.ownerName}</div>
              <div className="truncate text-[11px] text-muted-foreground">Support lead · Admin</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-sidebar px-4 py-3 md:hidden">
          <HarborMark />
          <span className="font-semibold">Harbor</span>
          <nav className="ml-auto flex gap-3 text-sm text-muted-foreground">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/agents/new">New</Link>
            <Link href="/approvals">Approvals{pending ? ` (${pending})` : ""}</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
