import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(n: number, digits?: number) {
  const d = digits ?? (n !== 0 && Math.abs(n) < 0.1 ? 4 : 2);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function timeAgo(date: Date | string | null | undefined, now = Date.now()) {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}
