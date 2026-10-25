/** Harbor's six glass mascots (from the "AI Agent Mascot Models" Figma Make file). They are icons, not characters with names. */
export type MascotKind = "orbit" | "facet" | "murmur" | "nimbus" | "lumen" | "sentry";

export const MASCOTS: Record<MascotKind, { color: string }> = {
  orbit: { color: "#8b5cf6" },
  facet: { color: "#14b8a6" },
  murmur: { color: "#f97316" },
  nimbus: { color: "#0ea5e9" },
  lumen: { color: "#eab308" },
  sentry: { color: "#f43f5e" },
};

export const MASCOT_KINDS = Object.keys(MASCOTS) as MascotKind[];
/** The three guides shown together (onboarding welcome and summary, the Go live card). */
export const ALL_MASCOTS: MascotKind[] = ["orbit", "facet", "murmur"];
