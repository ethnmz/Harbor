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
      {/* A floating liquid-glass rail that sticks to the viewport. */}
      <aside className="relative z-40 hidden w-[96px] shrink-0 md:block">
        <div className="glass-rail sticky top-3 m-3 flex h-[calc(100vh-24px)] flex-col items-center rounded-[28px] py-5">
          <Link href="/dashboard" aria-label="Harbor home" className="mb-8">
            <HarborMark large />
          </Link>
          <RailNav pendingApprovals={pending} />
          <div className="mt-auto flex flex-col items-center gap-3">
            <ResetDemoButton />
            <RailSettings />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass-rail sticky top-0 z-40 flex items-center gap-3 overflow-x-auto border-x-0 border-t-0 px-4 py-3 md:hidden">
          <Link href="/dashboard" aria-label="Harbor home" className="mr-1">
            <HarborMark large />
          </Link>
          <RailNav pendingApprovals={pending} horizontal />
        </div>
        <main className="w-full min-w-0 flex-1 px-4 pt-6 pb-10 md:pr-6 md:pl-3 md:pt-7" data-workspace={ws.company}>
          <TopBar ownerName={ws.ownerName} />
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
