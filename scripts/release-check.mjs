import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const skipSmoke = process.argv.includes("--skip-smoke");

function normalizeWindowsEnv(inputEnv) {
  if (process.platform !== "win32") {
    return inputEnv;
  }

  const entries = Object.entries(inputEnv);
  const seen = new Map();

  for (const [key, value] of entries) {
    const normalized = key.toLowerCase();
    if (!seen.has(normalized) || key === "Path") {
      seen.set(normalized, [key, value]);
    }
  }

  return Object.fromEntries(seen.values());
}

const normalizedEnv = normalizeWindowsEnv(process.env);

const steps = [
  ["Release check: api lint", "cmd.exe", ["/d", "/s", "/c", "npm run lint"], "apps/api"],
  ["Release check: web lint", "cmd.exe", ["/d", "/s", "/c", "npm run lint"], "apps/web"],
  ["Release check: api build", "cmd.exe", ["/d", "/s", "/c", "npm run build"], "apps/api"],
  ["Release check: web build", "cmd.exe", ["/d", "/s", "/c", "npm run build"], "apps/web"]
];

if (!skipSmoke) {
  steps.push(["Release check: smoke", "cmd.exe", ["/d", "/s", "/c", "npm run smoke:mvp"], "."]);
}

for (const [label, command, args, cwd] of steps) {
  console.log(label);
  const result = spawnSync(command, args, {
    cwd: fileURLToPath(new URL(`../${cwd}`, import.meta.url)),
    stdio: "inherit",
    env: normalizedEnv
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Release check passed");
