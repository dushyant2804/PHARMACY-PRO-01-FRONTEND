export const CATEGORIES = [
  "OTC",
  "Schedule G",
  "Schedule H",
  "Schedule H1",
  "Schedule X",
  "NDPS-Narcotics",
  "NDPS-Psychotropics",
  "NDPS-END",
  "Ayurvedic",
  "Other",
];

export const RESTRICTED_CATEGORIES = [
  "Schedule H",
  "Schedule H1",
  "Schedule X",
  "NDPS-Narcotics",
  "NDPS-Psychotropics",
  "NDPS-END",
];

export function isRestricted(cat) {
  return RESTRICTED_CATEGORIES.includes(cat);
}

export function categoryBadgeClass(cat) {
  if (cat === "OTC") return "badge-otc";
  if (cat === "Schedule H" || cat === "Schedule H1") return "badge-sch-h1";
  if (cat === "Schedule X" || cat?.startsWith("NDPS")) return "badge-sch-h";
  if (cat === "Schedule G") return "badge-sch-h1";
  return "badge-other";
}
