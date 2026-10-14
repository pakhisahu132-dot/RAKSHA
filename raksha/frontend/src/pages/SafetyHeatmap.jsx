import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, Popup } from "react-leaflet";
import { Flame, MapPin } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Badge } from "../components/Ui.jsx";

export default function SafetyHeatmap() {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    api.getHeatmapPoints().then((r) => setPoints(r.points));
  }, []);

  const center = [22.7205, 75.8645];
  const highRisk = points.filter((p) => p.intensity >= 0.6).sort((a, b) => b.intensity - a.intensity);

  return (
    <div>
      <SectionHeading
        eyebrow="Dynamic Safety Heatmap"
        title="Crowd-sourced safety gradient"
        description="Visualizes high-risk vs. low-risk areas driven by historical trends and Campus Whisper reports. Updates automatically as new reports arrive."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden p-0 lg:col-span-3">
          <div className="h-[520px] w-full">
            <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {points.map((p, i) => (
                <Circle
                  key={i}
                  center={[p.lat, p.lng]}
                  radius={80 + p.intensity * 120}
                  pathOptions={{
                    color: colorForIntensity(p.intensity),
                    fillColor: colorForIntensity(p.intensity),
                    fillOpacity: 0.35,
                    weight: 1.5,
                  }}
                >
                  <Popup>
                    <span className="font-semibold">{p.label}</span>
                    <br />
                    Risk intensity: {Math.round(p.intensity * 100)}%
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              <h2 className="font-display text-base font-bold text-ink">Legend</h2>
            </div>
            <div className="space-y-2">
              <LegendRow color="#DC2626" label="High risk" range="60–100%" />
              <LegendRow color="#D97706" label="Moderate risk" range="30–59%" />
              <LegendRow color="#0D9488" label="Low risk" range="0–29%" />
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              <h2 className="font-display text-base font-bold text-ink">Highest-risk areas</h2>
            </div>
            <ul className="space-y-2.5">
              {highRisk.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-surface-border p-2.5">
                  <span className="text-sm font-medium text-ink">{p.label}</span>
                  <Badge tone="rose">{Math.round(p.intensity * 100)}%</Badge>
                </li>
              ))}
              {highRisk.length === 0 && <p className="text-sm text-ink-faint">No high-risk zones currently flagged.</p>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function colorForIntensity(intensity) {
  if (intensity >= 0.6) return "#DC2626";
  if (intensity >= 0.3) return "#D97706";
  return "#0D9488";
}

function LegendRow({ color, label, range }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-ink">{label}</span>
      </div>
      <span className="font-mono text-xs text-ink-faint">{range}</span>
    </div>
  );
}
