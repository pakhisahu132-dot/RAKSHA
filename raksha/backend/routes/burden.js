import { Router } from "express";
import { burdenEntries } from "../data/store.js";
import { calculateBurdenScore } from "../utils/aiHeuristics.js";

const router = Router();

// GET /api/burden/history/:userId — 14-day trend with scores computed on read
router.get("/history/:userId", (req, res) => {
  const entries = burdenEntries
    .filter((e) => e.userId === req.params.userId)
    .map((e) => {
      const result = calculateBurdenScore(e);
      return { ...e, score: result.score, category: result.category };
    });
  res.json({ entries });
});

// POST /api/burden/calculate — score a fresh set of inputs, does not persist
router.post("/calculate", (req, res) => {
  const { domesticHours, caregivingHours, emotionalLabor, workplacePressure, interruptions, sleepHours } = req.body;

  for (const [key, val] of Object.entries({ domesticHours, caregivingHours, emotionalLabor, workplacePressure, interruptions, sleepHours })) {
    if (val === undefined || val === null || isNaN(Number(val))) {
      return res.status(400).json({ error: `Missing or invalid field: ${key}` });
    }
  }

  const result = calculateBurdenScore({
    domesticHours: Number(domesticHours),
    caregivingHours: Number(caregivingHours),
    emotionalLabor: Number(emotionalLabor),
    workplacePressure: Number(workplacePressure),
    interruptions: Number(interruptions),
    sleepHours: Number(sleepHours),
  });

  const entry = {
    id: `burden-${Date.now()}`,
    userId: req.body.userId || "demo-user",
    date: new Date().toISOString(),
    domesticHours: Number(domesticHours),
    caregivingHours: Number(caregivingHours),
    emotionalLabor: Number(emotionalLabor),
    workplacePressure: Number(workplacePressure),
    interruptions: Number(interruptions),
    sleepHours: Number(sleepHours),
    score: result.score,
  };
  burdenEntries.push(entry);

  res.json(result);
});

export default router;
