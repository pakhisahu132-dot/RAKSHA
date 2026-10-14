import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import { Navigation, Phone, Play, Square, Users } from "lucide-react";
import { api } from "../api.js";
import { useSafety } from "../lib/safety.jsx";
import { Card, SectionHeading, Field, Button, Badge, EmptyState } from "../components/Ui.jsx";

export default function TrustedCompanion() {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [destination, setDestination] = useState("Hostel Block C");
  const [routeId, setRouteId] = useState("route-balanced");
  const [routes, setRoutes] = useState([]);
  const [trip, setTrip] = useState(null);
  const pollRef = useRef(null);
  const lastPost = useRef(0);
  const { browserLoc, enableLocation, locError } = useSafety();
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getUser("demo-user").then((r) => {
      setContacts(r.user.trustedContacts);
      setSelectedContacts(r.user.trustedContacts.slice(0, 2).map((c) => c.id));
    });
    api.getRouteOptions().then((r) => setRoutes(r.routes));
    api.getActiveTrips("demo-user").then((r) => {
      const active = r.trips.find((t) => t.status === "in_progress" || t.status === "escalated");
      if (active) startPolling(active.id);
    });
    return () => clearInterval(pollRef.current);
  }, []);

  // Real GPS: while a trip is in progress, forward browser position to the backend (only for this trip's contacts).
  useEffect(() => {
    if (!trip || trip.status !== "in_progress" || !browserLoc || Date.now() - lastPost.current < 5000) return;
    lastPost.current = Date.now();
    api.sendTripLocation(trip.id, { lat: browserLoc.lat, lng: browserLoc.lng, accuracy: browserLoc.accuracy }).catch(() => {});
  }, [browserLoc, trip]);

  const startPolling = (tripId) => {
    clearInterval(pollRef.current);
    const tick = () => api.getTrip(tripId).then((r) => { setTrip(r.trip); setError(null); }).catch((e) => setError(e.message));
    tick();
    pollRef.current = setInterval(tick, 3000);
  };

  const beginTrip = async () => {
    try {
      enableLocation();
      const res = await api.startTrip({ userId: "demo-user", routeId, destination, windowMinutes: 1, contactIds: selectedContacts });
      setTrip(res.trip);
      startPolling(res.trip.id);
    } catch (e) { setError(e.message); }
  };

  const endTrip = async () => {
    if (!trip) return;
    try {
      await api.confirmTrip(trip.id);
      clearInterval(pollRef.current);
      setTrip((await api.getTrip(trip.id)).trip);
    } catch (e) { setError(e.message); }
  };

  const toggleContact = (id) => {
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const isLive = trip && (trip.status === "in_progress" || trip.status === "escalated");

  return (
    <div>
      <SectionHeading
        eyebrow="Trusted Companion Mode"
        title="Share your trip in real time"
        description="Authorized contacts see your live progress along the route until you confirm you've arrived safely."
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <h2 className="font-display text-base font-bold text-ink">Start a trip</h2>
          </div>

          {isLive ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                  {trip.status === "escalated" ? "Escalated — see alert status below" : "Trip in progress — location sharing ON"}
                </p>
                <p className="mt-1 font-display text-lg font-bold text-ink">{trip.destination}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Route: {trip.routeName}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Sharing with</p>
                <div className="space-y-2">
                  {contacts
                    .filter((c) => trip.contactIds.includes(c.id))
                    .map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border border-surface-border p-2.5">
                        <div>
                          <p className="text-sm font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-ink-faint">{c.relation}</p>
                        </div>
                        <span className="text-xs font-semibold text-ink-soft">
                          {trip.incident?.alerts.find((a) => a.recipient === c.name)?.status ?? "Sharing (no alert sent)"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <p className="text-xs text-ink-soft">
                Position source: <span className="font-semibold">{trip.positionSource === "browser" ? "Live browser GPS" : "SIMULATED route progress (no real GPS received)"}</span>
                {trip.positionSource !== "browser" && !browserLoc && <button className="ml-2 font-semibold text-indigo-500 underline" onClick={enableLocation}>Enable GPS</button>}
                {locError && <span className="ml-2 text-rose-600">{locError}</span>}
              </p>
              <Button variant="teal" className="w-full" onClick={endTrip}>
                <Square className="h-4 w-4" /> I've arrived safely
              </Button>
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
              <Field label="Route">
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Share with</p>
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-border p-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-ink-faint">{c.relation}</p>
                      </div>
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
              <Button className="w-full" onClick={beginTrip} disabled={!destination || selectedContacts.length === 0}>
                <Play className="h-4 w-4" /> Start sharing this trip
              </Button>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0 lg:col-span-3">
          {isLive ? (
            <div className="h-[480px] w-full">
              <MapContainer key={trip.positionSource} center={trip.currentPosition} zoom={16} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Polyline positions={trip.path} pathOptions={{ color: "#4F46E5", weight: 4, dashArray: "6 6" }} />
                <CircleMarker center={trip.currentPosition} radius={9} pathOptions={{ color: "#0D9488", fillOpacity: 1 }}>
                  <Popup>{trip.positionSource === "browser" ? "Current position (browser GPS)" : "Simulated position"}</Popup>
                </CircleMarker>
                <CircleMarker center={trip.path[trip.path.length - 1]} radius={7} pathOptions={{ color: "#4F46E5", fillOpacity: 1 }}>
                  <Popup>{trip.destination}</Popup>
                </CircleMarker>
              </MapContainer>
            </div>
          ) : (
            <div className="flex h-[480px] items-center justify-center p-6">
              <EmptyState icon={Navigation} title="No trip in progress" description="Start a trip to see live position tracking here." />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
