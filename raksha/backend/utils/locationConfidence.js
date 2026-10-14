// Location Confidence Engine. Never invents accuracy: thresholds apply only when accuracy is supplied.
export const STALE_AFTER_S = Number(process.env.GPS_STALE_AFTER_S || 60);
export const RELIABLE_MAX_ACCURACY_M = Number(process.env.GPS_RELIABLE_M || 50);

export const validCoords = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0); // (0,0) is the classic "no fix" artifact

/** @param loc {lat,lng,accuracy?,timestamp?,source,fix?,simulated?} */
export function assessLocation(loc, nowMs = Date.now()) {
  const base = { status: "UNAVAILABLE", lat: null, lng: null, accuracyM: null, ageSeconds: null,
    source: loc?.source ?? null, timestamp: null, simulated: !!loc?.simulated, reason: "" };
  if (!loc) return { ...base, reason: "No location received" };
  if (loc.fix === false) return { ...base, reason: "GPS has no fix" };
  const lat = Number(loc.lat), lng = Number(loc.lng);
  if (loc.lat == null || loc.lng == null || !validCoords(lat, lng)) return { ...base, reason: "Invalid or missing coordinates" };
  const ts = loc.timestamp ? new Date(loc.timestamp).getTime() : NaN;
  if (!Number.isFinite(ts)) return { ...base, reason: "No timestamp, freshness unknown" };
  const age = Math.max(0, Math.round((nowMs - ts) / 1000));
  const accuracy = Number.isFinite(Number(loc.accuracy)) && loc.accuracy !== null ? Number(loc.accuracy) : null;
  const out = { ...base, lat, lng, accuracyM: accuracy, ageSeconds: age, timestamp: new Date(ts).toISOString() };
  if (age > STALE_AFTER_S) return { ...out, status: "STALE", reason: `Last update ${age}s ago` };
  if (accuracy === null) return { ...out, status: "APPROXIMATE", reason: "No accuracy estimate supplied" };
  if (accuracy <= RELIABLE_MAX_ACCURACY_M) return { ...out, status: "RELIABLE", reason: `±${Math.round(accuracy)} m, ${age}s old` };
  return { ...out, status: "APPROXIMATE", reason: `Low accuracy ±${Math.round(accuracy)} m` };
}

const RANK = { RELIABLE: 3, APPROXIMATE: 2, STALE: 1, UNAVAILABLE: 0 };
export const bestLocation = (assessed) =>
  assessed.filter(Boolean).sort((a, b) => RANK[b.status] - RANK[a.status] || (a.ageSeconds ?? 1e9) - (b.ageSeconds ?? 1e9))[0]
  || assessLocation(null);
