"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type Bucket = { bucket: string; total: number; handled: number; flagged: number; failed: number };

const SERIES = [
  { key: "handled", label: "Handled", color: "var(--success)", Icon: CheckCircle2 },
  { key: "flagged", label: "Flagged / needs approval", color: "var(--warning)", Icon: AlertTriangle },
  { key: "failed", label: "Failed", color: "var(--danger)", Icon: XCircle },
] as const;

const BUCKET_MS = 15 * 60_000;
const COUNT = 24; // last 6 hours

function fill(rows: Bucket[]) {
  const end = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  return Array.from({ length: COUNT }, (_, i) => {
    const t = end - (COUNT - 1 - i) * BUCKET_MS;
    const hit = rows.find((r) => Math.abs(new Date(r.bucket).getTime() - t) < 1000);
    return { t, handled: hit?.handled ?? 0, flagged: hit?.flagged ?? 0, failed: hit?.failed ?? 0, total: hit?.total ?? 0 };
  });
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function RunsChart({ rows, engine }: { rows: Bucket[]; engine: string }) {
  // Buckets depend on the viewer's clock and locale, so render on the client only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [hover, setHover] = useState<number | null>(null);
  if (!mounted) return <div className="shimmer h-[200px] rounded-md" />;
  const data = fill(rows);
  const max = Math.max(4, ...data.map((d) => d.handled + d.flagged + d.failed));
  const niceMax = max <= 4 ? 4 : max <= 10 ? 10 : Math.ceil(max / 10) * 10;
  const H = 160;
  const scale = (n: number) => (n / niceMax) * H;
  const ticks = [0, niceMax / 2, niceMax];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            <s.Icon className="size-3" />
            {s.label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[11px]">bucketed with {engine}</span>
      </div>
      <div className="relative flex gap-2">
        <div className="flex w-6 flex-col justify-between text-right text-[10px] text-muted-foreground tabular-nums" style={{ height: H }}>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: H }}>
            {ticks.map((t) => (
              <div key={t} className="h-px bg-border/70" />
            ))}
          </div>
          <div className="relative flex items-end justify-between" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => {
              const segs = SERIES.map((s) => ({ ...s, n: d[s.key] })).filter((s) => s.n > 0);
              return (
                <div key={d.t} className="flex h-full flex-1 cursor-default items-end justify-center" onMouseEnter={() => setHover(i)}>
                  <div className="flex w-full max-w-[18px] flex-col-reverse gap-[2px]">
                    {segs.map((s, j) => (
                      <div
                        key={s.key}
                        style={{ height: Math.max(3, scale(s.n) - 2), background: s.color, opacity: hover === null || hover === i ? 1 : 0.45 }}
                        className={j === segs.length - 1 ? "rounded-t-[4px] transition-opacity" : "transition-opacity"}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border bg-card px-2.5 py-2 text-xs shadow-lg"
              style={{ left: `${((hover + 0.5) / COUNT) * 100}%`, bottom: H + 8 - Math.min(H, scale(data[hover].total)) - 8 }}
            >
              <div className="mb-1 font-medium">
                {fmtTime(data[hover].t)}–{fmtTime(data[hover].t + BUCKET_MS)}
              </div>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                  <span className="ml-auto pl-3 font-medium tabular-nums">{data[hover][s.key]}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{fmtTime(data[0].t)}</span>
            <span>{fmtTime(data[Math.floor(COUNT / 2)].t)}</span>
            <span>now</span>
          </div>
        </div>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left">
              <th className="py-1 font-medium">From</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data
              .filter((d) => d.total)
              .map((d) => (
                <tr key={d.t} className="border-t">
                  <td className="py-1">{fmtTime(d.t)}</td>
                  <td className="text-right">{d.handled}</td>
                  <td className="text-right">{d.flagged}</td>
                  <td className="text-right">{d.failed}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
