// Minimal .env loader (no dependency, works on any Node >= 18). Real env vars win.
import fs from "node:fs";
try {
  for (const line of fs.readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\n]*?)\s*(#.*)?$/);
    if (m && m[2] !== "" && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env: fine */ }
