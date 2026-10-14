import { Router } from "express";
import { nanoid } from "nanoid";
import { whisperReports, heatmapPoints } from "../data/store.js";
import { classifyReport } from "../utils/aiHeuristics.js";

const router = Router();

// GET /api/whisper/reports?category=&minSeverity=
router.get("/reports", (req, res) => {
  const { category, minSeverity } = req.query;
  let results = [...whisperReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (category && category !== "all") {
    results = results.filter((r) => r.category === category);
  }
  if (minSeverity) {
    results = results.filter((r) => r.severity >= Number(minSeverity));
  }
  res.json({ reports: results });
});

// POST /api/whisper/reports — anonymous submission, auto-classified
router.post("/reports", (req, res) => {
  const { text, location } = req.body;
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: "Report text must be at least 10 characters." });
  }
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    return res.status(400).json({ error: "A valid location (lat, lng) is required." });
  }

  const classification = classifyReport(text);

  const report = {
    id: nanoid(10),
    text: text.trim(),
    location: {
      lat: location.lat,
      lng: location.lng,
      label: location.label || "Unnamed location",
    },
    createdAt: new Date().toISOString(),
    category: classification.category,
    severity: classification.severity,
    confidence: classification.confidence,
    flaggedUrgent: classification.flaggedUrgent,
    status: "under_review",
  };

  whisperReports.unshift(report);

  // Feed the heatmap: contribute intensity proportional to severity.
  heatmapPoints.push({
    lat: report.location.lat,
    lng: report.location.lng,
    intensity: Math.min(1, report.severity / 10),
    label: report.location.label,
  });

  res.status(201).json({ report, classification });
});

export default router;
