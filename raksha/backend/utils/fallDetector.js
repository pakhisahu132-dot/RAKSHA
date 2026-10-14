// Explainable possible-fall baseline (threshold based). NOT medical-grade, NOT validated on real-world data.
// Pipeline: [optional free-fall] -> impact spike -> post-impact stillness => POSSIBLE_FALL -> confirmation window.
// States: NORMAL | POSSIBLE_FALL | USER_CONFIRMATION_REQUIRED | SOS_CONFIRMED
export const DEFAULTS = {
  impactG: Number(process.env.FALL_IMPACT_G || 2.5), freeFallG: 0.6, stillMs: 1500, stillBandG: 0.25,
  confirmWindowS: Number(process.env.FALL_CONFIRM_WINDOW_S || 20), freeFallLookbackMs: 1000,
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

export class FallDetector {
  constructor(cfg = {}) { this.cfg = { ...DEFAULTS, ...cfg }; this.reset(); }
  reset() { this.state = "NORMAL"; this.buf = []; this.impact = null; this.evidence = null; this.deadline = null; this.since = null; }
  /** Modular anomaly score: z-score of magnitude vs the preceding 5 s baseline (explanatory only; does not trigger alone). */
  anomalyScore(mag, tMs) {
    const base = this.buf.filter((s) => s.t < tMs && s.t > tMs - 5000).map((s) => s.mag);
    if (base.length < 10) return null;
    return Math.round(((mag - mean(base)) / Math.max(std(base), 0.05)) * 10) / 10;
  }
  push({ x, y, z }, tMs = Date.now()) {
    const mag = Math.hypot(x, y, z);
    if (this.state !== "NORMAL") { this.buf.push({ t: tMs, mag }); return this.snapshot(); }
    const c = this.cfg;
    if (!this.impact && mag >= c.impactG) {
      const freeFall = this.buf.some((s) => s.t >= tMs - c.freeFallLookbackMs && s.mag <= c.freeFallG);
      this.impact = { t: tMs, peakG: mag, freeFall, anomaly: this.anomalyScore(mag, tMs) };
    }
    this.buf.push({ t: tMs, mag });
    this.buf = this.buf.filter((s) => s.t > tMs - 8000);
    if (this.impact && tMs - this.impact.t >= c.stillMs) {
      const after = this.buf.filter((s) => s.t > this.impact.t + 300).map((s) => s.mag);
      const still = after.length >= 3 && after.every((m) => Math.abs(m - 1) <= c.stillBandG);
      if (still) {
        this.evidence = { peakG: round(this.impact.peakG), freeFallSeen: this.impact.freeFall, stillnessMs: c.stillMs,
          anomalyZ: this.impact.anomaly, rule: `impact >= ${c.impactG} g then ~1 g (±${c.stillBandG}) for ${c.stillMs} ms` };
        this.state = "POSSIBLE_FALL"; this.since = tMs;
        this.state = "USER_CONFIRMATION_REQUIRED"; this.deadline = tMs + c.confirmWindowS * 1000;
      } else if (tMs - this.impact.t > c.stillMs + 3000) this.impact = null; // user kept moving: not a fall
    }
    return this.snapshot();
  }
  /** Call periodically; returns true exactly once when the window expires un-cancelled. */
  tick(nowMs = Date.now()) {
    if (this.state === "USER_CONFIRMATION_REQUIRED" && nowMs >= this.deadline) { this.state = "SOS_CONFIRMED"; return true; }
    return false;
  }
  cancel() { if (this.state === "USER_CONFIRMATION_REQUIRED") { this.reset(); return true; } return false; }
  snapshot(nowMs = Date.now()) {
    return { state: this.state, evidence: this.evidence,
      secondsLeft: this.state === "USER_CONFIRMATION_REQUIRED" ? Math.max(0, Math.ceil((this.deadline - nowMs) / 1000)) : null };
  }
}
const round = (n) => Math.round(n * 100) / 100;
