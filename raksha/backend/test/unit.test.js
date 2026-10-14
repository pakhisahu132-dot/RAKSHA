import test from "node:test";
import assert from "node:assert/strict";
import { assessLocation } from "../utils/locationConfidence.js";
import { validateTelemetry } from "../utils/telemetry.js";
import { FallDetector } from "../utils/fallDetector.js";

const now = Date.now();
test("location confidence: valid / stale / missing / invalid", () => {
  assert.equal(assessLocation({ lat: 12.9, lng: 77.5, accuracy: 10, timestamp: new Date(now - 5000), source: "browser GPS" }, now).status, "RELIABLE");
  assert.equal(assessLocation({ lat: 12.9, lng: 77.5, accuracy: 300, timestamp: new Date(now - 5000), source: "x" }, now).status, "APPROXIMATE");
  assert.equal(assessLocation({ lat: 12.9, lng: 77.5, timestamp: new Date(now - 5000), source: "x" }, now).accuracyM, null); // never invented
  assert.equal(assessLocation({ lat: 12.9, lng: 77.5, timestamp: new Date(now - 5000), source: "x" }, now).status, "APPROXIMATE");
  assert.equal(assessLocation({ lat: 12.9, lng: 77.5, accuracy: 5, timestamp: new Date(now - 120000), source: "x" }, now).status, "STALE");
  assert.equal(assessLocation(null, now).status, "UNAVAILABLE");
  assert.equal(assessLocation({ lat: 0, lng: 0, timestamp: new Date(now), source: "x" }, now).status, "UNAVAILABLE");
  assert.equal(assessLocation({ lat: 999, lng: 1, timestamp: new Date(now), source: "x" }, now).status, "UNAVAILABLE");
  assert.equal(assessLocation({ fix: false, source: "x" }, now).status, "UNAVAILABLE");
});
test("telemetry validation rejects malformed data", () => {
  assert.equal(validateTelemetry({ deviceId: "d1", gps: { fix: true, lat: 200, lng: 1 } }).ok, false);
  assert.equal(validateTelemetry({ deviceId: "d1", accel: { x: "a", y: 0, z: 1 } }).ok, false);
  assert.equal(validateTelemetry({ deviceId: "d1", spo2: 12 }).ok, false);
  assert.equal(validateTelemetry({ source: "hardware" }).ok, false);
  assert.equal(validateTelemetry({ deviceId: "d1", gps: { fix: true, lat: 12.9, lng: 77.5 }, accel: { x: 0, y: 0, z: 1 } }).ok, true);
});
function run(seq, d = new FallDetector({ confirmWindowS: 5 })) { // seq of g magnitudes @100ms (synthetic data)
  seq.forEach((g, i) => d.push({ x: 0, y: 0, z: g }, 1000 + i * 100)); return d;
}
const calm = (n) => Array.from({ length: n }, (_, i) => 1 + (i % 2 ? 0.03 : -0.03));
test("fall detector: synthetic fall -> confirmation -> auto escalate; cancel works", () => {
  const d = run([...calm(15), 0.3, 0.3, 3.4, ...calm(25)]);
  assert.equal(d.state, "USER_CONFIRMATION_REQUIRED");
  assert.equal(d.evidence.freeFallSeen, true);
  assert.equal(d.tick(d.deadline - 1), false);
  assert.equal(d.tick(d.deadline + 1), true);
  assert.equal(d.state, "SOS_CONFIRMED");
  const d2 = run([...calm(15), 3.4, ...calm(25)]);
  assert.equal(d2.cancel(), true); assert.equal(d2.state, "NORMAL");
});
test("fall detector: spike followed by continued movement is NOT a fall; walking is normal", () => {
  const moving = Array.from({ length: 40 }, (_, i) => 1 + Math.sin(i) * 0.6);
  assert.equal(run([...calm(15), 3.4, ...moving]).state, "NORMAL");
  assert.equal(run(Array.from({ length: 80 }, (_, i) => 1 + Math.sin(i / 2) * 0.5)).state, "NORMAL");
});
