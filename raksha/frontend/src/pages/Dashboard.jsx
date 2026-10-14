import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Gauge, MessagesSquare, Route as RouteIcon, ShieldAlert } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Badge } from "../components/Ui.jsx";
import ScoreGauge from "../components/ScoreGauge.jsx";

export default function Dashboard() {
  const [burden, setBurden] = useState(null);
  const [reports, setReports] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getBurdenHistory("demo-user"),
      api.getWhisperReports(),
      api.getHealthPrediction("demo-user"),
      api.scoreRoutes({ nightMode: false }),
    ])
      .then(([b, w, p, r]) => {
        setBurden(b.entries[b.entries.length - 1]);
        setReports(w.reports.slice(0, 3));
        setPrediction(p);
        setRoutes(r.routes);
      })
      .finally(() => setLoading(false));
  }, []);

  const urgentReports = reports.filter((r) => r.severity >= 7).length;
  const bestRoute = routes[0];

  return (
    <div>
      <SectionHeading
        eyebrow="Overview"
        title="Your safety and well-being at a glance"
        description="A single view across burden load, cycle tracking, community reports, and routing so you can act on what matters today."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Burden Score</p>
              <p className="mt-1 text-sm text-ink-soft">Today's mental & physical load</p>
            </div>
            <Gauge className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <ScoreGauge value={burden?.score ?? 0} size={64} strokeWidth={6} tone="indigo" />
            <div>
              <Badge tone={badgeToneForBurden(burden?.category)}>{burden?.category || "—"}</Badge>
              <Link to="/burden" className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:underline">
                Recalculate <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Cycle Prediction</p>
              <p className="mt-1 text-sm text-ink-soft">Next predicted start</p>
            </div>
            <ShieldAlert className="h-4 w-4 text-teal-500" />
          </div>
          <p className="mt-5 font-display text-2xl font-bold text-ink">
            {prediction?.predictedStart ? formatDate(prediction.predictedStart) : "Log a cycle"}
          </p>
          <Link to="/health" className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline">
            View full timeline <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Campus Whisper</p>
              <p className="mt-1 text-sm text-ink-soft">Reports flagged high-severity</p>
            </div>
            <MessagesSquare className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-5 font-display text-2xl font-bold text-ink">{urgentReports}</p>
          <Link to="/whisper" className="mt-3 flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline">
            Review reports <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Recommended Route</p>
              <p className="mt-1 text-sm text-ink-soft">Highest comfort score right now</p>
            </div>
            <RouteIcon className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-5 font-display text-2xl font-bold text-ink">{bestRoute?.comfortScore ?? "—"}%</p>
          <Link to="/routes" className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:underline">
            Plan a trip <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink">Recent Campus Whisper reports</h2>
            <Link to="/whisper" className="text-xs font-semibold text-indigo-500 hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-ink-faint">Loading reports…</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {reports.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{r.location.label}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{r.text}</p>
                  </div>
                  <Badge tone={r.severity >= 8 ? "rose" : r.severity >= 5 ? "amber" : "slate"}>
                    Severity {r.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-display text-base font-bold text-ink">Today's insight</h2>
          </div>
          <p className="text-sm text-ink-soft">
            Burden and comfort scores update as new data comes in. Log today's burden inputs to receive
            personalized rebalancing suggestions, and check the Safe Route Score before you head out this evening.
          </p>
          <Link
            to="/burden"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
          >
            Log today's burden
          </Link>
        </Card>
      </div>
    </div>
  );
}

function badgeToneForBurden(category) {
  switch (category) {
    case "Critical":
      return "rose";
    case "High":
      return "amber";
    case "Elevated":
      return "indigo";
    default:
      return "teal";
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
