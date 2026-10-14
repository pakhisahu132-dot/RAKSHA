// Responder summary. Deterministic by default; optional AI polish (backend-only key) that never blocks SOS.
export function deterministicSummary(inc) {
  const l = inc.location, s = inc.sensors;
  const lines = [
    `Event: ${inc.type.replace(/_/g, " ")} at ${inc.createdAt}${inc.simulated ? " (SIMULATED DEMO — not a real emergency)" : ""}.`,
    l.lat != null ? `Last location: ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)} — ${l.status}${l.ageSeconds != null ? `, ${l.ageSeconds}s old` : ""}, source: ${l.source}.`
      : `Location: UNAVAILABLE (${l.reason}).`,
    `Accelerometer: ${s.accel ? `x=${s.accel.x.toFixed(2)} y=${s.accel.y.toFixed(2)} z=${s.accel.z.toFixed(2)} g (${s.source})` : "Unavailable"}.`,
    `SpO2: ${s.spo2 != null ? s.spo2 + "% (prototype sensor, not clinical)" : "Unavailable"}. Temperature: ${s.tempC != null ? s.tempC + " °C (prototype sensor)" : "Unavailable"}.`,
  ];
  if (inc.fallEvidence) lines.push(`Fall rule matched: ${inc.fallEvidence.rule}; peak ${inc.fallEvidence.peakG} g.`);
  if (inc.landmarkNote) lines.push(`Access note (user-supplied, unverified): ${inc.landmarkNote}`);
  const d = inc.alerts || [];
  lines.push(d.length ? `Delivery: ${d.map((a) => `${a.recipient} ${a.status}`).join("; ")}.` : "Delivery: no alerts recorded.");
  return lines.join("\n");
}

export async function aiSummary(inc) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const facts = deterministicSummary(inc);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 300,
        system: "Rewrite the incident facts as a concise responder summary (max 5 short lines). Use ONLY the facts given. Say 'Unavailable' for missing data. Do not diagnose, infer causes, or invent landmarks.",
        messages: [{ role: "user", content: facts }] }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n") || null;
  } catch { return null; }
}
