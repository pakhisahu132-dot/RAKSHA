// Deterministic heuristic "AI" models for RAKSHA.
// These stand in for trained ML models: same inputs always produce the same
// outputs, which keeps the demo reproducible and auditable.

// ---------------------------------------------------------------------------
// 1. Invisible Burden AI
// ---------------------------------------------------------------------------
// Weighted composite of unpaid/invisible labor categories, normalized 0-100.
// Weights reflect research on cognitive/emotional load: emotional labor and
// interruptions (context-switching cost) are weighted heaviest, since they
// erode recovery time even when raw "hours" look moderate.
const BURDEN_WEIGHTS = {
  domesticHours: 3.2, // per hour/day
  caregivingHours: 4.0, // per hour/day
  emotionalLabor: 6.5, // 0-10 self-rating
  workplacePressure: 5.0, // 0-10 self-rating
  interruptions: 2.5, // count/day
  sleepDeficit: 7.0, // per hour under 8
};

export function calculateBurdenScore(input) {
  const {
    domesticHours = 0,
    caregivingHours = 0,
    emotionalLabor = 0,
    workplacePressure = 0,
    interruptions = 0,
    sleepHours = 8,
  } = input;

  const sleepDeficit = Math.max(0, 8 - sleepHours);

  const raw =
    domesticHours * BURDEN_WEIGHTS.domesticHours +
    caregivingHours * BURDEN_WEIGHTS.caregivingHours +
    emotionalLabor * BURDEN_WEIGHTS.emotionalLabor +
    workplacePressure * BURDEN_WEIGHTS.workplacePressure +
    interruptions * BURDEN_WEIGHTS.interruptions +
    sleepDeficit * BURDEN_WEIGHTS.sleepDeficit;

  // Empirical ceiling for normalization, tuned so a maxed-out day (8h
  // domestic, 6h caregiving, 10/10 emotional labor & pressure, 10
  // interruptions, 0 sleep) lands close to 100.
  const CEILING = 260;
  const score = Math.min(100, Math.round((raw / CEILING) * 100));

  let category;
  if (score < 30) category = "Balanced";
  else if (score < 55) category = "Elevated";
  else if (score < 75) category = "High";
  else category = "Critical";

  const insights = buildBurdenInsights({ ...input, sleepDeficit, score, category });

  return {
    score,
    category,
    breakdown: {
      domesticHours,
      caregivingHours,
      emotionalLabor,
      workplacePressure,
      interruptions,
      sleepDeficit: Math.round(sleepDeficit * 10) / 10,
    },
    insights,
  };
}

function buildBurdenInsights({
  domesticHours,
  caregivingHours,
  emotionalLabor,
  workplacePressure,
  interruptions,
  sleepDeficit,
  category,
}) {
  const insights = [];

  if (emotionalLabor >= 7) {
    insights.push({
      priority: "high",
      title: "Emotional labor is your largest load driver",
      detail:
        "Rate this the same category you'd give physical work: it needs recovery time, not just willpower. Try naming one emotional-support task today that someone else could take on.",
    });
  }
  if (sleepDeficit >= 2) {
    insights.push({
      priority: "high",
      title: "Sleep debt is compounding your burden",
      detail: `You're averaging ${sleepDeficit.toFixed(
        1
      )} hours under a healthy baseline. Protecting even 30 extra minutes tonight measurably lowers tomorrow's stress reactivity.`,
    });
  }
  if (caregivingHours >= 4) {
    insights.push({
      priority: "medium",
      title: "Caregiving load is high today",
      detail:
        "Consider whether any caregiving tasks can rotate to another household member this week, even temporarily.",
    });
  }
  if (workplacePressure >= 7) {
    insights.push({
      priority: "medium",
      title: "Workplace pressure is a major contributor",
      detail:
        "One deadline conversation with a manager today could reduce next week's compounding pressure more than any single evening of rest.",
    });
  }
  if (interruptions >= 5) {
    insights.push({
      priority: "medium",
      title: "Frequent interruptions are fragmenting your day",
      detail:
        "Context-switching has a real cognitive cost. Blocking even one uninterrupted 45-minute window tomorrow can reduce perceived load.",
    });
  }
  if (domesticHours >= 5) {
    insights.push({
      priority: "low",
      title: "Domestic workload is above average",
      detail: "Batch similar chores together where possible; task-switching between chore types adds hidden fatigue.",
    });
  }
  if (category === "Balanced" && insights.length === 0) {
    insights.push({
      priority: "low",
      title: "Today's load is well distributed",
      detail: "Your inputs suggest a sustainable day. Use any spare capacity for something restorative rather than another task.",
    });
  }
  if (category === "Critical") {
    insights.unshift({
      priority: "critical",
      title: "Your burden score is in the critical range",
      detail:
        "This level, sustained over days, is associated with burnout. Consider actively delegating at least one responsibility today and speaking with someone you trust about the load.",
    });
  }
  return insights;
}

