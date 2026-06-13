const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDirectory = path.resolve(__dirname, "..");
const publicDirectory = path.join(rootDirectory, "public");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"));
const date = new Date();

const runGit = (args, fallback) => {
  try {
    return execFileSync("git", args, { cwd: rootDirectory, encoding: "utf8" }).trim() || fallback;
  } catch {
    return fallback;
  }
};

const buildTimestamp = date.toISOString().slice(0, 10).replace(/-/g, "");
const commitHash = runGit(["rev-parse", "--short=7", "HEAD"], "unknown");
const commitSubject = runGit(["log", "-1", "--pretty=%s"], "");
const version = `${packageJson.version}+${buildTimestamp}-${commitHash}`;
const releaseHighlights = [
  "Added drug licence fields and pharmacy logo support to Business Profile.",
  "Improved Settings organization and mobile responsiveness.",
  "Expanded Update Center with semantic version, build details, and release notes.",
];
const notes = commitSubject && !/^merge\b/i.test(commitSubject)
  ? [commitSubject, ...releaseHighlights]
  : releaseHighlights;
const metadata = {
  version,
  date: date.toISOString(),
};

fs.mkdirSync(publicDirectory, { recursive: true });
fs.writeFileSync(path.join(publicDirectory, "version.json"), `${JSON.stringify({
  ...metadata,
  message: "A new PharmacyOS update is available.",
  release_notes: notes,
}, null, 2)}\n`);
fs.writeFileSync(path.join(publicDirectory, "release-notes.json"), `${JSON.stringify({
  ...metadata,
  notes,
}, null, 2)}\n`);

console.log(`Generated PharmacyOS build version ${version}`);
