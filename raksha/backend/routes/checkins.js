import { Router } from "express";
import { createTrip, getTrip, listActiveTripsForUser, confirmTrip, cancelTrip, updateTripPosition, users } from "../data/store.js";
import { formatEmergencySms } from "../utils/smsFallback.js";
import { escalateTrip } from "../services/escalation.js";
import { getIncident } from "../services/incidents.js";
import { db } from "../db.js";
import { validCoords } from "../utils/locationConfidence.js";

const router = Router();
const withIncident = (trip) => ({ ...trip, incident: trip.incidentId ? getIncident(trip.incidentId) : null });

router.post("/start", (req, res) => {
  const { userId = "demo-user", routeId, destination, windowMinutes = 20, contactIds = [] } = req.body;
  if (!destination) return res.status(400).json({ error: "destination is required" });
  const mins = Number(windowMinutes);
  if (!Number.isFinite(mins) || mins <= 0 || mins > 720) return res.status(400).json({ error: "windowMinutes must be 1-720" });
  res.status(201).json({ trip: createTrip({ userId, routeId, destination, windowMinutes: mins, contactIds }) });
});
router.get("/active/:userId", (req, res) => res.json({ trips: listActiveTripsForUser(req.params.userId) }));
router.get("/:tripId", (req, res) => {
  const trip = getTrip(req.params.tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  res.json({ trip: withIncident(trip) });
});
router.get("/:tripId/events", (req, res) =>
  res.json({ events: db.prepare("SELECT ts, event, detail FROM events WHERE entity_id=? ORDER BY id").all(req.params.tripId) }));
router.post("/:tripId/location", (req, res) => {
  const { lat, lng, accuracy } = req.body || {};
  if (!validCoords(lat, lng)) return res.status(400).json({ error: "Invalid coordinates" });
  const t = updateTripPosition(req.params.tripId, lat, lng, Number.isFinite(accuracy) ? accuracy : null);
  if (!t) return res.status(404).json({ error: "No in-progress trip" });
  res.json({ ok: true });
});
router.post("/:tripId/confirm", (req, res) => {
  const trip = confirmTrip(req.params.tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  res.json({ trip: withIncident(trip) });
});
router.post("/:tripId/cancel", (req, res) => {
  const trip = cancelTrip(req.params.tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  res.json({ trip: withIncident(trip) });
});
// Manual panic from a trip, or explicit escalation. Idempotent: never creates a second incident for one trip.
router.post("/:tripId/escalate", (req, res) => {
  const trip = getTrip(req.params.tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  const reason = req.body?.reason || "Manual escalation";
  const { incidentId, duplicate } = escalateTrip(trip, reason, req.body?.manual ? "MANUAL_SOS" : "CHECKIN_MISSED");
  const user = users.find((u) => u.id === trip.userId);
  const contacts = (user?.trustedContacts || []).filter((c) => trip.contactIds.includes(c.id));
  const smsPayloads = contacts.map((contact) => formatEmergencySms({ contact, trip, reason }));
  res.json({ trip: withIncident(trip), duplicate, smsPayloads });
});
export default router;
