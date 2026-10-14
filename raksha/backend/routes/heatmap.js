import { Router } from "express";
import { heatmapPoints } from "../data/store.js";

const router = Router();

// GET /api/heatmap/points
router.get("/points", (req, res) => {
  res.json({ points: heatmapPoints });
});

export default router;
