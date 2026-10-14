// Strict validation of device telemetry. Returns {ok, errors, value}. Malformed data is rejected, not guessed.
const num = (v) => typeof v === "number" && Number.isFinite(v);
export function validateTelemetry(b) {
  const errors = [];
  if (!b || typeof b !== "object") return { ok: false, errors: ["Body must be a JSON object"] };
  if (typeof b.deviceId !== "string" || !/^[\w.-]{1,40}$/.test(b.deviceId)) errors.push("deviceId must be 1-40 chars [A-Za-z0-9_.-]");
  const source = b.source ?? "hardware";
  if (!["hardware", "simulated"].includes(source)) errors.push("source must be 'hardware' or 'simulated'");
  let ts = Date.now();
  if (b.timestamp !== undefined) {
    const t = new Date(b.timestamp).getTime();
    if (!Number.isFinite(t) || t > Date.now() + 60000) errors.push("timestamp invalid or in the future");
    else ts = t;
  }
  const v = { deviceId: b.deviceId, source, ts };
  if (b.gps !== undefined) {
    const g = b.gps;
    if (!g || typeof g !== "object" || typeof g.fix !== "boolean") errors.push("gps.fix (boolean) required when gps present");
    else if (g.fix) {
      if (!num(g.lat) || !num(g.lng) || Math.abs(g.lat) > 90 || Math.abs(g.lng) > 180 || (g.lat === 0 && g.lng === 0)) errors.push("gps lat/lng invalid");
      else if (g.accuracy !== undefined && (!num(g.accuracy) || g.accuracy < 0)) errors.push("gps.accuracy must be >= 0");
      else v.gps = { fix: true, lat: g.lat, lng: g.lng, accuracy: g.accuracy ?? null, satellites: Number.isInteger(g.satellites) ? g.satellites : null };
    } else v.gps = { fix: false };
  }
  if (b.accel !== undefined) {
    const a = b.accel; // units: g
    if (!a || ![a.x, a.y, a.z].every(num) || Math.hypot(a.x, a.y, a.z) > 40) errors.push("accel x/y/z must be finite numbers in g (|a| <= 40)");
    else v.accel = { x: a.x, y: a.y, z: a.z };
  }
  if (b.spo2 !== undefined && b.spo2 !== null) (num(b.spo2) && b.spo2 >= 50 && b.spo2 <= 100) ? (v.spo2 = b.spo2) : errors.push("spo2 must be 50-100");
  if (b.tempC !== undefined && b.tempC !== null) (num(b.tempC) && b.tempC >= 20 && b.tempC <= 45) ? (v.tempC = b.tempC) : errors.push("tempC must be 20-45");
  return errors.length ? { ok: false, errors } : { ok: true, value: v };
}
