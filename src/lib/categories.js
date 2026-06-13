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

export function isRestricted(category) {
  if (!category) return false;

  return RESTRICTED_CATEGORIES.includes(category);
}

export function categoryBadgeClass(category) {
  if (!category) {
    return "badge-other";
  }

  switch (category) {
    case "OTC":
      return "badge-otc";

    case "Schedule G":
      return "badge-sch-g";

    case "Schedule H":
      return "badge-sch-h";
    case "Schedule H1":
      return "badge-sch-h1";

    case "Schedule X":
      return "badge-sch-x";

    default:
      if (category.startsWith("NDPS")) {
        return "badge-sch-x";
      }

      return "badge-other";
  }
}
