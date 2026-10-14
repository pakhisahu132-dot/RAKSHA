import { Router } from "express";
import { routeSegments } from "../data/store.js";
import { rankRoutes } from "../utils/aiHeuristics.js";

const router = Router();

// POST /api/routes/score  { nightMode: boolean }
// Returns all mock route options ranked by Comfort Score.
router.post("/score", (req, res) => {
  const { nightMode = false } = req.body || {};
  const ranked = rankRoutes(routeSegments, { nightMode });
  res.json({ nightMode, routes: ranked });
});

// GET /api/routes/options — raw list without scoring, for map display
router.get("/options", (req, res) => {
  res.json({ routes: routeSegments });
});

export default router;
