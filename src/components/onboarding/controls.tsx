"use client";

import { cn } from "@/lib/utils";

/** Outline chip from the reference: gray when off, ink outline when on. */
export function Chip({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-10 cursor-pointer rounded-xl border px-3.5 text-[14px] transition-all",
        selected ? "border-foreground bg-white font-semibold text-foreground shadow-sm ring-1 ring-foreground" : "border-black/10 bg-white/50 text-muted-foreground hover:border-black/25 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Label, a big readout of the current value, then the track. */
export function Slider({
  id,
  label,
  valueText,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  id: string;
  label: string;
  valueText: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div>
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      <div aria-hidden className="mt-1 text-[26px] font-semibold tabular-nums">
        {valueText}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range mt-2"
        style={{ "--fill": fill } as React.CSSProperties}
      />
    </div>
  );
}

/** A small heading above a group of controls inside a step. */
export function FieldTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[15px] font-semibold">{children}</div>;
}
