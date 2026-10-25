"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function Radio({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium">
      <input type="radio" checked={checked} onChange={onSelect} className="peer sr-only" />
      <span
        className={cn(
          "size-[18px] rounded-full border-2 transition-all peer-focus-visible:ring-4 peer-focus-visible:ring-foreground/10",
          checked ? "border-[5px] border-foreground" : "border-input",
        )}
      />
      {children}
    </label>
  );
}

/** Top-right card: describe a job and jump straight into generation, or browse templates. */
export function BuildAgentCard() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"scratch" | "template">("scratch");
  const [hint, setHint] = useState(false);
  return (
    <Panel title="Build an agent" description="Describe the job in plain English.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "template") return router.push("/agents?view=templates");
          if (text.trim().length < 8) {
            setHint(true);
            return input.current?.focus();
          }
          router.push(`/agents/new?prompt=${encodeURIComponent(text.trim())}`);
        }}
      >
        <Label htmlFor="job">Job description</Label>
        <Input
          ref={input}
          id="job"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setHint(false);
          }}
          placeholder="Triage new tickets and alert #support-urgent"
          className="mt-2"
          aria-describedby={hint ? "job-hint" : undefined}
        />
        {hint && (
          <p id="job-hint" className="mt-2 text-[13px] text-danger">
            Add a sentence about what the agent should do.
          </p>
        )}
        <fieldset className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
          <legend className="sr-only">Start from</legend>
          <Radio checked={mode === "scratch"} onSelect={() => setMode("scratch")}>
            From scratch
          </Radio>
          <Radio checked={mode === "template"} onSelect={() => setMode("template")}>
            From a template
          </Radio>
        </fieldset>
        <Button type="submit" variant="outline" className="mt-6">
          {mode === "template" ? "Browse templates" : "Generate"}
        </Button>
      </form>
    </Panel>
  );
}

/** Approve every pending action of a paused run in one click; per-action review lives on the run timeline. */
export function ApproveAllButton({ approvalIds, reviewHref }: { approvalIds: string[]; reviewHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          for (const id of approvalIds) {
            const res = await fetch(`/api/approvals/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "approved" }) });
            if (!res.ok && res.status !== 409) {
              setError("Could not approve. Try again from the run.");
              break;
            }
          }
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
        {approvalIds.length > 1 ? `Approve all ${approvalIds.length}` : "Approve"}
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href={reviewHref}>Review</Link>
      </Button>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </div>
  );
}
