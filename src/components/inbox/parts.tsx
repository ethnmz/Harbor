import { AlertTriangle, Check, Hand, Loader2, Mail, MessageCircle, Sparkles } from "lucide-react";
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

const STATE_STYLE: Record<TicketState, { cls: string; icon?: React.ElementType }> = {
  new: { cls: "border-black/10 bg-white text-muted-foreground" },
  working: { cls: "border-info/15 bg-info-soft text-info", icon: Loader2 },
  handled: { cls: "border-[#d9dcfb] bg-[#eef0ff] text-[#4a46c8]", icon: Sparkles },
  escalated: { cls: "border-[#f6cdb8] bg-[#fdf0e8] text-[#c2410c]", icon: AlertTriangle },
  approval: { cls: "border-warning/20 bg-warning-soft text-warning", icon: Hand },
  resolved: { cls: "border-black/10 bg-muted text-muted-foreground", icon: Check },
};

export function StateBadge({ state, className }: { state: TicketState; className?: string }) {
  const { cls, icon: Icon } = STATE_STYLE[state];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap", cls, className)}>
      {Icon && <Icon className={cn("size-3", state === "working" && "animate-spin")} />}
      {STATE_LABEL[state]}
    </span>
  );
}

export const CHANNELS: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: "Email", icon: Mail },
  chat: { label: "Chat", icon: MessageCircle },
};

export const channelOf = (key: string) => CHANNELS[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), icon: MessageCircle };
