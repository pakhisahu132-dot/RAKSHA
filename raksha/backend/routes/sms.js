import { Router } from "express";
import { users, getTrip } from "../data/store.js";
import { formatEmergencySms, simulateConnectivityCheck } from "../utils/smsFallback.js";

const router = Router();

// POST /api/sms/check-connectivity  { signalStrength: 0-100 }
router.post("/check-connectivity", (req, res) => {
  const { signalStrength = 100 } = req.body || {};
  res.json(simulateConnectivityCheck(Number(signalStrength)));
});

// POST /api/sms/fallback  { tripId, contactIds, reason }
router.post("/fallback", (req, res) => {
  const { tripId, contactIds = [], reason = "Manual SOS triggered" } = req.body;
  const trip = getTrip(tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  const user = users.find((u) => u.id === trip.userId);
  const targetIds = contactIds.length ? contactIds : trip.contactIds;
  const contacts = (user?.trustedContacts || []).filter((c) => targetIds.includes(c.id));

  const payloads = contacts.map((contact) => formatEmergencySms({ contact, trip, reason }));
  res.json({ payloads });
});

export default router;
