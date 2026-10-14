// Device state + telemetry ingest. Hardware and simulated data are kept in SEPARATE buckets and never merged.
import { db } from "../db.js";
import { FallDetector } from "../utils/fallDetector.js";
import { assessLocation, bestLocation } from "../utils/locationConfidence.js";
import { routeSegments } from "../data/store.js";

const CONNECTED_S = Number(process.env.DEVICE_CONNECTED_S || 15);
const FRESH_S = 30;
const bucket = () => ({ deviceId: null, lastSeen: 0, gps: null, gpsFix: null, accel: null, spo2: null, tempC: null, savedAt: 0 });
const state = { hardware: bucket(), simulated: bucket() };
const detectors = { hardware: new FallDetector(), simulated: new FallDetector() };
const fallListeners = [];
let simTimer = null;
let lastFall = null;

export const onFallConfirmed = (fn) => fallListeners.push(fn);
export const isConnected = (now = Date.now()) => now - state.hardware.lastSeen <= CONNECTED_S * 1000;
export const simEnabled = () => simTimer !== null;
const fresh = (r, now) => (r && now - r.ts <= FRESH_S * 1000 ? r : null);

export function ingest(v) {
  const b = state[v.source];
  b.deviceId = v.deviceId; b.lastSeen = Date.now();
  if (v.gps) {
    b.gpsFix = v.gps.fix;
    if (v.gps.fix) b.gps = { ...v.gps, ts: v.ts, timestamp: new Date(v.ts).toISOString(), source: v.source === "simulated" ? "simulated" : "hardware GPS", simulated: v.source === "simulated" };
  }
  if (v.accel) { b.accel = { ...v.accel, ts: v.ts }; detectors[v.source].push(v.accel, v.ts); }
  if (v.spo2 !== undefined) b.spo2 = { value: v.spo2, ts: v.ts };
  if (v.tempC !== undefined) b.tempC = { value: v.tempC, ts: v.ts };
  if ((v.spo2 !== undefined || v.tempC !== undefined) && Date.now() - b.savedAt > 30000) { // throttled, minimal retention
    b.savedAt = Date.now();
    db.prepare("INSERT INTO readings (ts, source, spo2, temp_c) VALUES (?,?,?,?)").run(new Date(v.ts).toISOString(), v.source, v.spo2 ?? null, v.tempC ?? null);
    db.prepare("DELETE FROM readings WHERE ts < ?").run(new Date(Date.now() - 7 * 864e5).toISOString());
  }
}

/** Which bucket is "active" for evidence: live hardware first, simulated only when demo mode is on. */
export function activeSource(now = Date.now()) {
  if (isConnected(now)) return "hardware";
  return simEnabled() ? "simulated" : null;
}

export function deviceLocation(now = Date.now()) {
  const src = activeSource(now);
  const b = state[src || "hardware"];
  if (src && b.gpsFix === false) return assessLocation({ fix: false, source: src === "simulated" ? "simulated" : "hardware GPS", simulated: src === "simulated" }, now);
  return assessLocation(b.gps, now);
}

export function evidence(now = Date.now()) {
  const src = activeSource(now);
  const connectivity = isConnected(now) ? "hardware connected" : simEnabled() ? "SIMULATED — DEVICE OFFLINE" : "device offline";
  if (!src) return { source: null, accel: null, spo2: null, tempC: null, connectivity, lastSeen: state.hardware.lastSeen ? new Date(state.hardware.lastSeen).toISOString() : null };
  const b = state[src];
  const pick = (r) => fresh(r, now);
  const a = pick(b.accel);
  return { source: src, accel: a ? { x: a.x, y: a.y, z: a.z, ts: new Date(a.ts).toISOString() } : null,
    spo2: pick(b.spo2)?.value ?? null, tempC: pick(b.tempC)?.value ?? null, connectivity,
    lastSeen: new Date(b.lastSeen).toISOString(), deviceId: b.deviceId };
}

export function status(now = Date.now()) {
  const hw = state.hardware, connected = isConnected(now);
  const sensor = (r) => { const f = fresh(r, now); return f ? { available: true, lastValid: new Date(f.ts).toISOString() } : { available: false, lastValid: r ? new Date(r.ts).toISOString() : null }; };
  const src = activeSource(now);
  const fall = src ? detectors[src].snapshot(now) : { state: "NORMAL", evidence: null, secondsLeft: null };
  return {
    mode: connected ? "LIVE" : simEnabled() ? "SIMULATED — DEVICE OFFLINE" : "OFFLINE",
    activeSource: src,
    hardware: { connected, deviceId: hw.deviceId, lastSeen: hw.lastSeen ? new Date(hw.lastSeen).toISOString() : null,
      sensors: { gps: { ...sensor(hw.gps), fix: hw.gpsFix }, accel: sensor(hw.accel), spo2: sensor(hw.spo2), tempC: sensor(hw.tempC) } },
    simulation: { enabled: simEnabled() },
    location: deviceLocation(now),
    readings: src ? (() => { const e = evidence(now); return { source: src, spo2: e.spo2, tempC: e.tempC, accel: e.accel }; })() : null,
    fall: { ...fall, lastConfirmed: lastFall },
    disclaimer: "Prototype sensors. Not medical equipment. Fall detection is a threshold baseline, not clinically or field validated.",
  };
}

function fire(source, evidenceObj) {
  detectors[source].state = "SOS_CONFIRMED";
  lastFall = { at: new Date().toISOString(), source, evidence: evidenceObj };
  const ev = evidenceObj;
  detectors[source].reset();
  for (const fn of fallListeners) { try { fn(source, ev); } catch (e) { console.error("fall listener", e); } }
}
export const cancelFall = () => Object.values(detectors).some((d) => d.cancel());
export function confirmFallNow() {
  const src = activeSource(); if (!src) return false;
  const d = detectors[src];
  if (d.state !== "USER_CONFIRMATION_REQUIRED") return false;
  fire(src, d.evidence); return true;
}
setInterval(() => {
  for (const [src, d] of Object.entries(detectors)) { const ev = d.evidence; if (d.tick()) fire(src, ev); }
}, 1000).unref();

// ---- Demo mode (always labelled SIMULATED) ----
export function setSimulation(on) {
  if (on && !simTimer) {
    const [lat, lng] = routeSegments[0].path[0];
    simTimer = setInterval(() => ingest({ source: "simulated", deviceId: "SIM-DEVICE", ts: Date.now(),
      gps: { fix: true, lat, lng, accuracy: null, satellites: null },
      accel: { x: (Math.random() - 0.5) * 0.04, y: (Math.random() - 0.5) * 0.04, z: 1 + (Math.random() - 0.5) * 0.04 },
      spo2: 97, tempC: 36.6 }), 1000);
    simTimer.unref?.();
  } else if (!on && simTimer) { clearInterval(simTimer); simTimer = null; detectors.simulated.reset(); }
  return simEnabled();
}
export function injectSyntheticFall() {
  if (!simEnabled()) return false;
  const start = Date.now() - 3600, seq = [];
  for (let i = 0; i < 12; i++) seq.push(1 + (i % 2 ? 0.03 : -0.03));
  seq.push(0.3, 0.3, 3.4); for (let i = 0; i < 20; i++) seq.push(1 + (i % 2 ? 0.04 : -0.04));
  seq.forEach((g, i) => { const t = start + i * 100; ingest({ source: "simulated", deviceId: "SIM-DEVICE", ts: t, accel: { x: 0, y: 0, z: g } }); });
  return true;
}
export const _detectors = detectors; // for tests
