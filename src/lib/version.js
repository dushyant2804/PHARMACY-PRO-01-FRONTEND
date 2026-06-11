export const FRONTEND_VERSION = process.env.REACT_APP_VERSION || "0.0.0";
export const ACKNOWLEDGED_VERSION_KEY = "pharmacyos_acknowledged_version";
export const UPDATE_COMPLETED_KEY = "pharmacyos_update_completed";

export const getStoredVersion = (storage, key) => {
  try { return storage.getItem(key); } catch { return null; }
};

export const setStoredVersion = (storage, key, value) => {
  try { storage.setItem(key, value); } catch { /* Storage may be unavailable in privacy-restricted browsers. */ }
};

export const removeStoredVersion = (storage, key) => {
  try { storage.removeItem(key); } catch { /* Storage may be unavailable in privacy-restricted browsers. */ }
};

const parseVersion = (version) => {
  const normalized = String(version || "0").replace(/^v/i, "");
  const [core = "0", build = ""] = normalized.split("+", 2);
  const parts = core.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const buildTimestamp = Number.parseInt(build.match(/^\d+/)?.[0] || "0", 10);
  return { normalized, parts, build, buildTimestamp };
};

export const compareVersions = (left, right) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a.parts[index] || 0) !== (b.parts[index] || 0)) return (a.parts[index] || 0) > (b.parts[index] || 0) ? 1 : -1;
  }
  if (a.normalized === b.normalized) return 0;
  if (a.buildTimestamp !== b.buildTimestamp) return a.buildTimestamp > b.buildTimestamp ? 1 : -1;
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

export const normalizeVersionMetadata = (payload = {}) => {
  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const version = data.version || data.app_version || data.latest_version || data.current_version;
  if (!version) return null;

  const rawNotes = data.release_notes || data.notes || data.whats_new || [];
  const releaseNotes = Array.isArray(rawNotes)
    ? rawNotes.map(String).filter(Boolean)
    : String(rawNotes).split(/\r?\n/).map((note) => note.replace(/^[-•]\s*/, "").trim()).filter(Boolean);

  return {
    version: String(version).replace(/^v/i, ""),
    date: data.date || data.release_date || null,
    message: data.message || data.update_message || "A newer, improved PharmacyOS experience is ready.",
    releaseNotes: releaseNotes.length ? releaseNotes : ["Performance, reliability, and experience improvements."],
  };
};
