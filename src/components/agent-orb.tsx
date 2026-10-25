import Image from "next/image";
import { MASCOT_KINDS, type MascotKind } from "@/lib/mascots";
import { cn } from "@/lib/utils";

/**
 * Every agent is shown as one of Harbor's six glass mascots, picked deterministically from its
 * name so the same agent looks the same on every screen. Names that hint at the job get the
 * fitting mascot (a shield for refunds, a cloud for outages…); anything else is hashed.
 * The icons are 512px renders of the 3D mascots from the Figma file (public/mascots).
 */
const HINTS: [RegExp, MascotKind][] = [
  [/refund|billing|payment|invoice|fraud|security|guard/, "sentry"],
  [/outage|incident|status|uptime|monitor|watch/, "nimbus"],
  [/triage|route|sort|queue|prioriti/, "orbit"],
  [/writ|draft|reply|email|respond|summar/, "murmur"],
  [/idea|content|brainstorm|insight/, "lumen"],
  [/workflow|sync|automat|integrat/, "facet"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Final avalanche so similar names land on different mascots.
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

export function mascotFor(seed: string): MascotKind {
  const s = seed.trim().toLowerCase();
  return HINTS.find(([re]) => re.test(s))?.[1] ?? MASCOT_KINDS[hash(s) % MASCOT_KINDS.length];
}

/** An agent's icon: its mascot on its tinted tile. `live` adds a soft pulse. */
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
  const radius = `${Math.round(size * (shape === "dot" ? 0.32 : 0.26))}px`;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      {/* The pulse suits small icons; larger tiles always sit next to a Live badge. */}
      {live && size < 32 && <span className="absolute inset-0 animate-sonar bg-success/40" style={{ borderRadius: radius }} />}
      <Image
        // Small sizes use a tight crop so the mascot fills the tile instead of its tint.
        src={`/mascots/${mascotFor(seed)}${size < 48 ? "-sm" : ""}.webp`}
        alt=""
        width={size}
        height={size}
        unoptimized
        draggable={false}
        className="relative size-full object-cover"
        style={{ borderRadius: radius, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.12)" }}
      />
    </span>
  );
}
