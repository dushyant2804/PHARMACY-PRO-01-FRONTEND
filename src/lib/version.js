export const FRONTEND_VERSION = process.env.REACT_APP_VERSION || "2.0";
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

const versionParts = (version) => String(version || "0")
  .replace(/^v/i, "")
  .split(/[.+-]/)
  .slice(0, 3)
  .map((part) => Number.parseInt(part, 10) || 0);

export const compareVersions = (left, right) => {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
};

export const getUpdateType = (currentVersion, nextVersion) => {
  const current = versionParts(currentVersion);
  const next = versionParts(nextVersion);
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
    message: data.message || data.update_message || "A newer, improved PharmacyOS experience is ready.",
    releaseNotes: releaseNotes.length ? releaseNotes : ["Performance, reliability, and experience improvements."],
  };
};
