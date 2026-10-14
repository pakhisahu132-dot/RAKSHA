import { useEffect, useRef, useState } from "react";
import { AlarmClock, CheckCircle2, MessageSquareWarning, SignalLow, SignalHigh, TimerReset } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Field, Button, Badge } from "../components/Ui.jsx";

export default function SmartCheckins() {
  const [destination, setDestination] = useState("Apartment — 4th Floor");
  const [windowMinutes, setWindowMinutes] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [trip, setTrip] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [signal, setSignal] = useState(100);
  const [smsPayloads, setSmsPayloads] = useState([]);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const smsLoadedFor = useRef(null);

  const beginPolling = (trip0) => {
    clearInterval(pollRef.current); clearInterval(tickRef.current);
    const deadline = new Date(trip0.expectedArrival).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick(); tickRef.current = setInterval(tick, 1000);
    const poll = async () => {
      try {
        const t = (await api.getTrip(trip0.id)).trip;
        setTrip(t); setError(null);
        // The backend escalates and queues alerts by itself. We only fetch the manual SMS links ONCE (idempotent endpoint).
        if (t.status === "escalated" && smsLoadedFor.current !== t.id) {
          smsLoadedFor.current = t.id;
          api.escalateTrip(t.id, "Check-in window missed").then((r) => setSmsPayloads(r.smsPayloads || [])).catch(() => {});
        }
      } catch (e) { setError(e.message); }
    };
    poll(); pollRef.current = setInterval(poll, 2000);
  };

  useEffect(() => {
    api.getUser("demo-user").then((r) => {
      setContacts(r.user.trustedContacts);
      setSelectedContacts(r.user.trustedContacts.map((c) => c.id));
    }).catch((e) => setError(e.message));
    api.getActiveTrips("demo-user").then((r) => { // resume after reload / backend restart
      const active = r.trips.find((t) => t.status === "in_progress" || t.status === "escalated");
      if (active) { setTrip(active); beginPolling(active); }
    }).catch(() => {});
    return () => { clearInterval(pollRef.current); clearInterval(tickRef.current); };
  }, []);

  const startCheckin = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await api.startTrip({ userId: "demo-user", routeId: "route-balanced", destination, windowMinutes, contactIds: selectedContacts });
      setTrip(res.trip); setSmsPayloads([]); smsLoadedFor.current = null; beginPolling(res.trip);
    } catch (e) { setError(e.message); } finally { setStarting(false); }
  };

  const confirmArrival = async () => {
    if (!trip) return;
    try {
      await api.confirmTrip(trip.id);
      clearInterval(pollRef.current); clearInterval(tickRef.current);
      setTrip((await api.getTrip(trip.id)).trip);
    } catch (e) { setError(e.message); }
  };

  const simulateSignalDrop = async (value) => {
    setSignal(value);
    const res = await api.checkConnectivity(value);
    if (res.fallbackTriggered && trip) {
      const fb = await api.sendSmsFallback({ tripId: trip.id, reason: "Connectivity dropped below threshold" });
      setSmsPayloads(fb.payloads);
    }
  };

  const toggleContact = (id) => {
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const isLive = trip && (trip.status === "in_progress" || trip.status === "escalated");

  return (
    <div>
      <SectionHeading
        eyebrow="Smart Check-ins"
        title="Automated arrival confirmation"
        description="Set a check-in window. If you don't confirm arrival in time, contacts are alerted automatically — with an offline SMS fallback if your connection drops."
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <TimerReset className="h-4 w-4 text-indigo-500" />
            <h2 className="font-display text-base font-bold text-ink">
              {isLive ? "Active check-in" : "Set up a check-in"}
            </h2>
          </div>

          {isLive ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center rounded-xl2 border border-surface-border bg-surface-muted py-8">
                <AlarmClock className={`h-6 w-6 ${trip.status === "escalated" ? "text-rose-500" : "text-indigo-500"}`} />
                <p className="mt-2 font-mono text-4xl font-bold text-ink">{formatCountdown(remaining)}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {trip.status === "escalated" ? "Window missed — escalation started (see delivery status below)" : "until check-in deadline"}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-surface-border p-3">
                <span className="text-sm font-medium text-ink">Destination</span>
                <span className="text-sm text-ink-soft">{trip.destination}</span>
              </div>
              <Badge tone={trip.status === "escalated" ? "rose" : "teal"}>
                {trip.status === "escalated" ? "Escalated" : trip.status === "confirmed" ? "Confirmed safe" : "In progress"}
              </Badge>
              {trip.incident && (
                <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs">
                  <p className="mb-1 font-semibold text-rose-600">Incident {trip.incident.id}</p>
                  {trip.incident.alerts.map((a) => (
                    <p key={a.id} className="text-ink-soft">{a.recipient}: <span className="font-semibold">{a.status}</span> via {a.channel}{a.error ? ` — ${a.error}` : ""}</p>
                  ))}
                </div>
              )}
              <Button variant="teal" className="w-full" onClick={confirmArrival}>
                <CheckCircle2 className="h-4 w-4" /> Confirm I've arrived
              </Button>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Simulate connectivity (demo slider)
                </p>
                <div className="flex items-center gap-3">
                  <SignalLow className="h-4 w-4 text-ink-faint" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={signal}
                    onChange={(e) => simulateSignalDrop(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <SignalHigh className="h-4 w-4 text-ink-faint" />
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  Signal: {signal}% {signal < 30 && <span className="font-semibold text-rose-500">— fallback active</span>}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Destination">
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
                />
              </Field>
              <Field label={`Check-in window — ${windowMinutes} min (demo-accelerated)`} hint="In production this maps to real trip duration.">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={windowMinutes}
                  onChange={(e) => setWindowMinutes(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </Field>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Alert contacts</p>
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-border p-2.5">
                      <span className="text-sm text-ink">{c.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(c.id)}
                        onChange={() => toggleContact(c.id)}
                        className="h-4 w-4 accent-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={startCheckin} disabled={selectedContacts.length === 0 || starting}>
                {starting ? "Starting…" : "Start check-in timer"}
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-rose-500" />
            <h2 className="font-display text-base font-bold text-ink">Manual SMS links</h2>
          </div>
          {smsPayloads.length === 0 ? (
            <p className="text-sm text-ink-soft">
              If your check-in window is missed, or you simulate a signal drop below 30%, ready-to-send SMS links appear
              here. Opening a link only launches your Messages app — delivery of those texts is NOT tracked. Tracked delivery is shown in the active check-in panel.
            </p>
          ) : (
            <div className="space-y-3">
              {smsPayloads.map((p) => (
                <div key={p.contactId} className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{p.contactName}</p>
                    <span className="font-mono text-xs text-ink-faint">{p.charCount}/160 chars</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink-soft">{p.body}</p>
                  <a
                    href={p.smsUri}
                    className="mt-2 inline-block text-xs font-semibold text-indigo-500 hover:underline"
                  >
                    Open in Messages
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatCountdown(seconds) {
  if (seconds === null) return "--:--";
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
