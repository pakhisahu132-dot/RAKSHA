import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 4100 + Math.floor(Math.random() * 500), B = `http://localhost:${PORT}/api`;
const dbPath = path.join(os.tmpdir(), `raksha-test-${Date.now()}.db`);
let proc;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const start = async (extra = {}) => {
  proc = spawn("node", ["server.js"], { env: { ...process.env, PORT, DB_PATH: dbPath, DELIVERY_MODE: "mock", RETRY_BASE_MS: "150", ...extra }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${B}/health-check`)).ok) return; } catch {} await sleep(100); }
  throw new Error("server did not start");
};
const stop = async () => { proc.kill(); await sleep(300); };
const post = (p, body, h = {}) => fetch(B + p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) });
const get = async (p) => (await fetch(B + p)).json();
const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(200); } throw new Error("timeout"); };

test("api suite", async (t) => {
  await start({ MOCK_FAIL_FIRST: "2" });
  let incId;
  await t.test("manual SOS + idempotency + cooldown duplicate protection", async () => {
    const body = { clientEventId: "evt-test-0001", location: { lat: 12.97, lng: 77.59, accuracy: 20, timestamp: new Date().toISOString() } };
    const [a, b] = await Promise.all([post("/sos", body), post("/sos", body)]);
    const ja = await a.json(), jb = await b.json();
    assert.equal(new Set([ja.incident.id, jb.incident.id]).size, 1);
    assert.ok([ja.duplicate, jb.duplicate].includes(true));
    const c = await (await post("/sos", { clientEventId: "evt-test-0002" })).json();
    assert.equal(c.duplicate, true); assert.equal(c.incident.id, ja.incident.id);
    incId = ja.incident.id;
    assert.equal(ja.incident.location.status, "RELIABLE");
    assert.equal((await get("/incidents")).incidents.length, 1);
  });
  await t.test("alerts: QUEUED -> retries after failures -> SENT (never 'delivered' early)", async () => {
    const first = (await get(`/incidents/${incId}`)).incident.alerts;
    assert.ok(first.every((a) => ["QUEUED", "SENDING"].includes(a.status)) || first.some((a) => a.attempts > 0));
    const done = await waitFor(async () => { const al = (await get(`/incidents/${incId}`)).incident.alerts; return al.every((a) => a.status === "SENT") && al; });
    assert.ok(done.every((a) => a.attempts === 3 && a.sentAt));
    const ev = (await get(`/incidents/${incId}`)).events.map((e) => e.event);
    assert.ok(ev.includes("ALERT_RETRY_SCHEDULED") && ev.includes("ALERT_SENT"));
  });
  await t.test("invalid telemetry rejected; hardware vs simulated kept separate", async () => {
    assert.equal((await post("/device/telemetry", { deviceId: "d1", gps: { fix: true, lat: 500, lng: 0 } })).status, 400);
    assert.equal((await get("/device/status")).mode, "OFFLINE");
    await post("/device/simulate", { enabled: true });
    await sleep(1300);
    let s = await get("/device/status");
    assert.equal(s.mode, "SIMULATED — DEVICE OFFLINE"); assert.equal(s.hardware.connected, false);
    assert.equal(s.location.simulated, true);
    assert.equal((await post("/device/telemetry", { deviceId: "esp32c3-1", gps: { fix: true, lat: 12.9, lng: 77.6, accuracy: 8 }, accel: { x: 0, y: 0, z: 1 } })).status, 200);
    s = await get("/device/status");
    assert.equal(s.mode, "LIVE"); assert.equal(s.location.simulated, false); assert.equal(s.location.status, "RELIABLE");
    assert.equal(s.hardware.sensors.spo2.available, false); // never invented
    await post("/device/simulate", { enabled: false });
  });
  await t.test("simulated fall -> confirmation -> cancel (no incident)", async () => {
    await post("/device/simulate", { enabled: true });
    await sleep(1200);
    // hardware heartbeat from previous test may still be live; wait it out so simulated is active
    await waitFor(async () => (await get("/device/status")).activeSource === "simulated", 20000);
    assert.equal((await post("/device/simulate/fall", {})).status, 200);
    const s = await waitFor(async () => { const x = await get("/device/status"); return x.fall.state === "USER_CONFIRMATION_REQUIRED" && x; });
    assert.ok(s.fall.secondsLeft > 0);
    assert.equal((await (await post("/device/fall/cancel", {})).json()).cancelled, true);
    assert.equal((await get("/device/status")).fall.state, "NORMAL");
    await post("/device/simulate", { enabled: false });
  });
  await t.test("incident card + deterministic summary (no API key)", async () => {
    const { card, text } = await get(`/incidents/${incId}/card`);
    assert.ok(card.mapLink.includes("12.97")); assert.ok(text.includes(incId));
    assert.equal(card.sensors.spo2, null);
    const s = await get(`/incidents/${incId}/summary`);
    assert.equal(s.source, "deterministic"); assert.ok(s.text.includes("Unavailable"));
  });
  await t.test("missed check-in escalates exactly once and queues alerts", async () => {
    const tr = (await (await post("/checkins/start", { destination: "Test", windowMinutes: 0.02, contactIds: ["tc-1"] })).json()).trip;
    const got = await waitFor(async () => { const x = (await get(`/checkins/${tr.id}`)).trip; return x.incident && x; }, 12000);
    assert.equal(got.status, "escalated"); assert.equal(got.incident.type, "CHECKIN_MISSED");
    await sleep(5000);
    const n = (await get("/incidents")).incidents.filter((i) => i.tripId === tr.id).length;
    assert.equal(n, 1);
    assert.equal(got.incident.alerts.length, 1);
  });
  await t.test("persistence across restart", async () => {
    const before = (await get("/incidents")).incidents.length;
    await stop(); await start();
    const after = (await get("/incidents")).incidents;
    assert.equal(after.length, before);
    assert.ok(after.find((i) => i.id === incId));
  });
  await stop();
  for (const f of [dbPath, dbPath + "-wal", dbPath + "-shm"]) fs.rmSync(f, { force: true });
});

test("delivery failure becomes FAILED after bounded retries; unconfigured channel is FAILED not 'sent'", async (t) => {
  const p2 = dbPath + "2";
  await start({ DB_PATH: p2, DELIVERY_MODE: "mock-fail", MAX_ATTEMPTS: "3" });
  const r = await (await post("/sos", { clientEventId: "evt-fail-0001" })).json();
  const al = await waitFor(async () => { const a = (await get(`/incidents/${r.incident.id}`)).incident.alerts; return a.every((x) => x.status === "FAILED") && a; });
  assert.ok(al.every((a) => a.attempts === 3));
  await stop();
  await start({ DB_PATH: p2 + "3", DELIVERY_MODE: "" , TELEGRAM_BOT_TOKEN: ""});
  const r2 = await (await post("/sos", { clientEventId: "evt-none-0001" })).json();
  assert.ok(r2.incident.alerts.every((a) => a.status === "FAILED" && a.channel === "none"));
  await stop();
});
