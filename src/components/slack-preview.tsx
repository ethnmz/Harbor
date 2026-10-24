import { Hash } from "lucide-react";
import { HarborMark } from "@/components/harbor-mark";
import { Badge } from "@/components/ui/primitives";

const EMOJI: Record<string, string> = {
  rotating_light: "🚨",
  raised_hand: "✋",
  test_tube: "🧪",
  white_check_mark: "✅",
  warning: "⚠️",
  money_with_wings: "💸",
  fire: "🔥",
  eyes: "👀",
};

/** Minimal Slack mrkdwn: <url|label>, *bold*, _italic_, `code`, :emoji:, newlines. */
export function Mrkdwn({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {renderInline(line)}
          {li < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function renderInline(line: string) {
  const parts: React.ReactNode[] = [];
  const re = /<([^>|]+)\|([^>]+)>|<(https?:[^>]+)>|\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])|`([^`]+)`|:([a-z0-9_+-]+):/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    if (m[1])
      parts.push(
        <a key={k++} href={m[1]} target="_blank" rel="noreferrer" className="text-[#1264a3] hover:underline">
          {m[2]}
        </a>,
      );
    else if (m[3])
      parts.push(
        <a key={k++} href={m[3]} target="_blank" rel="noreferrer" className="text-[#1264a3] hover:underline">
          {m[3]}
        </a>,
      );
    else if (m[4]) parts.push(<strong key={k++}>{m[4]}</strong>);
    else if (m[5]) parts.push(<em key={k++}>{m[5]}</em>);
    else if (m[6])
      parts.push(
        <code key={k++} className="rounded border bg-muted px-1 text-[12px] text-danger">
          {m[6]}
        </code>,
      );
    else if (m[7]) parts.push(EMOJI[m[7]] ?? m[0]);
    last = re.lastIndex;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

export function SlackPreview({ channel, text, delivered, note, sender = "Harbor" }: { channel: string; text: string; delivered: boolean; note?: string; sender?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="flex items-center gap-1.5 border-b bg-[#f8f8f8] px-3 py-1.5 text-xs font-semibold text-[#1d1c1d]">
        <Hash className="size-3.5" />
        {channel.replace(/^#/, "")}
        <span className="ml-auto font-normal">
          {delivered ? <Badge variant="success">Delivered to Slack</Badge> : <Badge variant="outline" title={note}>Kept in Harbor</Badge>}
        </span>
      </div>
      <div className="flex gap-2.5 px-3 py-2.5">
        <HarborMark className="size-8 shrink-0 rounded-md" />
        <div className="min-w-0 text-[13px] leading-relaxed text-[#1d1c1d]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold">{sender}</span>
            <span className="rounded bg-[#e8e8e8] px-1 text-[10px] font-semibold text-[#616061]">APP</span>
          </div>
          <div className="break-words">
            <Mrkdwn text={text} />
          </div>
        </div>
      </div>
    </div>
  );
}
