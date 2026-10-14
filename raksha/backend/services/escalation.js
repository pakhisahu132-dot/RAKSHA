import { createIncident } from "./incidents.js";
import { saveTrip } from "../data/store.js";

/** Runs the real escalation flow for a trip exactly once (idempotent via trip.incidentId + clientEventId). */
export function escalateTrip(trip, reason = "Check-in window missed", type = "CHECKIN_MISSED") {
  if (trip.incidentId) return { incidentId: trip.incidentId, duplicate: true };
  const live = trip.positionSource === "browser";
  const { incident, duplicate } = createIncident({
    type, userId: trip.userId, clientEventId: `checkin:${trip.id}`, tripId: trip.id, contactIds: trip.contactIds,
    positionOverride: live ? { lat: trip.currentPosition[0], lng: trip.currentPosition[1], accuracy: trip.accuracyM, timestamp: trip.positionAt, source: "browser GPS (trip)" } : null,
    landmarkNote: `Destination: ${trip.destination}. ${reason}`,
  });
  trip.incidentId = incident.id; trip.status = "escalated"; trip.escalatedAt ||= new Date().toISOString(); saveTrip(trip);
  return { incidentId: incident.id, duplicate };
}
