import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import { Moon, Route as RouteIcon, Sun, Zap } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Badge } from "../components/Ui.jsx";
import ScoreGauge from "../components/ScoreGauge.jsx";

const ROUTE_COLORS = {
  "route-fast": "#DC2626",
  "route-balanced": "#D97706",
  "route-safest": "#0D9488",
};

export default function SafeRoute() {
  const [nightMode, setNightMode] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .scoreRoutes({ nightMode })
      .then((r) => {
        setRoutes(r.routes);
        setSelected(r.routes[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [nightMode]);

  const selectedRoute = routes.find((r) => r.id === selected);
  const center = [22.7205, 75.8645];

  return (
    <div>
      <SectionHeading
        eyebrow="Public Space Comfort Index"
        title="Safe Route Score (estimate)"
        description="Compares candidate routes on lighting, police presence, open businesses, foot traffic, and nearby reports — not just distance. Scores are heuristic estimates from sample data — not verified live conditions and never a guarantee of safety."
        action={
          <button
            onClick={() => setNightMode((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
              nightMode ? "border-indigo-500 bg-indigo-500 text-white" : "border-surface-border bg-white text-ink-soft"
            }`}
          >
            {nightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Night Mode {nightMode ? "On" : "Off"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden p-0 lg:col-span-3">
          <div className="h-[420px] w-full">
            <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {routes.map((r) => (
                <Polyline
                  key={r.id}
                  positions={r.path}
                  pathOptions={{
                    color: ROUTE_COLORS[r.id] || "#4F46E5",
                    weight: selected === r.id ? 6 : 3,
                    opacity: selected === r.id ? 1 : 0.45,
                  }}
                  eventHandlers={{ click: () => setSelected(r.id) }}
                />
              ))}
              {routes.map((r) => (
                <CircleMarker
                  key={`${r.id}-end`}
                  center={r.path[r.path.length - 1]}
                  radius={6}
                  pathOptions={{ color: ROUTE_COLORS[r.id] || "#4F46E5", fillOpacity: 1 }}
                >
                  <Popup>{r.name}</Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {loading ? (
            <p className="text-sm text-ink-faint">Scoring routes…</p>
          ) : (
            routes.map((r, i) => (
              <Card
                key={r.id}
                className={`cursor-pointer transition-shadow ${selected === r.id ? "ring-2 ring-indigo-500" : ""}`}
                onClick={() => setSelected(r.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <RouteIcon className="h-4 w-4" style={{ color: ROUTE_COLORS[r.id] }} />
                      <p className="font-display text-sm font-bold text-ink">{r.name}</p>
                      {i === 0 && <Badge tone="teal">Recommended</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {r.distanceKm} km · {r.etaMinutes} min
                    </p>
                  </div>
                  <ScoreGauge value={r.comfortScore} size={56} strokeWidth={5} tone={toneForScore(r.comfortScore)} />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {selectedRoute && (
        <Card className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-500" />
            <h2 className="font-display text-base font-bold text-ink">
              Comfort Score breakdown — {selectedRoute.name}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Metric label="Lighting" value={selectedRoute.lighting} />
            <Metric label="Police presence" value={selectedRoute.policePresence} />
            <Metric label="Open businesses" value={selectedRoute.openBusinesses} />
            <Metric label="Foot traffic" value={selectedRoute.footTraffic} />
            <Metric label="Nearby reports" value={selectedRoute.reportsNearby} inverse />
          </div>
          {nightMode && (
            <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600">
              Night Mode is filtering for well-lit, high-foot-traffic arterial roads — lighting and foot traffic are
              weighted more heavily in this score.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function toneForScore(score) {
  if (score >= 70) return "teal";
  if (score >= 45) return "amber";
  return "rose";
}

function Metric({ label, value, inverse }) {
  const pct = Math.min(100, (value / 10) * 100);
  return (
    <div>
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={`h-full rounded-full ${inverse ? "bg-rose-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-xs text-ink-faint">{value}/10</p>
    </div>
  );
}
