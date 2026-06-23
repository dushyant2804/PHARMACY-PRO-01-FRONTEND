#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run(process.execPath, [path.join("scripts", "generate-version.js")]);

const cracoBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  isWindows ? "craco.cmd" : "craco",
);

run(cracoBin, ["build"], {
  env: {
    ...process.env,
    BUILD_PATH: "dist",
    REACT_APP_LOCAL_DESKTOP: "true",
  },
});
