import { useEffect, useState } from "react";
import { CalendarHeart, Droplet, Moon, Plus, Sparkles, Stethoscope, X } from "lucide-react";
import { api } from "../api.js";
import { useSafety } from "../lib/safety.jsx";
import { Card, SectionHeading, Button, Field, Badge } from "../components/Ui.jsx";

const TYPE_META = {
  cycle_start: { icon: Droplet, tone: "rose", label: "Cycle start" },
  cycle_end: { icon: Droplet, tone: "slate", label: "Cycle end" },
  ovulation: { icon: Sparkles, tone: "teal", label: "Ovulation window" },
  wellness_note: { icon: Moon, tone: "amber", label: "Wellness note" },
  checkup: { icon: Stethoscope, tone: "indigo", label: "Checkup" },
};

export default function HealthTimeline() {
  const [entries, setEntries] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "wellness_note", label: "", mood: 6, stress: 4 });

  const refresh = () => {
    api.getHealthTimeline("demo-user").then((r) => setEntries(r.entries));
    api.getHealthPrediction("demo-user").then(setPrediction);
  };

  useEffect(refresh, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    await api.addHealthEntry({ userId: "demo-user", ...form });
    setForm({ type: "wellness_note", label: "", mood: 6, stress: 4 });
    setShowForm(false);
    refresh();
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Health Timeline"
        title="Reproductive health & wellness history"
        description="A chronological record of cycle metrics, stress markers, and wellness milestones, with predictive analytics for what's ahead."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
      <SensorPanel /> Log an entry
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {showForm && (
            <Card className="mb-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-ink">New timeline entry</h2>
                <button onClick={() => setShowForm(false)} className="text-ink-faint hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field label="Entry type">
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(TYPE_META).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Description">
                  <input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="e.g. Mild cramping, took a rest day"
                    className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={`Mood — ${form.mood}/10`}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={form.mood}
                      onChange={(e) => setForm({ ...form, mood: Number(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </Field>
                  <Field label={`Stress — ${form.stress}/10`}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={form.stress}
                      onChange={(e) => setForm({ ...form, stress: Number(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </Field>
                </div>
                <Button type="submit">Save entry</Button>
              </form>
            </Card>
          )}

          <Card>
            <h2 className="mb-5 font-display text-base font-bold text-ink">Timeline</h2>
            <ol className="relative space-y-6 border-l border-surface-border pl-6">
              {entries
                .slice()
                .reverse()
                .map((entry) => {
                  const meta = TYPE_META[entry.type] || TYPE_META.wellness_note;
                  const Icon = meta.icon;
                  return (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-surface-border bg-white">
                        <Icon className="h-3.5 w-3.5 text-indigo-500" />
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{entry.label}</p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {new Date(entry.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {(entry.symptoms?.length > 0 || entry.mood !== null) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {entry.symptoms?.map((s) => (
                            <Badge key={s} tone="slate">
                              {s}
                            </Badge>
                          ))}
                          {entry.mood !== null && entry.mood !== undefined && (
                            <span className="text-xs text-ink-soft">Mood {entry.mood}/10</span>
                          )}
                          {entry.stress !== null && entry.stress !== undefined && (
                            <span className="text-xs text-ink-soft">· Stress {entry.stress}/10</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ol>
          </Card>
        </div>

        <div>
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-teal-500" />
              <h2 className="font-display text-base font-bold text-ink">Predictive analytics</h2>
            </div>
            {prediction?.predictedStart ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Next predicted cycle</p>
                  <p className="mt-1 font-display text-xl font-bold text-ink">
                    {new Date(prediction.predictedStart).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Predicted ovulation window
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {prediction.predictedOvulation
                      ? new Date(prediction.predictedOvulation).toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Average cycle length</p>
                  <p className="mt-1 text-sm font-medium text-ink">{prediction.avgCycleLength} days</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Model confidence</p>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${prediction.confidence * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{Math.round(prediction.confidence * 100)}% confident</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Log at least one cycle start to unlock predictions.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Device-sourced readings: only valid values are shown; missing data is "Unavailable"; simulated data is labelled.
function SensorPanel() {
  const { status } = useSafety();
  const [history, setHistory] = useState([]);
  useEffect(() => { api.getReadings().then((r) => setHistory(r.readings)).catch(() => {}); }, [status?.readings?.source]);
  const r = status?.readings;
  const v = (x, u) => (x === null || x === undefined ? "Unavailable" : `${x}${u}`);
  return (
    <div className="mb-6 rounded-xl border border-surface-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">Device sensor readings</h2>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${r?.source === "simulated" ? "border-amber-100 bg-amber-50 text-amber-500" : r ? "border-teal-100 bg-teal-50 text-teal-600" : "border-surface-border bg-surface-subtle text-ink-soft"}`}>
          {r ? (r.source === "simulated" ? "SIMULATED — DEVICE OFFLINE" : "LIVE HARDWARE") : "No device"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs text-ink-faint">SpO₂ (prototype sensor)</p><p className="font-mono text-lg">{v(r?.spo2, "%")}</p></div>
        <div><p className="text-xs text-ink-faint">Temperature (prototype sensor)</p><p className="font-mono text-lg">{v(r?.tempC, " °C")}</p></div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">Prototype readings, not clinically validated and not for diagnosis.</p>
      {history.length > 0 && (
        <ul className="mt-3 max-h-32 divide-y divide-surface-border overflow-y-auto text-xs text-ink-soft">
          {history.slice(0, 10).map((h, i) => (
            <li key={i} className="flex justify-between py-1"><span>{new Date(h.ts).toLocaleString()} · {h.source.toUpperCase()}</span><span>SpO₂ {v(h.spo2, "%")} · {v(h.tempC, " °C")}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
