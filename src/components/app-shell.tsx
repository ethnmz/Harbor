import Link from "next/link";
import { AmbientGlow } from "@/components/ambient-glow";
import { HarborMark } from "@/components/harbor-mark";
import { RailNav, RailSettings, TopBar } from "@/components/nav";
import { ResetDemoButton } from "@/components/reset-demo";
import type { Workspace } from "@/lib/db/schema";
import { pendingApprovalCount } from "@/lib/queries";

export async function AppShell({ ws, children }: { ws: Workspace; children: React.ReactNode }) {
  const pending = await pendingApprovalCount();
  return (
    <div className="flex min-h-screen">
      <AmbientGlow />
      {/* The rail's background spans the whole page; its contents stick to the viewport. */}
      <aside className="glass-dark relative z-40 hidden w-[77px] shrink-0 md:block">
        <div className="sticky top-0 flex h-screen flex-col items-center py-6">
          <Link href="/dashboard" aria-label="Harbor home" className="mb-10">
            <HarborMark onDark />
          </Link>
          <RailNav pendingApprovals={pending} />
          <div className="mt-auto flex flex-col items-center gap-3">
            <ResetDemoButton />
            <RailSettings />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass-dark flex items-center gap-3 overflow-x-auto px-4 py-3 md:hidden">
          <Link href="/dashboard" aria-label="Harbor home" className="mr-1">
            <HarborMark onDark />
          </Link>
          <RailNav pendingApprovals={pending} horizontal />
        </div>
        <main className="w-full min-w-0 flex-1 px-4 pt-6 pb-10 md:px-6 md:pt-7" data-workspace={ws.company}>
          <TopBar ownerName={ws.ownerName} />
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
