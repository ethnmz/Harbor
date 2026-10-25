import { Mail, MessageCircle } from "lucide-react";
import { STATE_LABEL, type TicketState } from "@/lib/inbox";
import { cn } from "@/lib/utils";

const AVATAR_TONES = [
  ["#f1e4d8", "#7a4b2a"],
  ["#e3ecfb", "#2f5aa8"],
  ["#e4f4ec", "#23704a"],
  ["#f6e3ef", "#8a2f63"],
  ["#ece7fb", "#5b3fa6"],
  ["#fbefd6", "#875700"],
];

/** Initials on a soft tile; the tone is stable per name. */
export function PersonAvatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR_TONES[h % AVATAR_TONES.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

const DOT: Record<TicketState, string> = {
  new: "bg-muted-foreground/40",
  working: "bg-info",
  handled: "bg-[#6c68e0]",
  escalated: "bg-[#e0662b]",
  approval: "bg-warning",
  resolved: "bg-success",
};

/** Quiet status: a colored dot and a word, no pill. */
export function StateDot({ state }: { state: TicketState }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", DOT[state])} />
      {STATE_LABEL[state]}
    </span>
  );
}

export const CHANNELS: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: "Email", icon: Mail },
  chat: { label: "Chat", icon: MessageCircle },
};

export const channelOf = (key: string) => CHANNELS[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), icon: MessageCircle };
