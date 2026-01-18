#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveScriptPath() {
  const distPath = join(__dirname, "dist/src/server.js");
  const srcPath = join(__dirname, "src/server.ts");

  if (existsSync(distPath)) {
    return ["node", [distPath]];
  }

  if (existsSync(srcPath)) {
    return ["npx", ["tsx", srcPath]];
  }

  console.error("Error: Could not find server script. Run 'npm run build' first.");
  process.exit(1);
}

const [command, scriptArgs] = resolveScriptPath();
const args = process.argv.slice(2);

const child = spawn(command, [...scriptArgs, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code);
});

child.on("error", (err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
