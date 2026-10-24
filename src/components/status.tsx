import { AlertTriangle, CheckCircle2, CircleDashed, Hand, Loader2, XCircle } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function LiveDot({ className, tone = "success" }: { className?: string; tone?: "success" | "warning" | "muted" }) {
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-muted-foreground/50";
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      {tone !== "muted" && <span className={cn("absolute inline-flex size-full rounded-full animate-sonar", color)} />}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

export function AgentStatusBadge({ status }: { status: string }) {
  if (status === "live")
    return (
      <Badge variant="success">
        <LiveDot className="mr-0.5" /> Live
      </Badge>
    );
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

/** One badge for run status + outcome. */
export function RunBadge({ status, outcome }: { status: string; outcome?: string | null }) {
  if (status === "queued")
    return (
      <Badge variant="outline">
        <CircleDashed /> Queued
      </Badge>
    );
  if (status === "running")
    return (
      <Badge variant="info">
        <Loader2 className="animate-spin" /> Running
      </Badge>
    );
  if (status === "awaiting_approval")
    return (
      <Badge variant="warning">
        <Hand /> Needs approval
      </Badge>
    );
  if (status === "failed" || outcome === "failed")
    return (
      <Badge variant="danger">
        <XCircle /> Failed
      </Badge>
    );
  if (outcome === "flagged")
    return (
      <Badge variant="warning">
        <AlertTriangle /> Flagged
      </Badge>
    );
  return (
    <Badge variant="success">
      <CheckCircle2 /> Handled
    </Badge>
  );
}

const URGENCY: Record<string, BadgeVariant> = { urgent: "danger", high: "warning", normal: "info", low: "default" };

export function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency) return <Badge variant="outline">Untriaged</Badge>;
  return (
    <Badge variant={URGENCY[urgency] ?? "default"} className="capitalize">
      {urgency === "urgent" && <span className="size-1.5 rounded-full bg-danger" />}
      {urgency}
    </Badge>
  );
}

export function ModeBadge({ live, liveLabel = "Live", offLabel = "Simulated" }: { live: boolean; liveLabel?: string; offLabel?: string }) {
  return live ? (
    <Badge variant="success">
      <span className="size-1.5 rounded-full bg-success" /> {liveLabel}
    </Badge>
  ) : (
    <Badge variant="outline">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" /> {offLabel}
    </Badge>
  );
}

export function categoryLabel(c: string | null) {
  if (!c) return "";
  return c.replace(/_/g, " ").replace(/^\w/, (s) => s.toUpperCase());
}
