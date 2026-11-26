export const EVENT = {
  name: "Hair by Akose Festival",
  date: "Saturday, 28 November 2026",
  time: "1:00pm – 6:00pm",
  venue: "Arboretum private grounds",
  website: "https://hairbyakose.com",
};

export type Section = "solo" | "panelist" | "vendor" | "runway";

/** How many tickets each section is allowed (per person / per group link). */
export const SECTIONS: Record<Section, { label: string; max: number }> = {
  solo: { label: "Solo", max: 1 },
  panelist: { label: "Panelist", max: 6 },
  vendor: { label: "Vendor", max: 4 },
  runway: { label: "Believers Runway", max: 20 },
};

export const GROUP_SECTIONS: Section[] = ["panelist", "vendor", "runway"];

export function maxTickets(): number {
  const n = Number(process.env.MAX_TICKETS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

export function formatTicket(n: number): string {
  return "#" + String(n).padStart(3, "0");
}
