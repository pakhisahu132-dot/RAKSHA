#!/usr/bin/env node
// USB-serial <-> RAKSHA backend bridge. No dependencies. macOS/Linux (uses `stty`).
// Usage: node tools/serial-bridge.js /dev/cu.usbmodemXXXX [http://localhost:4000]
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const [port, base = "http://localhost:4000"] = process.argv.slice(2);
if (!port) { console.error("Usage: node tools/serial-bridge.js <serial-port> [backend-url]"); process.exit(1); }
const key = process.env.DEVICE_API_KEY;
try { execFileSync("stty", [process.platform === "darwin" ? "-f" : "-F", port, "115200", "raw", "-echo"]); }
catch (e) { console.error("stty failed:", e.message); process.exit(1); }

const out = fs.createWriteStream(port);
const rd = fs.createReadStream(port, { encoding: "utf8" });
const headers = { "content-type": "application/json", ...(key ? { "x-device-key": key } : {}) };
const post = (p, b) => fetch(base + p, { method: "POST", headers, body: JSON.stringify(b) });
let buf = "", lastState = "";

rd.on("data", async (chunk) => {
  buf += chunk; let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line.startsWith("{")) continue;
    let m; try { m = JSON.parse(line); } catch { continue; } // ignore partial/garbled lines
    try {
      if (m.type === "telemetry") { const { type, ...t } = m; const r = await post("/api/device/telemetry", { ...t, source: "hardware" }); if (!r.ok) console.warn("telemetry rejected:", await r.text()); }
      else if (m.type === "event" && m.event === "sos_touch") {
        const r = await post("/api/sos", { type: "HARDWARE_TOUCH_SOS", clientEventId: m.id });
        console.log("touch SOS ->", r.status, (await r.json()).incident?.id);
      }
    } catch (e) { console.warn("backend unreachable:", e.message); send("NO_CONN"); }
  }
});

function send(s) { if (s !== lastState) { lastState = s; out.write(`STATE:${s}\n`); } }
setInterval(async () => { // mirror real backend state on the OLED
  try {
    const st = await (await fetch(base + "/api/status")).json();
    const inc = (await (await fetch(base + "/api/incidents")).json()).incidents[0];
    const recent = inc && Date.now() - new Date(inc.createdAt) < 5 * 60 * 1000;
    const a = recent ? inc.alerts.map((x) => x.status) : [];
    if (a.some((s) => s === "SENT" || s === "ACKNOWLEDGED")) send("SENT");
    else if (a.some((s) => s === "QUEUED" || s === "SENDING")) send("QUEUED");
    else if (a.length && a.every((s) => s === "FAILED")) send("FAILED");
    else send(st.hardware.sensors.gps.fix ? "LOCATION" : "GPS_SEARCH");
  } catch { send("NO_CONN"); }
}, 2000);
console.log(`Bridge running: ${port} -> ${base}`);
