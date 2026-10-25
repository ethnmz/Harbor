"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { MASCOTS, type MascotKind } from "@/lib/mascots";
import { cn } from "@/lib/utils";

// three.js only loads on pages that actually show a mascot.
const MascotScene = dynamic(() => import("./scene"), { ssr: false });

let webglCache: boolean | null = null;
function hasWebGL() {
  if (webglCache === null) {
    try {
      const c = document.createElement("canvas");
      webglCache = Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}
const noSubscribe = () => () => {};
const onServer = () => false;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One or more of Harbor's glass mascots, live in 3D. A CSS stand-in shows while three.js loads
 * and on devices without WebGL; rendering pauses while the mascot is off screen.
 */
export function Mascot({
  kinds,
  width,
  height,
  cue = 0,
  interactive = false,
  backdrop,
  celebrate,
  className,
  label,
}: {
  kinds: MascotKind[];
  width: number;
  height: number;
  cue?: number;
  interactive?: boolean;
  backdrop?: boolean;
  celebrate?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, onServer);
  const still = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, onServer);
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label ?? kinds.map((k) => MASCOTS[k].name).join(", ")}
      className={cn("relative shrink-0", className)}
      style={{ width, height }}
    >
      {!ready && <MascotFallback kinds={kinds} width={width} height={height} still={still} />}
      {webgl && seen && (
        <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
          <MascotScene
            kinds={kinds}
            cue={cue}
            interactive={interactive}
            backdrop={backdrop ?? false}
            quality={Math.min(width / kinds.length, height) < 220 ? "low" : "high"}
            paused={!visible}
            still={still}
            celebrate={celebrate}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}

const SHAPES: Record<MascotKind, string> = {
  orbit: "rounded-[50%] aspect-[1.1/0.92]",
  facet: "aspect-[0.8/1] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]",
  murmur: "rounded-[30%] aspect-[1.45/1]",
};

/** Flat glass stand-in with the same face: ink eyes and glowing cheeks. */
export function MascotFallback({ kinds, width, height, still }: { kinds: MascotKind[]; width: number; height: number; still?: boolean }) {
  const body = Math.min(height * 0.55, (width / kinds.length) * 0.62);
  return (
    <div className="absolute inset-0 flex items-center justify-evenly">
      {kinds.map((k, i) => {
        const { color } = MASCOTS[k];
        return (
          <div
            key={k}
            className={cn("relative flex items-center justify-center", SHAPES[k], !still && "animate-bob")}
            style={{
              width: body,
              animationDelay: `${i * 0.4}s`,
              background: `radial-gradient(120% 90% at 30% 18%, rgba(255,255,255,0.95), rgba(255,255,255,0) 46%), linear-gradient(160deg, ${color}26, ${color}55)`,
              boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.85), inset 0 -12px 26px ${color}40, 0 18px 32px -14px ${color}88`,
            }}
          >
            <div className="flex flex-col items-center" style={{ gap: body * 0.06 }}>
              <div className="flex" style={{ gap: body * 0.14 }}>
                {[0, 1].map((e) => (
                  <span key={e} className="rounded-full bg-[#151515]" style={{ width: body * 0.075, height: body * 0.15 }} />
                ))}
              </div>
              <div className="flex" style={{ gap: body * 0.4 }}>
                {[0, 1].map((e) => (
                  <span key={e} className="rounded-full blur-[1px]" style={{ width: body * 0.11, height: body * 0.06, background: color }} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
