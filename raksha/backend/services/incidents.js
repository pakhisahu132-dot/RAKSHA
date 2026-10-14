import { nanoid } from "nanoid";
import { db, logEvent } from "../db.js";
import { users } from "../data/store.js";
import { assessLocation, bestLocation } from "../utils/locationConfidence.js";
import { deterministicSummary, aiSummary } from "../utils/summary.js";
import * as device from "./device.js";
import { queueAlerts, listAlerts } from "./delivery.js";

const COOLDOWN_MS = Number(process.env.SOS_COOLDOWN_S || 30) * 1000;

const mapLink = (l) => (l.lat != null ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : null);

export function toIncident(r) {
  if (!r) return null;
  const sensors = JSON.parse(r.sensors);
  const inc = { id: r.id, type: r.type, userId: r.user_id, createdAt: r.created_at, status: r.status, simulated: !!r.simulated,
    tripId: r.trip_id, location: JSON.parse(r.location), sensors, device: JSON.parse(r.device),
    contactIds: JSON.parse(r.contact_ids), landmarkNote: r.landmark_note, fallEvidence: sensors.fall || null };
  inc.alerts = listAlerts(r.id);
  return inc;
}
export const getIncident = (id) => toIncident(db.prepare("SELECT * FROM incidents WHERE id=?").get(id));
export const listIncidents = (userId, limit = 50) =>
  db.prepare("SELECT * FROM incidents WHERE user_id=? ORDER BY created_at DESC LIMIT ?").all(userId, limit).map(toIncident);

export function buildCard(inc) {
  const l = inc.location, s = inc.sensors;
  const card = { incidentId: inc.id, type: inc.type, timestamp: inc.createdAt, simulated: inc.simulated,
    coordinates: l.lat != null ? { lat: l.lat, lng: l.lng } : null, mapLink: mapLink(l),
    location: { status: l.status, ageSeconds: l.ageSeconds, accuracyM: l.accuracyM, source: l.source, reason: l.reason },
    sensors: { source: s.source, accel: s.accel, spo2: s.spo2, tempC: s.tempC, connectivity: s.connectivity },
    delivery: inc.alerts.map((a) => ({ recipient: a.recipient, channel: a.channel, status: a.status, sentAt: a.sentAt })),
    landmarkNote: inc.landmarkNote ? `${inc.landmarkNote} (user-supplied, unverified)` : null,
    disclaimer: "Prototype sensors, not medical-grade. Delivery shows only the listed channels; no emergency-service dispatch is implied." };
  const t = [
    `${inc.simulated ? "[SIMULATED DEMO] " : ""}RAKSHA incident ${inc.id}`, `${inc.type.replace(/_/g, " ")} — ${inc.createdAt}`,
    l.lat != null ? `Location: ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)} [${l.status}${l.ageSeconds != null ? `, ${l.ageSeconds}s old` : ""}, ${l.source}]` : `Location: UNAVAILABLE (${l.reason})`,
    mapLink(l) ? `Map: ${mapLink(l)}` : null,
    `Accel: ${s.accel ? `${s.accel.x.toFixed(2)}, ${s.accel.y.toFixed(2)}, ${s.accel.z.toFixed(2)} g` : "Unavailable"} | SpO2: ${s.spo2 ?? "Unavailable"} | Temp: ${s.tempC ?? "Unavailable"}`,
    card.landmarkNote ? `Note: ${card.landmarkNote}` : null,
  ].filter(Boolean);
  return { card, text: t.join("\n") };
}

export function createIncident({ type, userId = "demo-user", clientEventId, location, contactIds, landmarkNote, tripId, positionOverride, fallEvidence, simulated }) {
  const key = clientEventId || null;
  if (key) { const ex = db.prepare("SELECT id FROM incidents WHERE client_event_id=?").get(key); if (ex) return { incident: getIncident(ex.id), duplicate: true }; }
  const recent = db.prepare("SELECT id FROM incidents WHERE user_id=? AND type=? AND created_at > ? AND status='OPEN' ORDER BY created_at DESC")
    .get(userId, type, new Date(Date.now() - COOLDOWN_MS).toISOString());
  if (recent && !String(key).startsWith("checkin:")) return { incident: getIncident(recent.id), duplicate: true };

  const now = Date.now();
  const ev = device.evidence(now);
  const cands = [];
  if (location) cands.push(assessLocation({ ...location, source: location.source || "browser GPS" }, now));
  if (positionOverride) cands.push(assessLocation(positionOverride, now));
  cands.push(device.deviceLocation(now));
  const loc = bestLocation(cands);
  const sim = simulated ?? (loc.simulated || (!location && ev.source === "simulated"));
  const user = users.find((u) => u.id === userId);
  const all = user?.trustedContacts || [];
  const chosen = contactIds?.length ? all.filter((c) => contactIds.includes(c.id)) : all;
  const id = "inc_" + nanoid(10);
  const sensors = { ...ev, ...(fallEvidence ? { fall: fallEvidence } : {}) };
  const deviceInfo = { connectivity: ev.connectivity, source: ev.source, deviceId: ev.deviceId ?? null, lastSeen: ev.lastSeen };
  const createdAt = new Date(now).toISOString();

  db.transaction(() => {
    db.prepare(`INSERT INTO incidents (id, client_event_id, type, user_id, created_at, simulated, trip_id, location, sensors, device, contact_ids, landmark_note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, key, type, userId, createdAt, sim ? 1 : 0, tripId || null, JSON.stringify(loc),
      JSON.stringify(sensors), JSON.stringify(deviceInfo), JSON.stringify(chosen.map((c) => c.id)), landmarkNote?.slice(0, 200) || null);
    logEvent("incident", id, "INCIDENT_CREATED", { type, locationStatus: loc.status, simulated: sim });
  })();
  const inc = getIncident(id);
  queueAlerts(inc, chosen, async (alert) => {
    const cur = getIncident(id); const { text } = buildCard(cur);
    const base = process.env.PUBLIC_BASE_URL;
    return text + (base ? `\nAcknowledge: ${base}/api/alerts/ack/${db.prepare("SELECT ack_token t FROM alerts WHERE id=?").get(alert.id).t}` : "");
  });
  // Optional AI summary: fire-and-forget, never blocks SOS.
  aiSummary(inc).then((s) => s && db.prepare("UPDATE incidents SET summary_ai=? WHERE id=?").run(s, id)).catch(() => {});
  return { incident: getIncident(id), duplicate: false };
}

export function getSummary(id) {
  const inc = getIncident(id); if (!inc) return null;
  const ai = db.prepare("SELECT summary_ai FROM incidents WHERE id=?").get(id).summary_ai;
  return ai ? { source: "ai", text: ai, facts: deterministicSummary(inc) } : { source: "deterministic", text: deterministicSummary(inc) };
}
export function resolveIncident(id) {
  const r = db.prepare("UPDATE incidents SET status='RESOLVED' WHERE id=? AND status='OPEN'").run(id);
  if (r.changes) logEvent("incident", id, "INCIDENT_RESOLVED");
  return getIncident(id);
}
