// In-memory data layer for RAKSHA.
// Swappable for SQLite/Prisma later — every accessor here maps 1:1 to what a
// real repository layer would expose, so routes never touch raw arrays.

import { nanoid } from "nanoid";
import { db, logEvent } from "../db.js";

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = [
  {
    id: "demo-user",
    name: "Ananya Rao",
    email: "ananya.rao@example.com",
    trustedContacts: [
      { id: "tc-1", name: "Meera Rao (Mother)", phone: "+91 98765 43210", relation: "Parent" },
      { id: "tc-2", name: "Kabir Shah", phone: "+91 91234 56789", relation: "Partner" },
      { id: "tc-3", name: "Priya Nair", phone: "+91 99887 66554", relation: "Friend" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Burden score history (seeded with 14 days of realistic entries)
// ---------------------------------------------------------------------------
export const burdenEntries = Array.from({ length: 14 }).map((_, i) => {
  const domesticHours = 2 + Math.round(Math.sin(i / 2) * 1.5 + 1.5);
  const caregivingHours = 1 + (i % 4);
  const emotionalLabor = 4 + (i % 5);
  const workplacePressure = 3 + ((i * 2) % 6);
  const sleepHours = 7 - (i % 3) * 0.7;
  const interruptions = i % 8;
  return {
    id: `burden-${i}`,
    userId: "demo-user",
    date: new Date(now - (13 - i) * day).toISOString(),
    domesticHours,
    caregivingHours,
    emotionalLabor,
    workplacePressure,
    sleepHours,
    interruptions,
    score: null, // computed on read via utils/aiHeuristics
  };
});

// ---------------------------------------------------------------------------
// Health timeline
// ---------------------------------------------------------------------------
export const healthEntries = [
  { id: "h-1", userId: "demo-user", date: new Date(now - 34 * day).toISOString(), type: "cycle_start", label: "Cycle started", flow: "medium", symptoms: ["cramps", "fatigue"], mood: 5, stress: 6 },
  { id: "h-2", userId: "demo-user", date: new Date(now - 30 * day).toISOString(), type: "cycle_end", label: "Cycle ended", symptoms: [], mood: 7, stress: 4 },
  { id: "h-3", userId: "demo-user", date: new Date(now - 20 * day).toISOString(), type: "ovulation", label: "Predicted ovulation window", symptoms: ["mild cramping"], mood: 8, stress: 3 },
  { id: "h-4", userId: "demo-user", date: new Date(now - 14 * day).toISOString(), type: "wellness_note", label: "Migraine logged", symptoms: ["headache", "light sensitivity"], mood: 4, stress: 7 },
  { id: "h-5", userId: "demo-user", date: new Date(now - 6 * day).toISOString(), type: "cycle_start", label: "Cycle started", flow: "heavy", symptoms: ["cramps", "bloating", "fatigue"], mood: 4, stress: 6 },
  { id: "h-6", userId: "demo-user", date: new Date(now - 1 * day).toISOString(), type: "checkup", label: "Annual wellness checkup completed", symptoms: [], mood: 8, stress: 2 },
];

// ---------------------------------------------------------------------------
// Campus Whisper reports
// ---------------------------------------------------------------------------
export const whisperReports = [
  {
    id: "wr-1",
    text: "Someone followed me from the library parking lot to the east gate. He kept his distance but matched my pace for almost ten minutes.",
    location: { lat: 22.7218, lng: 75.8636, label: "East Gate, Library Rd" },
    createdAt: new Date(now - 5 * day).toISOString(),
    category: "Stalking",
    severity: 9,
    status: "verified",
  },
  {
    id: "wr-2",
    text: "The path behind the engineering block has no working streetlights. Completely dark by 7pm, hard to see the ground.",
    location: { lat: 22.7245, lng: 75.8701, label: "Engineering Block Rear Path" },
    createdAt: new Date(now - 3 * day).toISOString(),
    category: "Poor Lighting",
    severity: 5,
    status: "verified",
  },
  {
    id: "wr-3",
    text: "A group of men were catcalling and making comments to women walking past the canteen around lunchtime. Made me really uncomfortable.",
    location: { lat: 22.7202, lng: 75.8659, label: "Central Canteen" },
    createdAt: new Date(now - 2 * day).toISOString(),
    category: "Harassment",
    severity: 7,
    status: "under_review",
  },
  {
    id: "wr-4",
    text: "Two unfamiliar men were loitering near the hostel back gate late at night, watching people enter and leave.",
    location: { lat: 22.7189, lng: 75.8611, label: "Hostel Back Gate" },
    createdAt: new Date(now - 1 * day).toISOString(),
    category: "Suspicious Activity",
    severity: 6,
    status: "under_review",
  },
];

// ---------------------------------------------------------------------------
// Route path segments used by the Safe Route / Comfort Index engine.
// Each named route is a small graph of waypoints with independent metrics.
// ---------------------------------------------------------------------------
export const routeSegments = [
  {
    id: "route-fast",
    name: "Fastest Route",
    distanceKm: 1.4,
    etaMinutes: 17,
    path: [
      [22.7189, 75.8611],
      [22.7205, 75.8628],
      [22.7222, 75.8649],
      [22.7218, 75.8636],
    ],
    lighting: 3,
    policePresence: 2,
    openBusinesses: 2,
    reportsNearby: 3,
    footTraffic: 3,
  },
  {
    id: "route-balanced",
    name: "Balanced Route",
    distanceKm: 1.7,
    etaMinutes: 21,
    path: [
      [22.7189, 75.8611],
      [22.7196, 75.8635],
      [22.7202, 75.8659],
      [22.7218, 75.8636],
    ],
    lighting: 6,
    policePresence: 5,
    openBusinesses: 6,
    reportsNearby: 1,
    footTraffic: 6,
  },
  {
    id: "route-safest",
    name: "Highest-comfort Route (estimate)",
    distanceKm: 2.1,
    etaMinutes: 27,
    path: [
      [22.7189, 75.8611],
      [22.7178, 75.8642],
      [22.7192, 75.8671],
      [22.7202, 75.8659],
      [22.7218, 75.8636],
    ],
    lighting: 9,
    policePresence: 8,
    openBusinesses: 8,
    reportsNearby: 0,
    footTraffic: 8,
  },
];

// ---------------------------------------------------------------------------
// Heatmap points (independent of whisper reports, includes ambient sensors)
// ---------------------------------------------------------------------------
export const heatmapPoints = [
  { lat: 22.7218, lng: 75.8636, intensity: 0.9, label: "East Gate, Library Rd" },
  { lat: 22.7245, lng: 75.8701, intensity: 0.55, label: "Engineering Block Rear Path" },
  { lat: 22.7202, lng: 75.8659, intensity: 0.7, label: "Central Canteen" },
  { lat: 22.7189, lng: 75.8611, intensity: 0.6, label: "Hostel Back Gate" },
  { lat: 22.7178, lng: 75.8642, intensity: 0.15, label: "Main Avenue" },
  { lat: 22.7192, lng: 75.8671, intensity: 0.2, label: "Sports Complex Rd" },
  { lat: 22.7233, lng: 75.8615, intensity: 0.35, label: "North Parking" },
  { lat: 22.7160, lng: 75.8630, intensity: 0.1, label: "Faculty Housing" },
];

// ---------------------------------------------------------------------------
// Live trips / Smart Check-ins / Trusted Companion state
// ---------------------------------------------------------------------------
export const activeTrips = new Map();
// Trips persist in SQLite so check-ins survive a restart.
const saveTrip = (t) => db.prepare("INSERT OR REPLACE INTO trips (id, json) VALUES (?,?)").run(t.id, JSON.stringify(t));
for (const r of db.prepare("SELECT json FROM trips").all()) { const t = JSON.parse(r.json); activeTrips.set(t.id, t); }
export { saveTrip };

export function createTrip({ userId, routeId, destination, windowMinutes, contactIds }) {
  const route = routeSegments.find((r) => r.id === routeId) || routeSegments[1];
  const id = nanoid(10);
  const trip = {
    id, userId, routeId, routeName: route.name, destination, path: route.path, progressIndex: 0,
    startedAt: new Date().toISOString(),
    expectedArrival: new Date(Date.now() + windowMinutes * 60 * 1000).toISOString(),
    windowMinutes, contactIds,
    status: "in_progress", // in_progress | confirmed | escalated | cancelled
    checkinDeadline: Date.now() + windowMinutes * 60 * 1000,
    escalatedAt: null, currentPosition: route.path[0],
    positionSource: "simulated", // "simulated" route progress unless the browser sends real GPS
    lastLiveAt: 0, incidentId: null,
  };
  activeTrips.set(id, trip); saveTrip(trip); logEvent("trip", id, "CHECKIN_STARTED", { destination, windowMinutes });
  return trip;
}

export const getTrip = (id) => activeTrips.get(id) || null;
export const listActiveTripsForUser = (userId) => Array.from(activeTrips.values()).filter((t) => t.userId === userId);

/** Real position from browser GPS. Overrides simulated progress while updates keep arriving. */
export function updateTripPosition(id, lat, lng, accuracy) {
  const t = activeTrips.get(id);
  if (!t || t.status !== "in_progress") return null;
  t.currentPosition = [lat, lng]; t.positionSource = "browser"; t.lastLiveAt = Date.now();
  t.accuracyM = accuracy ?? null; t.positionAt = new Date().toISOString(); saveTrip(t);
  return t;
}

/** Returns trips that newly missed their deadline so the caller can run the real escalation flow once. */
export function advanceTripSimulation() {
  const nowTs = Date.now(), escalated = [];
  for (const trip of activeTrips.values()) {
    if (trip.status !== "in_progress") continue;
    const live = nowTs - trip.lastLiveAt < 15000;
    if (!live && trip.progressIndex < trip.path.length - 1) {
      trip.progressIndex += 1; trip.currentPosition = trip.path[trip.progressIndex]; trip.positionSource = "simulated";
    }
    if (nowTs > trip.checkinDeadline) { trip.status = "escalated"; trip.escalatedAt = new Date().toISOString(); escalated.push(trip); logEvent("trip", trip.id, "CHECKIN_MISSED"); }
    saveTrip(trip);
  }
  return escalated;
}

export function confirmTrip(id) {
  const t = activeTrips.get(id); if (!t) return null;
  if (t.status === "in_progress" || t.status === "escalated") { t.status = "confirmed"; t.confirmedAt = new Date().toISOString(); saveTrip(t); logEvent("trip", id, "CHECKIN_CONFIRMED"); }
  return t;
}
export function cancelTrip(id) {
  const t = activeTrips.get(id); if (!t) return null;
  if (t.status === "in_progress") { t.status = "cancelled"; saveTrip(t); logEvent("trip", id, "CHECKIN_CANCELLED"); }
  return t;
}
