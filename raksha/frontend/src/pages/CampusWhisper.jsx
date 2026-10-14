import { useEffect, useState } from "react";
import { EyeOff, MapPin, Send, ShieldCheck } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Field, Button, Badge, EmptyState } from "../components/Ui.jsx";

const CATEGORIES = ["all", "Harassment", "Poor Lighting", "Suspicious Activity", "Stalking"];

const LOCATION_PRESETS = [
  { label: "East Gate, Library Rd", lat: 22.7218, lng: 75.8636 },
  { label: "Engineering Block Rear Path", lat: 22.7245, lng: 75.8701 },
  { label: "Central Canteen", lat: 22.7202, lng: 75.8659 },
  { label: "Hostel Back Gate", lat: 22.7189, lng: 75.8611 },
  { label: "Main Avenue", lat: 22.7178, lng: 75.8642 },
];

export default function CampusWhisper() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState("");
  const [location, setLocation] = useState(LOCATION_PRESETS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const refresh = (category) => {
    api.getWhisperReports(category && category !== "all" ? { category } : {}).then((r) => setReports(r.reports));
  };

  useEffect(() => refresh(filter), [filter]);

  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 10) return;
    setSubmitting(true);
    try {
      const res = await api.submitWhisperReport({ text, location });
      setLastResult(res);
      setText("");
      refresh(filter);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Campus Whisper"
        title="Anonymous community reporting"
        description="Submit what you observed. No account details are attached — the classifier tags category and severity automatically so patterns surface fast."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-indigo-500" />
            <h2 className="font-display text-base font-bold text-ink">Submit a report</h2>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="What did you observe?" hint="Be specific about behavior and timing — this helps the classifier and other readers.">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Describe what happened, where, and roughly when..."
                className="w-full resize-none rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Location">
              <select
                value={location.label}
                onChange={(e) => setLocation(LOCATION_PRESETS.find((l) => l.label === e.target.value))}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
              >
                {LOCATION_PRESETS.map((l) => (
                  <option key={l.label} value={l.label}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={submitting || text.trim().length < 10} className="w-full">
              <Send className="h-4 w-4" /> {submitting ? "Submitting…" : "Submit anonymously"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
              <ShieldCheck className="h-3.5 w-3.5" /> No identifying information is stored with this report.
            </p>
          </form>

          {lastResult && (
            <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">AI classification</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="indigo">{lastResult.classification.category}</Badge>
                <Badge tone={lastResult.classification.severity >= 7 ? "rose" : "amber"}>
                  Severity {lastResult.classification.severity}/10
                </Badge>
                <span className="text-xs text-ink-soft">
                  {Math.round(lastResult.classification.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          )}
        </Card>

        <div className="lg:col-span-3">
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === c
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-surface-border bg-white text-ink-soft hover:bg-surface-subtle"
                }`}
              >
                {c === "all" ? "All reports" : c}
              </button>
            ))}
          </div>

          {reports.length === 0 ? (
            <EmptyState icon={EyeOff} title="No reports in this category" description="Reports will appear here as they're submitted." />
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                      <div>
                        <p className="text-sm font-semibold text-ink">{r.location.label}</p>
                        <p className="mt-1 text-sm text-ink-soft">{r.text}</p>
                        <p className="mt-2 text-xs text-ink-faint">
                          {new Date(r.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={categoryTone(r.category)}>{r.category}</Badge>
                      <Badge tone={r.severity >= 8 ? "rose" : r.severity >= 5 ? "amber" : "slate"}>
                        Severity {r.severity}
                      </Badge>
                      <Badge tone={r.status === "verified" ? "teal" : "slate"}>
                        {r.status === "verified" ? "Verified" : "Under review"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function categoryTone(category) {
  switch (category) {
    case "Stalking":
      return "rose";
    case "Harassment":
      return "amber";
    case "Poor Lighting":
      return "indigo";
    default:
      return "slate";
  }
}
