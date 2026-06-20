const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDirectory = path.resolve(__dirname, "..");
const publicDirectory = path.join(rootDirectory, "public");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"),
);
const date = new Date();

const runGit = (args, fallback) => {
  try {
    return (
      execFileSync("git", args, {
        cwd: rootDirectory,
        encoding: "utf8",
      }).trim() || fallback
    );
  } catch {
    return fallback;
  }
};

const buildTimestamp = date.toISOString().slice(0, 10).replace(/-/g, "");
const commitHash = runGit(["rev-parse", "--short=7", "HEAD"], "unknown");
const version = `${packageJson.version}+${buildTimestamp}-${commitHash}`;
const metadata = {
  version,
  date: date.toISOString(),
};

fs.mkdirSync(publicDirectory, { recursive: true });
fs.writeFileSync(
  path.join(publicDirectory, "version.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(`Generated PharmacyOS build version ${version}`);
