"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Row = { bucket: string; handled: number; human: number };

const SERIES = [
  { key: "handled", label: "Handled by agents", color: "var(--series-1)" },
  { key: "human", label: "Sent to a human", color: "var(--series-2)" },
] as const;

const H = 230;
const PAD = { left: 34, right: 8, top: 12, bottom: 30 };

/** Monotone cubic (Fritsch–Carlson): smooth, never overshoots below zero. */
function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    d += ` C${x0 + dx[i] / 3},${y0 + (t[i] * dx[i]) / 3} ${x1 - dx[i] / 3},${y1 - (t[i + 1] * dx[i]) / 3} ${x1},${y1}`;
  }
  return d;
}

const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function PerformanceChart({ rows, hours, minutes, engine }: { rows: Row[]; hours: number; minutes: number; engine: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Buckets depend on the viewer's clock, so they are computed client-side only.
  const data = useMemo(() => {
    if (!width) return [];
    const size = minutes * 60_000;
    const count = Math.round((hours * 60) / minutes);
    const end = Math.floor(Date.now() / size) * size;
    return Array.from({ length: count }, (_, i) => {
      const t = end - (count - 1 - i) * size;
      const hit = rows.find((r) => Math.abs(new Date(r.bucket).getTime() - t) < 1000);
      return { t, handled: hit?.handled ?? 0, human: hit?.human ?? 0 };
    });
  }, [rows, hours, minutes, width]);

  const max = Math.max(4, ...data.map((d) => Math.max(d.handled, d.human)));
  const top = max <= 4 ? 4 : max <= 8 ? 8 : max <= 12 ? 12 : Math.ceil(max / 10) * 10;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : 0);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top];
  const paths = SERIES.map((s) => monotonePath(data.map((d, i) => [x(i), y(d[s.key])])));
  const area = paths[0] && `${paths[0]} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2">
            <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="sr-only">Bucketed with {engine}</span>
      </div>
      <div ref={ref} className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {width > 0 && data.length > 0 && (
          <>
            <svg width={width} height={H} className="overflow-visible">
              <defs>
                <linearGradient id="perf-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} opacity={t === 0 ? 1 : 0.6} />
                  <text x={0} y={y(t) + 4} className="fill-muted-foreground text-[12px] tabular-nums">
                    {t % 1 ? t.toFixed(1) : t}
                  </text>
                </g>
              ))}
              {area && <path d={area} fill="url(#perf-area)" />}
              {paths.map((d, i) => (
                <path key={i} d={d} fill="none" stroke={SERIES[i].color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {hover !== null && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeWidth={1} />
                  {SERIES.map((s) => (
                    <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r={4.5} fill={s.color} stroke="white" strokeWidth={2} />
                  ))}
                </>
              )}
              {data.map((d, i) =>
                i % labelEvery === 0 || i === data.length - 1 ? (
                  <g key={d.t}>
                    {hover === i && <rect x={x(i) - 30} y={H - 22} width={60} height={20} rx={10} fill="var(--muted)" />}
                    <text x={x(i)} y={H - 8} textAnchor="middle" className={hover === i ? "fill-foreground text-[12px]" : "fill-muted-foreground text-[12px]"}>
                      {i === data.length - 1 ? "now" : fmt(d.t)}
                    </text>
                  </g>
                ) : null,
              )}
              {/* Hit targets wider than the marks. */}
              {data.map((d, i) => (
                <rect key={`hit-${d.t}`} x={x(i) - plotW / data.length / 2} y={0} width={plotW / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
              ))}
            </svg>
            {hover !== null && (
              <div
                className="pointer-events-none absolute z-10 min-w-44 rounded-xl bg-[#141414] px-4 py-3 text-[13px] text-white shadow-xl"
                style={{
                  left: Math.min(Math.max(x(hover) + 14, 0), width - 190),
                  top: Math.max(0, Math.min(y(data[hover].handled), y(data[hover].human)) - 70),
                }}
              >
                <div className="mb-2 font-medium">
                  {fmt(data[hover].t)} to {fmt(data[hover].t + minutes * 60_000)}
                </div>
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center gap-2.5 py-0.5 text-white/75">
                    <span className="h-3.5 w-[3px] rounded-full" style={{ background: s.color }} />
                    {s.label}
                    <span className="ml-auto pl-4 font-medium text-white tabular-nums">{data[hover][s.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!width && <div className="shimmer h-full rounded-xl" />}
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
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
              .filter((d) => d.handled || d.human)
              .map((d) => (
                <tr key={d.t} className="border-t">
                  <td className="py-1">{fmt(d.t)}</td>
                  <td className="text-right">{d.handled}</td>
                  <td className="text-right">{d.human}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
