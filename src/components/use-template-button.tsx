"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UseTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/templates/${templateId}/use`, { method: "POST" });
        const data = await res.json();
        if (res.ok) router.push(`/agents/new?draft=${data.agentId}`);
        else setBusy(false);
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : null} Use template <ArrowRight />
    </Button>
  );
}
