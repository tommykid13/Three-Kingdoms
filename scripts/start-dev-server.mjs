import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logDir = path.join(root, ".codex");
fs.mkdirSync(logDir, { recursive: true });

const out = fs.openSync(path.join(logDir, "dev-server.out.log"), "w");
const err = fs.openSync(path.join(logDir, "dev-server.err.log"), "w");

const env = { ...process.env };
const pathValue = env.Path ?? env.PATH;
delete env.PATH;
delete env.path;
if (pathValue) {
  env.Path = pathValue;
}

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const baseArgs = npmCli ? [npmCli] : [];
const child = spawn(
  command,
  [...baseArgs, "run", "dev"],
  {
    cwd: root,
    detached: true,
    env,
    shell: false,
    stdio: ["ignore", out, err],
    windowsHide: true,
  },
);

child.unref();

console.log(`Dev server process started: ${child.pid}`);
console.log(`stdout: ${path.join(logDir, "dev-server.out.log")}`);
console.log(`stderr: ${path.join(logDir, "dev-server.err.log")}`);
