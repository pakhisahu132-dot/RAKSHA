import { useCallback, useEffect, useState } from "react";
import { Siren, Cpu, MapPin, Activity, FileText, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Button, Badge, EmptyState } from "../components/Ui.jsx";
import { SosButton } from "../components/SafetyBar.jsx";
import { useSafety } from "../lib/safety.jsx";

const ALERT_TONE = { QUEUED: "amber", SENDING: "indigo", SENT: "teal", ACKNOWLEDGED: "teal", FAILED: "rose" };
const LOC_TONE = { RELIABLE: "teal", APPROXIMATE: "amber", STALE: "amber", UNAVAILABLE: "rose" };
const fmt = (v, unit = "") => (v === null || v === undefined ? "Unavailable" : `${v}${unit}`);

export default function Emergency() {
  const { status, bestLocation, browserLoc, locError, enableLocation, sendSos, lastSos, localQueue, flushQueue } = useSafety();
  const [incidents, setIncidents] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.getIncidents().then((r) => { setIncidents(r.incidents); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]);

  const toggleSim = async () => { setBusy(true); try { await api.setSimulation(!status?.simulation.enabled); } finally { setBusy(false); } };
  const hw = status?.hardware, r = status?.readings, sim = status?.mode?.startsWith("SIM");
  const tag = r ? (r.source === "simulated" ? "SIMULATED" : "LIVE HARDWARE") : null;

  return (
    <div>
      <SectionHeading eyebrow="Emergency" title="SOS, device telemetry & incident cards"
        description="Manual SOS is always available and never waits on sensors. Delivery status below reflects what the backend actually did — not what a button click implied." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center gap-2"><Siren className="h-4 w-4 text-rose-500" /><h2 className="font-display text-base font-bold text-ink">Send SOS</h2></div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Optional access / landmark note (you supply it)"
            className="mb-3 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm" aria-label="Landmark note" />
          <div className="flex items-center gap-3">
            <Button variant="danger" className="px-6 py-3 text-base" disabled={busy} onClick={async () => { setBusy(true); await sendSos({ landmarkNote: note }); setBusy(false); load(); }}>
              <Siren className="h-4 w-4" /> SOS
            </Button>
            <p className="text-xs text-ink-soft">Alerts all trusted contacts. Duplicate clicks reuse the same incident.</p>
          </div>
          {localQueue.length > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-600">{localQueue.length} SOS saved locally, NOT yet sent (backend unreachable). <button className="font-semibold underline" onClick={flushQueue}>Retry now</button></p>
          )}
          {lastSos?.error && <p className="mt-3 text-xs text-rose-600">Last attempt failed: {lastSos.error}</p>}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" /><h2 className="font-display text-base font-bold text-ink">Location confidence</h2></div>
          {bestLocation ? (
            <div className="space-y-1.5 text-sm">
              <Badge tone={LOC_TONE[bestLocation.status]}>{bestLocation.status}{bestLocation.simulated ? " · SIMULATED" : ""}</Badge>
              <p className="text-ink-soft">{bestLocation.reason}</p>
              <p className="font-mono text-xs text-ink">{bestLocation.lat != null ? `${bestLocation.lat.toFixed(5)}, ${bestLocation.lng.toFixed(5)}` : "Coordinates: Unavailable"}</p>
              <p className="text-xs text-ink-faint">Source: {bestLocation.source ?? "none"} · Age: {fmt(bestLocation.ageSeconds, "s")} · Accuracy: {fmt(bestLocation.accuracyM !== null ? Math.round(bestLocation.accuracyM) : null, " m")}</p>
            </div>
          ) : <p className="text-sm text-ink-faint">Loading…</p>}
          <div className="mt-3">
            {browserLoc ? <p className="text-xs text-teal-600">Browser GPS active (used only when you send SOS or share a trip).</p>
              : <Button variant="outline" onClick={enableLocation}>Enable browser location</Button>}
            {locError && <p className="mt-1 text-xs text-rose-600">{locError}</p>}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-teal-500" /><h2 className="font-display text-base font-bold text-ink">Device & sensors</h2></div>
          <Badge tone={status?.mode === "LIVE" ? "teal" : sim ? "amber" : "slate"}>{status?.mode ?? "…"}</Badge>
          <p className="mt-2 text-xs text-ink-faint">Hardware last seen: {hw?.lastSeen ? new Date(hw.lastSeen).toLocaleTimeString() : "never"}{hw?.deviceId ? ` (${hw.deviceId})` : ""}</p>
          <ul className="mt-2 space-y-1 text-xs text-ink-soft">
            {[["GPS", hw?.sensors.gps], ["Accelerometer", hw?.sensors.accel], ["SpO₂ (prototype)", hw?.sensors.spo2], ["Temperature (prototype)", hw?.sensors.tempC]].map(([n, s]) => (
              <li key={n} className="flex justify-between"><span>{n}</span><span className={s?.available ? "text-teal-600" : "text-ink-faint"}>{s?.available ? "Available" : "Unavailable"}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || hw?.connected} onClick={toggleSim}>{status?.simulation.enabled ? "Stop demo mode" : "Start demo mode"}</Button>
            {status?.simulation.enabled && <Button variant="outline" onClick={() => api.simulateFall().catch((e) => alert(e.message))}>Simulate fall</Button>}
          </div>
          {hw?.connected && <p className="mt-1 text-xs text-ink-faint">Demo mode is disabled while real hardware is connected.</p>}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-rose-500" /><h2 className="font-display text-base font-bold text-ink">Fall detection</h2></div>
          <Badge tone={status?.fall.state === "NORMAL" ? "teal" : "rose"}>{(status?.fall.state ?? "…").replace(/_/g, " ")}</Badge>
          {status?.fall.state === "USER_CONFIRMATION_REQUIRED" && <p className="mt-2 text-sm text-rose-600">Auto-SOS in {status.fall.secondsLeft}s unless cancelled.</p>}
          {status?.fall.lastConfirmed && <p className="mt-2 text-xs text-ink-soft">Last auto-SOS: {new Date(status.fall.lastConfirmed.at).toLocaleString()} ({status.fall.lastConfirmed.source})</p>}
          <p className="mt-2 text-xs text-ink-faint">{status?.disclaimer}</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-base font-bold text-ink">Latest readings {tag && <Badge tone={r.source === "simulated" ? "amber" : "teal"} className="ml-2">{tag}</Badge>}</h2>
          {r ? (
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-ink-faint">SpO₂</dt><dd className="font-mono">{fmt(r.spo2, "%")}</dd></div>
              <div><dt className="text-xs text-ink-faint">Temp</dt><dd className="font-mono">{fmt(r.tempC, " °C")}</dd></div>
              <div><dt className="text-xs text-ink-faint">Accel (g)</dt><dd className="font-mono text-xs">{r.accel ? `${r.accel.x.toFixed(2)}, ${r.accel.y.toFixed(2)}, ${r.accel.z.toFixed(2)}` : "Unavailable"}</dd></div>
            </dl>
          ) : <p className="text-sm text-ink-faint">No live or simulated device. All readings Unavailable.</p>}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-ink">Incident history</h2>
      {error && <p className="mb-3 text-sm text-rose-600">Could not load incidents: {error}</p>}
      {incidents === null ? <p className="text-sm text-ink-faint">Loading…</p> : incidents.length === 0
        ? <EmptyState icon={Siren} title="No incidents yet" description="Incidents from SOS, missed check-ins and fall detection appear here." />
        : <div className="space-y-4">{incidents.map((i) => <IncidentRow key={i.id} inc={i} onChange={load} />)}</div>}
    </div>
  );
}

function IncidentRow({ inc, onChange }) {
  const [card, setCard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState(null);
  const l = inc.location;
  const copy = async () => { try { await navigator.clipboard.writeText(card.text); } catch { setErr("Copy not permitted by browser"); } };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-faint">{inc.id}</p>
          <p className="font-display text-sm font-bold text-ink">{inc.type.replace(/_/g, " ")} {inc.simulated && <Badge tone="amber" className="ml-1">SIMULATED</Badge>}</p>
          <p className="text-xs text-ink-soft">{new Date(inc.createdAt).toLocaleString()} · {inc.status}</p>
        </div>
        <Badge tone={LOC_TONE[l.status]}>Location {l.status}{l.ageSeconds != null ? ` · ${l.ageSeconds}s old at event` : ""}</Badge>
      </div>
      <ul className="mt-3 space-y-1.5">
        {inc.alerts.length === 0 && <li className="text-xs text-ink-faint">No alerts recorded.</li>}
        {inc.alerts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-ink">{a.recipient}</span><span className="text-ink-faint">via {a.channel}</span>
            <Badge tone={ALERT_TONE[a.status]}>{a.status}</Badge>
            {a.attempts > 0 && <span className="text-ink-faint">attempts: {a.attempts}</span>}
            {a.sentAt && <span className="text-ink-faint">sent {new Date(a.sentAt).toLocaleTimeString()}</span>}
            {a.error && <span className="text-rose-600">{a.error}</span>}
            {a.status === "FAILED" && a.channel !== "none" && <button className="font-semibold text-indigo-500 hover:underline" onClick={() => api.retryAlert(a.id).then(onChange).catch((e) => setErr(e.message))}><RefreshCw className="mr-1 inline h-3 w-3" />Retry</button>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => api.getIncidentCard(inc.id).then(setCard).catch((e) => setErr(e.message))}><FileText className="h-4 w-4" />Incident card</Button>
        <Button variant="outline" onClick={() => api.getIncidentSummary(inc.id).then(setSummary).catch((e) => setErr(e.message))}>Responder summary</Button>
        {inc.status === "OPEN" && <Button variant="ghost" onClick={() => api.resolveIncident(inc.id).then(onChange)}>Mark resolved</Button>}
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      {card && (
        <div className="mt-3 rounded-lg border border-surface-border bg-surface-muted p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-ink">{card.text}</pre>
          <p className="mt-2 text-[11px] text-ink-faint">{card.card.disclaimer}</p>
          <div className="mt-2 flex gap-3 text-xs font-semibold text-indigo-500">
            <button onClick={copy}><Copy className="mr-1 inline h-3 w-3" />Copy text</button>
            {card.card.mapLink ? <a href={card.card.mapLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />Open map</a> : <span className="font-normal text-ink-faint">Map link unavailable (no valid coordinates)</span>}
          </div>
        </div>
      )}
      {summary && <div className="mt-3 rounded-lg border border-surface-border p-3"><Badge tone={summary.source === "ai" ? "indigo" : "slate"}>{summary.source === "ai" ? "AI-written from incident facts" : "Deterministic summary"}</Badge><pre className="mt-2 whitespace-pre-wrap text-xs text-ink-soft">{summary.text}</pre></div>}
    </Card>
  );
}
