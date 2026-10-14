import { Link } from "react-router-dom";
import { Cpu, MapPin, Wifi, WifiOff, BellRing, Siren, Share2 } from "lucide-react";
import { Badge, Button } from "./Ui.jsx";
import { useSafety } from "../lib/safety.jsx";
import { useState } from "react";
import { api } from "../api.js";

const LOC_TONE = { RELIABLE: "teal", APPROXIMATE: "amber", STALE: "amber", UNAVAILABLE: "rose" };
const MODE_TONE = { LIVE: "teal", OFFLINE: "slate" };

export function SafetyChips() {
  const { status, online, bestLocation, localQueue } = useSafety();
  const mode = status?.mode ?? "…";
  const pending = (status?.pendingAlerts ?? 0) + localQueue.length;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Safety status">
      <Link to="/emergency"><Badge tone={MODE_TONE[mode] || "amber"}><Cpu className="h-3 w-3" />{mode === "LIVE" ? "Device: LIVE" : mode === "OFFLINE" ? "Device: offline" : mode}</Badge></Link>
      <Link to="/emergency"><Badge tone={LOC_TONE[bestLocation?.status || "UNAVAILABLE"]}><MapPin className="h-3 w-3" />GPS: {bestLocation?.status ?? "UNAVAILABLE"}</Badge></Link>
      <Badge tone={online ? "teal" : "rose"}>{online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{online ? "Network OK" : "Backend unreachable"}</Badge>
      {pending > 0 && <Link to="/emergency"><Badge tone="amber"><BellRing className="h-3 w-3" />{pending} pending alert{pending > 1 ? "s" : ""}</Badge></Link>}
      {status?.sharing?.activeTrips > 0 && <Link to="/companion"><Badge tone="indigo"><Share2 className="h-3 w-3" />Location sharing ON</Badge></Link>}
    </div>
  );
}

export function SosButton({ compact = false }) {
  const { sendSos, lastSos } = useSafety();
  const [sending, setSending] = useState(false);
  const click = async () => { setSending(true); await sendSos(); setTimeout(() => setSending(false), 1500); };
  return (
    <Button variant="danger" onClick={click} disabled={sending} aria-label="Send SOS" className={compact ? "px-3 py-2" : "px-6 py-3 text-base"}>
      <Siren className="h-4 w-4" />{sending ? "Creating…" : "SOS"}
    </Button>
  );
}

export function SosResultBanner() {
  const { lastSos } = useSafety();
  const [hidden, setHidden] = useState(null);
  if (!lastSos || hidden === lastSos) return null;
  let tone = "border-rose-200 bg-rose-50 text-rose-700", msg;
  if (lastSos.error) msg = `SOS failed: ${lastSos.error}`;
  else if (lastSos.queuedLocally) msg = "Backend unreachable — SOS saved on this device and NOT sent yet. It will retry automatically.";
  else msg = `${lastSos.duplicate ? "Existing incident reused" : "Incident created"}: ${lastSos.incident.id}. Alerts are ${lastSos.incident.alerts.map((a) => a.status).join(", ") || "not queued"} — see Emergency for live delivery status.`;
  return (
    <div className={`mx-6 mt-4 flex items-start justify-between gap-4 rounded-lg border p-3 text-sm ${tone}`} role="status">
      <span>{msg} <Link className="font-semibold underline" to="/emergency">Open</Link></span>
      <button className="text-xs font-semibold" onClick={() => setHidden(lastSos)}>Dismiss</button>
    </div>
  );
}

export function FallBanner() {
  const { status } = useSafety();
  const f = status?.fall;
  if (!f || f.state !== "USER_CONFIRMATION_REQUIRED") return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-rose-600 px-6 py-3 text-white" role="alert">
      <div>
        <p className="font-display text-sm font-bold">POSSIBLE FALL detected{status.mode.startsWith("SIM") ? " (SIMULATED)" : ""} — are you OK?</p>
        <p className="text-xs">SOS is sent automatically in {f.secondsLeft}s unless you cancel. Threshold-based detection, may be a false alarm.</p>
      </div>
      <div className="flex gap-2">
        <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-rose-700" onClick={() => api.cancelFall()}>I'm OK — cancel</button>
        <button className="rounded-lg border border-white px-4 py-2 text-sm font-semibold" onClick={() => api.confirmFall()}>Send SOS now</button>
      </div>
    </div>
  );
}
