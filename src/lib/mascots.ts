/** Harbor's three glass guides (from the "AI Agent Mascot Models" Figma Make file). */
export type MascotKind = "orbit" | "facet" | "murmur";

export const MASCOTS: Record<MascotKind, { name: string; color: string; role: string }> = {
  orbit: { name: "Orbit", color: "#8b5cf6", role: "Keeps your setup on track" },
  facet: { name: "Facet", color: "#14b8a6", role: "Connects your tools" },
  murmur: { name: "Murmur", color: "#f97316", role: "Writes and explains" },
};

export const ALL_MASCOTS: MascotKind[] = ["orbit", "facet", "murmur"];
