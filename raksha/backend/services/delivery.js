// Alert delivery queue: QUEUED -> SENDING -> SENT -> ACKNOWLEDGED | FAILED. Persistent, bounded retries, backoff.
import { nanoid } from "nanoid";
import { db, logEvent } from "../db.js";

const MAX_ATTEMPTS = () => Number(process.env.MAX_ATTEMPTS || 6);
const BASE_MS = () => Number(process.env.RETRY_BASE_MS || 2000);
export const mode = () => {
  const m = process.env.DELIVERY_MODE;
  if (m === "mock" || m === "mock-fail") return m;
  return process.env.TELEGRAM_BOT_TOKEN ? "telegram" : "none";
};

export function queueAlerts(incident, contacts, messageFor) {
  const ins = db.prepare(`INSERT OR IGNORE INTO alerts (id, incident_id, dedupe_key, channel, recipient, chat_id, status, last_error, created_at, ack_token)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const c of contacts) {
    const chatId = c.telegramChatId || process.env.TELEGRAM_CHAT_ID || null;
    const m = mode();
    const usable = m === "mock" || m === "mock-fail" || (m === "telegram" && chatId);
    const channel = usable ? (m === "telegram" ? "telegram" : "mock (simulated)") : "none";
    const r = ins.run("al_" + nanoid(10), incident.id, `${incident.id}:${usable ? (chatId || c.id) : c.id}`, channel, c.name, chatId,
      usable ? "QUEUED" : "FAILED", usable ? null : "No backend delivery channel configured for this contact (use the manual SMS link)",
      new Date().toISOString(), nanoid(16));
    if (r.changes) logEvent("alert", incident.id, usable ? "ALERT_QUEUED" : "ALERT_FAILED_NO_CHANNEL", { recipient: c.name, channel });
  }
  setImmediate(() => processQueue(messageFor).catch(() => {}));
}

async function sendOne(a, text) {
  const m = mode();
  if (m === "mock" || m === "mock-fail") {
    if (m === "mock-fail" || a.attempts < Number(process.env.MOCK_FAIL_FIRST || 0)) throw Object.assign(new Error("mock network error"), { retryable: true });
    return "mock-" + a.id;
  }
  let r;
  try {
    r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ chat_id: a.chat_id, text, disable_web_page_preview: true }) });
  } catch (e) { throw Object.assign(new Error("network: " + e.message), { retryable: true }); }
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.ok) return String(j.result?.message_id);
  throw Object.assign(new Error(`Telegram ${r.status}: ${j.description || "error"}`), { retryable: r.status === 429 || r.status >= 500 });
}

let busy = false;
export async function processQueue(messageFor) {
  if (busy) return; busy = true;
  try {
    const due = db.prepare("SELECT * FROM alerts WHERE status='QUEUED' AND next_attempt_at <= ? LIMIT 10").all(Date.now());
    for (const a of due) {
      db.prepare("UPDATE alerts SET status='SENDING' WHERE id=?").run(a.id);
      try {
        const ref = await sendOne(a, await messageFor(a));
        db.prepare("UPDATE alerts SET status='SENT', sent_at=?, attempts=attempts+1, provider_ref=?, last_error=NULL WHERE id=?").run(new Date().toISOString(), ref, a.id);
        logEvent("alert", a.incident_id, "ALERT_SENT", { alertId: a.id, recipient: a.recipient, channel: a.channel });
      } catch (e) {
        const attempts = a.attempts + 1;
        if (e.retryable && attempts < MAX_ATTEMPTS()) {
          db.prepare("UPDATE alerts SET status='QUEUED', attempts=?, last_error=?, next_attempt_at=? WHERE id=?")
            .run(attempts, e.message, Date.now() + Math.min(BASE_MS() * 2 ** (attempts - 1), 60000), a.id);
          logEvent("alert", a.incident_id, "ALERT_RETRY_SCHEDULED", { alertId: a.id, attempts, error: e.message });
        } else {
          db.prepare("UPDATE alerts SET status='FAILED', attempts=?, last_error=? WHERE id=?").run(attempts, e.message, a.id);
          logEvent("alert", a.incident_id, "ALERT_FAILED", { alertId: a.id, attempts, error: e.message });
        }
      }
    }
  } finally { busy = false; }
}

export function recoverOnBoot() { db.prepare("UPDATE alerts SET status='QUEUED' WHERE status='SENDING'").run(); }
export function retryAlert(id) {
  const r = db.prepare("UPDATE alerts SET status='QUEUED', attempts=0, next_attempt_at=0, last_error=NULL WHERE id=? AND status='FAILED' AND channel != 'none'").run(id);
  if (r.changes) logEvent("alert", db.prepare("SELECT incident_id FROM alerts WHERE id=?").get(id).incident_id, "ALERT_MANUAL_RETRY", { alertId: id });
  return r.changes > 0;
}
export function acknowledge(token) {
  const a = db.prepare("SELECT * FROM alerts WHERE ack_token=?").get(token);
  if (!a || !["SENT", "ACKNOWLEDGED"].includes(a.status)) return null;
  if (a.status === "SENT") {
    db.prepare("UPDATE alerts SET status='ACKNOWLEDGED', acknowledged_at=? WHERE id=?").run(new Date().toISOString(), a.id);
    logEvent("alert", a.incident_id, "ALERT_ACKNOWLEDGED", { alertId: a.id, recipient: a.recipient });
  }
  return a;
}
export const pendingCount = () => db.prepare("SELECT COUNT(*) n FROM alerts WHERE status IN ('QUEUED','SENDING')").get().n;
export const listAlerts = (incidentId) => db.prepare("SELECT * FROM alerts WHERE incident_id=? ORDER BY created_at").all(incidentId).map(pub);
export const pub = (a) => ({ id: a.id, recipient: a.recipient, channel: a.channel, status: a.status, attempts: a.attempts,
  error: a.last_error, createdAt: a.created_at, sentAt: a.sent_at, acknowledgedAt: a.acknowledged_at });
