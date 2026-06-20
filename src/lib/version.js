export const FRONTEND_VERSION = process.env.REACT_APP_VERSION || "0.0.0";
export const ACKNOWLEDGED_VERSION_KEY = "pharmacyos_acknowledged_version";
export const UPDATE_COMPLETED_KEY = "pharmacyos_update_completed";

export const RELEASE_NOTE_GROUPS = [
  { key: "new", label: "New" },
  { key: "improved", label: "Improved" },
  { key: "fixed", label: "Fixed" },
];

export const EMPTY_RELEASE_NOTES = RELEASE_NOTE_GROUPS.reduce(
  (groups, { key }) => ({ ...groups, [key]: [] }),
  {},
);

export const getStoredVersion = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const setStoredVersion = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch {
    /* Storage may be unavailable in privacy-restricted browsers. */
  }
};

export const removeStoredVersion = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch {
    /* Storage may be unavailable in privacy-restricted browsers. */
  }
};

const parseVersion = (version) => {
  const normalized = String(version || "0").replace(/^v/i, "");
  const [core = "0", build = ""] = normalized.split("+", 2);
  const parts = core
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
  const buildTimestamp = Number.parseInt(build.match(/^\d+/)?.[0] || "0", 10);
  return { normalized, core, parts, build, buildTimestamp };
};

export const getVersionIdentity = (version) => {
  const parsed = parseVersion(version);
  return {
    version: parsed.core,
    build: parsed.build,
    full: parsed.normalized,
  };
};

export const compareVersions = (left, right) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a.parts[index] || 0) !== (b.parts[index] || 0))
      return (a.parts[index] || 0) > (b.parts[index] || 0) ? 1 : -1;
  }
  if (a.normalized === b.normalized) return 0;
  if (a.buildTimestamp !== b.buildTimestamp)
    return a.buildTimestamp > b.buildTimestamp ? 1 : -1;
  if (a.build && !b.build) return 1;
  if (!a.build && b.build) return -1;
  return a.build === b.build ? 0 : 1;
};

export const getUpdateType = (currentVersion, nextVersion) => {
  const current = parseVersion(currentVersion).parts;
  const next = parseVersion(nextVersion).parts;
  if (next[0] > current[0]) return "major";
  if (next[1] > current[1]) return "minor";
  return "patch";
};

const normalizeNoteList = (value) => {
  if (!value) return [];
  if (Array.isArray(value))
    return value
      .map((note) =>
        typeof note === "string"
          ? note
          : note?.text || note?.note || note?.title || "",
      )
      .map(String)
      .map((note) => note.trim())
      .filter(Boolean);
  return String(value)
    .split(/\r?\n/)
    .map((note) => note.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
};

export const normalizeReleaseNotes = (rawNotes) => {
  const grouped = { ...EMPTY_RELEASE_NOTES };
  if (!rawNotes) return grouped;

  if (Array.isArray(rawNotes)) {
    rawNotes.forEach((note) => {
      if (typeof note === "string") grouped.improved.push(note.trim());
      else {
        const type = String(
          note?.type || note?.group || note?.category || "improved",
        ).toLowerCase();
        const groupKey = type.includes("fix")
          ? "fixed"
          : type.includes("new") || type.includes("add")
            ? "new"
            : "improved";
        grouped[groupKey].push(
          String(note?.text || note?.note || note?.title || "").trim(),
        );
      }
    });
  } else if (typeof rawNotes === "object") {
    grouped.new = normalizeNoteList(
      rawNotes.new || rawNotes.added || rawNotes.features,
    );
    grouped.improved = normalizeNoteList(
      rawNotes.improved ||
        rawNotes.changed ||
        rawNotes.enhancements ||
        rawNotes.updates,
    );
    grouped.fixed = normalizeNoteList(
      rawNotes.fixed || rawNotes.fixes || rawNotes.bugfixes,
    );
  } else {
    grouped.improved = normalizeNoteList(rawNotes);
  }

  return RELEASE_NOTE_GROUPS.reduce(
    (notes, { key }) => ({
      ...notes,
      [key]: grouped[key]
        .map(String)
        .map((note) => note.trim())
        .filter(Boolean),
    }),
    {},
  );
};

export const hasReleaseNotes = (releaseNotes = EMPTY_RELEASE_NOTES) =>
  RELEASE_NOTE_GROUPS.some(({ key }) => releaseNotes[key]?.length);

export const normalizeVersionMetadata = (payload = {}) => {
  const data =
    payload.data && typeof payload.data === "object" ? payload.data : payload;
  const version =
    data.version ||
    data.app_version ||
    data.latest_version ||
    data.current_version ||
    data.full_version;
  if (!version) return null;

  const rawNotes =
    data.release_notes ||
    data.releaseNotes ||
    data.notes ||
    data.whats_new ||
    data.changelog;
  const releaseNotes = normalizeReleaseNotes(rawNotes);
  const updateAvailable = data.update_available ?? data.updateAvailable;

  return {
    version: String(version).replace(/^v/i, ""),
    date: data.date || data.release_date || data.released_at || null,
    message: data.message || data.update_message || "",
    releaseNotes,
    updateAvailable:
      typeof updateAvailable === "boolean" ? updateAvailable : null,
  };
};
