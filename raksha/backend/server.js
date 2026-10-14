import "./env.js";
import express from "express";
import cors from "cors";

import { advanceTripSimulation } from "./data/store.js";
import emergencyRoutes from "./routes/emergency.js";
import { processQueue, recoverOnBoot } from "./services/delivery.js";
import { escalateTrip } from "./services/escalation.js";
import { onFallConfirmed } from "./services/device.js";
import { createIncident, getIncident } from "./services/incidents.js";
import { db } from "./db.js";
import burdenRoutes from "./routes/burden.js";
import healthRoutes from "./routes/health.js";
import whisperRoutes from "./routes/whisper.js";
import routeRoutes from "./routes/routes.js";
import checkinRoutes from "./routes/checkins.js";
import smsRoutes from "./routes/sms.js";
import heatmapRoutes from "./routes/heatmap.js";
import userRoutes from "./routes/users.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/api/health-check", (req, res) => {
  res.json({ status: "ok", service: "RAKSHA API", time: new Date().toISOString() });
});

app.use("/api/burden", burdenRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/whisper", whisperRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/heatmap", heatmapRoutes);
app.use("/api/users", userRoutes);
app.use("/api", emergencyRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

recoverOnBoot();

// A confirmed (un-cancelled) possible fall becomes a real incident. Manual SOS stays available regardless.
onFallConfirmed((source, evidence) =>
  createIncident({ type: "POSSIBLE_FALL_SOS", clientEventId: `fall:${source}:${Date.now()}`, fallEvidence: evidence, simulated: source === "simulated" }));

// Check-in tick: simulated route progress (only when no live GPS) + REAL escalation for missed windows.
setInterval(() => { for (const t of advanceTripSimulation()) { try { escalateTrip(t); } catch (e) { console.error("escalation failed", e); } } }, 4000);

// Delivery worker: picks up queued / retry-due alerts (also resumes after restart or reconnect).
const messageFor = async (alert) => {
  const { buildCard } = await import("./services/incidents.js");
  const inc = getIncident(alert.incident_id);
  const base = process.env.PUBLIC_BASE_URL;
  return buildCard(inc).text + (base ? `\nAcknowledge: ${base}/api/alerts/ack/${alert.ack_token}` : "");
};
setInterval(() => processQueue(messageFor).catch((e) => console.error("queue", e)), 1500);

app.listen(PORT, () => {
  console.log(`RAKSHA API listening on http://localhost:${PORT}`);
});
