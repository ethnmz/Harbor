import { LayoutTemplate } from "lucide-react";
import { UseTemplateButton } from "@/components/use-template-button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { modelInfo } from "@/lib/llm/models";
import { listTemplates } from "@/lib/queries";

export default async function TemplatesPage() {
  const templates = await listTemplates();
  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable agent setups: instructions, tools, approvals, model and guardrails. Start from one, or save any agent you've tested as a template for your team."
      />
      {!templates.length ? (
        <EmptyState icon={<LayoutTemplate />} title="No templates yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight">{t.name}</span>
                {t.builtin ? <Badge variant="outline">Starter</Badge> : <Badge variant="primary">Your team</Badge>}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.allowedTools.map((tool) => (
                  <Badge key={tool} variant={t.riskyTools.includes(tool) ? "warning" : "outline"} className="font-mono text-[11px] font-normal">
                    {tool}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  {modelInfo(t.model).label} · {t.riskyTools.length ? `${t.riskyTools.length} approvals` : "no approvals"}
                </span>
                <UseTemplateButton templateId={t.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
