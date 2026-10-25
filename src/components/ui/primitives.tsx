import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Mascot } from "@/components/mascots/mascot";
import type { MascotKind } from "@/lib/mascots";
import { cn } from "@/lib/utils";

// Card ----------------------------------------------------------------------

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-[16px] font-semibold", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-5", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 border-t px-5 py-3", className)} {...props} />;
}

/** Mota-style section card: big radius, generous padding, title + gray subtitle + actions. */
export function Panel({
  title,
  description,
  actions,
  eyebrow,
  variant = "solid",
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** "glass" for the key surfaces (home hero cards, onboarding); data-heavy cards stay solid. */
  variant?: "solid" | "glass";
  className?: string;
  children?: React.ReactNode;
}) {
  const header = title || description || actions || eyebrow;
  return (
    <section
      className={cn(
        "rounded-[24px] p-6 md:p-8",
        variant === "glass" ? "glass" : "border border-[#eceef1] bg-card shadow-[0_2px_12px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {header && (
        <div className={cn("flex flex-wrap items-start justify-between gap-4", children ? "mb-6" : undefined)}>
          <div className="min-w-0">
            {eyebrow && <div className="mb-2 text-[13px] font-medium text-muted-foreground">{eyebrow}</div>}
            {title && <h2 className="display text-[24px]">{title}</h2>}
            {description && <div className="mt-1 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Badge ---------------------------------------------------------------------

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-muted text-foreground",
      primary: "border-transparent bg-primary-soft text-primary",
      success: "border-transparent bg-success-soft text-success",
      warning: "border-transparent bg-warning-soft text-warning",
      danger: "border-transparent bg-danger-soft text-danger",
      info: "border-transparent bg-info-soft text-info",
      outline: "bg-card text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Form controls -------------------------------------------------------------

// Gray filled fields with a hairline border, like the reference's ID/password boxes.
const control =
  "w-full rounded-xl border border-input bg-muted px-4 text-[15px] font-medium outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/80 focus-visible:border-foreground/35 focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-foreground/5 disabled:opacity-60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "h-12 cursor-pointer pr-9", className)} {...props} />;
}
/** Small uppercase field label ("YOUR ID"). */
export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[12px] font-semibold tracking-[0.04em] text-muted-foreground uppercase", className)} {...props} />;
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
    </button>
  );
}

// Misc ------------------------------------------------------------------------

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}

export function EmptyState({ icon, mascot, title, children, action }: { icon?: React.ReactNode; mascot?: MascotKind; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-muted px-6 py-12 text-center">
      {mascot ? (
        <Mascot kinds={[mascot]} width={120} height={120} className="mb-1" />
      ) : (
        icon && <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-card text-foreground shadow-sm [&_svg]:size-5">{icon}</div>
      )}
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[14px] text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Page intro as a header-only card; the section name itself lives in the top bar. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return <Panel title={title} description={description} actions={actions} eyebrow={eyebrow} className={cn("mb-6", className)} />;
}

/** Gray tile with a big number, like the reference's storage tiles. */
export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className="rounded-2xl bg-muted px-5 py-4">
      <div className="text-[14px] font-medium text-foreground/80">{label}</div>
      <div
        className={cn(
          "mt-1 text-[28px] font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[13px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
