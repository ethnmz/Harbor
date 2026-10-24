import { cn } from "@/lib/utils";

/**
 * Every agent gets a gradient identity, derived deterministically from a seed (its
 * name), so the same agent looks the same on every screen.
 */
const PALETTES: [string, string, string][] = [
  ["#ff5f6d", "#ffc371", "#d9304f"], // coral
  ["#3a7bd5", "#6ee2f5", "#2b4c9b"], // ocean
  ["#f7971e", "#ffd86f", "#e65c2b"], // tangerine
  ["#7f5af0", "#d4a5ff", "#4338ca"], // violet
  ["#11998e", "#6ef0a6", "#0b6157"], // jade
  ["#c98b6b", "#f1c8a6", "#8a5a44"], // sand
  ["#ee6c8a", "#ffd1dc", "#b8325a"], // rose
  ["#00a6d6", "#8ef0e0", "#00708f"], // lagoon
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Final avalanche so similar names land on different palettes.
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function orbColors(seed: string) {
  const h = hash(seed.trim().toLowerCase());
  return { colors: PALETTES[h % PALETTES.length], angle: (h >>> 8) % 360 };
}

function gradient([a, b, c]: [string, string, string], angle: number) {
  return [
    "radial-gradient(120% 120% at 22% 18%, rgba(255,255,255,0.55), transparent 42%)",
    `radial-gradient(90% 90% at 82% 86%, ${c} 0%, transparent 62%)`,
    `linear-gradient(${angle}deg, ${a}, ${b})`,
  ].join(", ");
}

export function orbBackground(seed: string) {
  const { colors, angle } = orbColors(seed);
  return gradient(colors, angle);
}

export function AgentOrb({
  seed,
  size = 18,
  shape = "dot",
  live,
  className,
}: {
  seed: string;
  size?: number;
  shape?: "dot" | "tile";
  live?: boolean;
  className?: string;
}) {
  const radius = shape === "dot" ? "9999px" : `${Math.round(size * 0.28)}px`;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      {live && <span className="absolute inset-0 animate-sonar bg-success/40" style={{ borderRadius: radius }} />}
      <span
        className="relative block size-full"
        style={{
          borderRadius: radius,
          background: orbBackground(seed),
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.14)",
        }}
      />
    </span>
  );
}

/** Floating, tilted gradient cubes for dark hero bands. Decorative only. */
const FIELD = [
  { x: 6, y: 10, s: 40, r: -18, d: 0, p: 0 },
  { x: 13, y: 38, s: 30, r: 14, d: -2, dim: true },
  { x: 4, y: 62, s: 26, r: -8, d: -5, dim: true },
  { x: 15, y: 80, s: 36, r: 22, d: -3, p: 5 },
  { x: 24, y: 18, s: 18, r: 10, d: -6, dim: true },
  { x: 86, y: 12, s: 38, r: 16, d: -1, p: 5 },
  { x: 92, y: 36, s: 28, r: -20, d: -4, dim: true },
  { x: 84, y: 58, s: 22, r: 6, d: -7, dim: true },
  { x: 90, y: 78, s: 40, r: -12, d: -2, p: 3 },
  { x: 76, y: 88, s: 18, r: 18, d: -5, p: 2 },
  { x: 30, y: 86, s: 16, r: -14, d: -8, p: 1 },
];

export function OrbField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FIELD.map((c, k) => (
        <span
          key={k}
          className="absolute animate-float"
          style={
            {
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: c.s,
              height: c.s,
              borderRadius: Math.round(c.s * 0.18),
              background: c.dim ? "linear-gradient(140deg, #3a3a3f, #232326 70%)" : gradient(PALETTES[c.p ?? 0], 120 + k * 23),
              opacity: c.dim ? 0.55 : 0.95,
              boxShadow: c.dim ? "none" : "0 18px 40px -12px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.18)",
              animationDelay: `${c.d}s`,
              "--r": `${c.r}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
