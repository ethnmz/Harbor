import { Database, KeyRound, PlugZap } from "lucide-react";
import { HarborMark } from "@/components/harbor-mark";
import type { DbState } from "@/lib/setup";
import { RetryButton, SetupButton } from "./setup-actions";

type Failure = Extract<DbState, { ok: false }>;

const COPY: Record<Failure["reason"], { icon: React.ElementType; title: string; body: string }> = {
  missing_url: {
    icon: KeyRound,
    title: "Connect Harbor to its database",
    body: "This deployment has no DATABASE_URL, so Harbor has nowhere to store agents, runs and the audit log.",
  },
  not_setup: {
    icon: Database,
    title: "Set up the database",
    body: "Harbor reached the database, but its tables don't exist yet. Setup creates them (plus the TimescaleDB extras on Tiger Cloud) and seeds the demo workspace.",
  },
  unreachable: {
    icon: PlugZap,
    title: "Harbor can't reach its database",
    body: "DATABASE_URL is set, but connecting failed. The error below says why.",
  },
};

function host() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
}

/** Shown instead of the app when the database is missing, empty or unreachable. */
export function SetupScreen({ state }: { state: Failure }) {
  const c = COPY[state.reason];
  const Icon = c.icon;
  const h = host();
  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-xl rounded-[32px] bg-card p-8 shadow-[0_40px_90px_-40px_rgba(15,15,20,0.35)] md:p-10">
        <div className="flex items-center gap-2.5">
          <HarborMark className="size-8 rounded-[10px]" />
          <span className="text-[20px] font-semibold tracking-tight">Harbor</span>
        </div>
        <div className="mt-8 flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5" strokeWidth={1.8} />
        </div>
        <h1 className="display mt-4 text-[32px]">{c.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{c.body}</p>

        {state.reason === "missing_url" && (
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed">
            <li>Copy the connection string of your Tiger Cloud service.</li>
            <li>
              In Vercel: Project → Settings → Environment Variables, add <code className="rounded bg-muted px-1.5 font-mono text-[13px]">DATABASE_URL</code> and tick{" "}
              <b>Production</b> and <b>Preview</b>. Branch deployments only see Preview variables.
            </li>
            <li>Redeploy, then come back here and press Set up database.</li>
          </ol>
        )}

        {state.reason === "not_setup" && (
          <div className="mt-6">
            {h && <p className="mb-4 text-[13px] text-muted-foreground">Connected to {h}</p>}
            <SetupButton />
          </div>
        )}

        {state.reason === "unreachable" && (
          <div className="mt-6 space-y-4">
            <pre className="overflow-x-auto rounded-xl bg-[#141414] px-4 py-3 font-mono text-[12px] leading-5 whitespace-pre-wrap text-[#e5e7eb]">
              {h ? `${h}\n` : ""}
              {state.message}
            </pre>
            <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-muted-foreground">
              <li>Check the password in the connection string (copy it again from Tiger Cloud).</li>
              <li>Make sure the Tiger service is running and isn&apos;t restricted to an IP allow list.</li>
              <li>After changing DATABASE_URL in Vercel, redeploy so the new value is used.</li>
            </ul>
            <RetryButton />
          </div>
        )}

        <p className="mt-8 border-t pt-4 text-[13px] text-muted-foreground">
          Full diagnostics:{" "}
          <a href="/api/health" className="font-medium text-foreground underline-offset-4 hover:underline">
            /api/health
          </a>
        </p>
      </div>
    </div>
  );
}