// ---------------------------------------------------------------------------
// 2. Campus Whisper — NLP-style incident classifier
// ---------------------------------------------------------------------------
const CATEGORY_KEYWORDS = {
  Stalking: ["followed", "following", "stalk", "kept pace", "watching me", "tracked", "waiting outside", "trailed"],
  Harassment: ["catcall", "harass", "inappropriate comment", "touched", "grabbed", "whistl", "vulgar", "unwanted"],
  "Poor Lighting": ["dark", "no light", "streetlight", "unlit", "dim", "can't see", "no lighting", "broken light"],
  "Suspicious Activity": ["loitering", "suspicious", "unfamiliar men", "watching", "lurking", "strange man", "parked car", "photographing"],
};

const INTENSITY_WORDS = [
  "scared",
  "terrified",
  "assault",
  "attacked",
  "grabbed",
  "cornered",
  "chased",
  "weapon",
  "threatened",
  "screamed",
  "panic",
];

export function classifyReport(text) {
  const lower = text.toLowerCase();
  const scores = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits += 1;
    }
    scores[category] = hits;
  }

  // Pick the category with the most keyword hits; default to Suspicious Activity
  // when nothing matches strongly, since that's the safest catch-all bucket.
  let category = "Suspicious Activity";
  let bestHits = 0;
  for (const [cat, hits] of Object.entries(scores)) {
    if (hits > bestHits) {
      bestHits = hits;
      category = cat;
    }
  }

  // Severity: base from keyword density + intensity-word boosts, clamped 1-10.
  let severity = 3 + bestHits * 1.5;
  let intensityHits = 0;
  for (const word of INTENSITY_WORDS) {
    if (lower.includes(word)) intensityHits += 1;
  }
  severity += intensityHits * 1.8;

  // Time-context boost: incidents mentioning night/late add urgency.
  if (/(night|late|dark|midnight|10pm|11pm|after dark)/.test(lower)) severity += 1;

  severity = Math.max(1, Math.min(10, Math.round(severity)));

  const confidence = Math.min(0.97, 0.55 + bestHits * 0.12 + intensityHits * 0.08);

  return {
    category,
    severity,
    confidence: Math.round(confidence * 100) / 100,
    flaggedUrgent: severity >= 8,
  };
}

// ---------------------------------------------------------------------------
// 3. Public Space Comfort Index / Safe Route Score
// ---------------------------------------------------------------------------
// All sub-metrics are 0-10 inputs; weighted to a 0-100 Comfort Score.
// Night mode re-weights lighting and foot traffic much more heavily.
export function calculateComfortScore(segment, { nightMode = false } = {}) {
  const { lighting, policePresence, openBusinesses, reportsNearby, footTraffic } = segment;

  const weights = nightMode
    ? { lighting: 3.2, policePresence: 2.0, openBusinesses: 1.6, footTraffic: 2.6, reportsPenalty: 4.0 }
    : { lighting: 2.2, policePresence: 1.8, openBusinesses: 1.6, footTraffic: 1.8, reportsPenalty: 3.0 };

  const positive =
    lighting * weights.lighting +
    policePresence * weights.policePresence +
    openBusinesses * weights.openBusinesses +
    footTraffic * weights.footTraffic;

  const maxPositive = 10 * (weights.lighting + weights.policePresence + weights.openBusinesses + weights.footTraffic);
  const penalty = reportsNearby * weights.reportsPenalty;

  const score = Math.max(0, Math.min(100, Math.round(((positive - penalty) / maxPositive) * 100)));
  return score;
}

export function rankRoutes(segments, { nightMode = false } = {}) {
  return segments
    .map((seg) => ({
      ...seg,
      comfortScore: calculateComfortScore(seg, { nightMode }),
    }))
    .sort((a, b) => b.comfortScore - a.comfortScore);
}

// ---------------------------------------------------------------------------
// 4. Cycle prediction (simple rolling-average model)
// ---------------------------------------------------------------------------
export function predictNextCycle(healthEntries) {
  const starts = healthEntries
    .filter((e) => e.type === "cycle_start")
    .map((e) => new Date(e.date).getTime())
    .sort((a, b) => a - b);

  if (starts.length === 0) {
    return { predictedStart: null, predictedOvulation: null, avgCycleLength: null, confidence: 0 };
  }
  if (starts.length === 1) {
    const avgCycleLength = 28;
    const predictedStart = new Date(starts[0] + avgCycleLength * 86400000);
    return {
      predictedStart: predictedStart.toISOString(),
      predictedOvulation: new Date(predictedStart.getTime() - 14 * 86400000).toISOString(),
      avgCycleLength,
      confidence: 0.4,
    };
  }

  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push((starts[i] - starts[i - 1]) / 86400000);
  }
  const avgCycleLength = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const lastStart = starts[starts.length - 1];
  const predictedStart = new Date(lastStart + avgCycleLength * 86400000);
  const predictedOvulation = new Date(predictedStart.getTime() - 14 * 86400000);

  // Confidence rises with more historical cycles and lower variance.
  const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgCycleLength, 2), 0) / gaps.length;
  const stability = Math.max(0, 1 - variance / 25);
  const confidence = Math.min(0.95, 0.5 + gaps.length * 0.05 + stability * 0.2);

  return {
    predictedStart: predictedStart.toISOString(),
    predictedOvulation: predictedOvulation.toISOString(),
    avgCycleLength,
    confidence: Math.round(confidence * 100) / 100,
  };
}
