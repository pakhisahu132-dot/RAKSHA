import { Router } from "express";
import { createIncident, getIncident, listIncidents, buildCard, getSummary, resolveIncident } from "../services/incidents.js";
import { listAlerts, retryAlert, acknowledge, pendingCount, mode } from "../services/delivery.js";
import * as device from "../services/device.js";
import { validateTelemetry } from "../utils/telemetry.js";
import { assessLocation } from "../utils/locationConfidence.js";
import { db } from "../db.js";
import { listActiveTripsForUser } from "../data/store.js";

const router = Router();
const devAuth = (req, res, next) => {
  const k = process.env.DEVICE_API_KEY;
  if (k && req.get("x-device-key") !== k) return res.status(401).json({ error: "Invalid device key" });
  next();
};
const MANUAL = ["MANUAL_SOS", "HARDWARE_TOUCH_SOS"];

// ---- SOS / incidents ----
router.post("/sos", (req, res) => {
  const b = req.body || {};
  const type = b.type ?? "MANUAL_SOS";
  if (!MANUAL.includes(type)) return res.status(400).json({ error: `type must be one of ${MANUAL.join(", ")}` });
  if (type === "HARDWARE_TOUCH_SOS" && !device.isConnected()) return res.status(409).json({ error: "Hardware touch SOS requires a connected device" });
  if (b.clientEventId !== undefined && !/^[\w:.-]{6,80}$/.test(b.clientEventId)) return res.status(400).json({ error: "clientEventId must be 6-80 chars" });
  if (b.location && typeof b.location !== "object") return res.status(400).json({ error: "location must be an object" });
  const { incident, duplicate } = createIncident({ type, userId: b.userId || "demo-user", clientEventId: b.clientEventId,
    location: b.location, contactIds: Array.isArray(b.contactIds) ? b.contactIds : undefined, landmarkNote: typeof b.landmarkNote === "string" ? b.landmarkNote : undefined });
  res.status(duplicate ? 200 : 201).json({ incident, duplicate });
});
router.get("/incidents", (req, res) => res.json({ incidents: listIncidents(req.query.userId || "demo-user") }));
router.get("/incidents/:id", (req, res) => {
  const incident = getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  const events = db.prepare("SELECT ts, event, detail FROM events WHERE entity_id=? ORDER BY id").all(req.params.id);
  res.json({ incident, events });
});
router.get("/incidents/:id/card", (req, res) => {
  const incident = getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  res.json(buildCard(incident));
});
router.get("/incidents/:id/summary", (req, res) => {
  const s = getSummary(req.params.id);
  s ? res.json(s) : res.status(404).json({ error: "Incident not found" });
});
router.post("/incidents/:id/resolve", (req, res) => {
  const i = resolveIncident(req.params.id);
  i ? res.json({ incident: i }) : res.status(404).json({ error: "Incident not found" });
});

// ---- Alerts ----
router.get("/alerts", (req, res) => res.json({ alerts: req.query.incidentId ? listAlerts(req.query.incidentId) : [], pending: pendingCount(), deliveryMode: mode() }));
router.post("/alerts/:id/retry", (req, res) => retryAlert(req.params.id) ? res.json({ ok: true }) : res.status(409).json({ error: "Only FAILED alerts with a channel can be retried" }));
// Contact opens this link (included in the Telegram message when PUBLIC_BASE_URL is set) to acknowledge.
router.get("/alerts/ack/:token", (req, res) => {
  const a = acknowledge(req.params.token);
  res.status(a ? 200 : 404).type("html").send(a ? "<h3>Thanks — acknowledgement recorded.</h3>" : "<h3>Link invalid or alert not yet sent.</h3>");
});

// ---- Device ----
router.post("/device/telemetry", devAuth, (req, res) => {
  const v = validateTelemetry(req.body);
  if (!v.ok) return res.status(400).json({ error: "Invalid telemetry", details: v.errors });
  device.ingest(v.value);
  res.json({ ok: true });
});
router.get("/device/status", (req, res) => res.json(device.status()));
router.post("/device/simulate", (req, res) => res.json({ simulationEnabled: device.setSimulation(!!req.body?.enabled) }));
router.post("/device/simulate/fall", (req, res) => device.injectSyntheticFall() ? res.json({ ok: true }) : res.status(409).json({ error: "Enable demo mode first" }));
router.post("/device/fall/cancel", (req, res) => res.json({ cancelled: device.cancelFall() }));
router.post("/device/fall/confirm", (req, res) => device.confirmFallNow() ? res.json({ ok: true }) : res.status(409).json({ error: "No fall awaiting confirmation" }));
router.get("/device/readings", (req, res) =>
  res.json({ readings: db.prepare("SELECT ts, source, spo2, temp_c AS tempC FROM readings ORDER BY id DESC LIMIT 50").all() }));

// ---- Location (stateless assessment; nothing stored) ----
router.post("/location/assess", (req, res) => res.json(assessLocation(req.body?.location)));

// ---- Aggregated status for UI ----
router.get("/status", (req, res) => res.json({ ...device.status(), pendingAlerts: pendingCount(), sharing: { activeTrips: listActiveTripsForUser("demo-user").filter((t) => t.status === "in_progress").length }, deliveryMode: mode(), serverTime: new Date().toISOString() }));

export default router;
