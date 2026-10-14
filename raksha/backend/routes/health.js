import { Router } from "express";
import { nanoid } from "nanoid";
import { healthEntries } from "../data/store.js";
import { predictNextCycle } from "../utils/aiHeuristics.js";

const router = Router();

// GET /api/health/timeline/:userId
router.get("/timeline/:userId", (req, res) => {
  const entries = healthEntries
    .filter((e) => e.userId === req.params.userId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json({ entries });
});

// GET /api/health/predict/:userId
router.get("/predict/:userId", (req, res) => {
  const entries = healthEntries.filter((e) => e.userId === req.params.userId);
  const prediction = predictNextCycle(entries);
  res.json(prediction);
});

// POST /api/health/entry
router.post("/entry", (req, res) => {
  const { userId = "demo-user", type, label, flow, symptoms = [], mood, stress } = req.body;
  if (!type || !label) {
    return res.status(400).json({ error: "type and label are required" });
  }
  const entry = {
    id: nanoid(8),
    userId,
    date: new Date().toISOString(),
    type,
    label,
    flow: flow || null,
    symptoms,
    mood: mood !== undefined ? Number(mood) : null,
    stress: stress !== undefined ? Number(stress) : null,
  };
  healthEntries.push(entry);
  res.status(201).json({ entry });
});

export default router;
