import { useEffect, useState } from "react";
import { AlertOctagon, Info, TrendingUp } from "lucide-react";
import { api } from "../api.js";
import { Card, SectionHeading, Field, Slider, Button, Badge } from "../components/Ui.jsx";
import ScoreGauge from "../components/ScoreGauge.jsx";

const DEFAULT_INPUT = {
  domesticHours: 3,
  caregivingHours: 2,
  emotionalLabor: 5,
  workplacePressure: 5,
  interruptions: 3,
  sleepHours: 7,
};

export default function BurdenCalculator() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBurdenHistory("demo-user").then((r) => setHistory(r.entries));
  }, []);

  const set = (key) => (val) => setInput((prev) => ({ ...prev, [key]: val }));

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const res = await api.calculateBurden({ userId: "demo-user", ...input });
      setResult(res);
      const refreshed = await api.getBurdenHistory("demo-user");
      setHistory(refreshed.entries);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Invisible Burden AI"
        title="Mental & Physical Burden Score"
        description="Rate today's invisible labor across six dimensions. The engine weighs emotional labor and sleep debt most heavily, since they compound fastest."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-5 font-display text-base font-bold text-ink">Today's inputs</h2>
          <div className="space-y-5">
            <Field label={`Domestic chores — ${input.domesticHours}h today`} hint="Cooking, cleaning, errands, household admin">
              <Slider value={input.domesticHours} onChange={set("domesticHours")} min={0} max={10} />
            </Field>
            <Field label={`Caregiving — ${input.caregivingHours}h today`} hint="Children, elders, or dependents">
              <Slider value={input.caregivingHours} onChange={set("caregivingHours")} min={0} max={10} />
            </Field>
            <Field label={`Emotional labor — ${input.emotionalLabor}/10`} hint="Managing others' feelings, conflict, emotional support given">
              <Slider value={input.emotionalLabor} onChange={set("emotionalLabor")} min={0} max={10} />
            </Field>
            <Field label={`Workplace pressure — ${input.workplacePressure}/10`} hint="Deadlines, expectations, workplace dynamics">
              <Slider value={input.workplacePressure} onChange={set("workplacePressure")} min={0} max={10} />
            </Field>
            <Field label={`Interruptions — ${input.interruptions} today`} hint="Times your focus was broken by someone else's need">
              <Slider value={input.interruptions} onChange={set("interruptions")} min={0} max={12} />
            </Field>
            <Field label={`Sleep last night — ${input.sleepHours}h`} hint="Recovery capacity for tomorrow">
              <Slider value={input.sleepHours} onChange={set("sleepHours")} min={0} max={10} step={0.5} />
            </Field>
          </div>
          <Button className="mt-6 w-full" onClick={handleCalculate} disabled={loading}>
            {loading ? "Calculating…" : "Calculate my burden score"}
          </Button>
        </Card>

        <Card className="flex flex-col items-center justify-center lg:col-span-2">
          {result ? (
            <>
              <ScoreGauge
                value={result.score}
                size={148}
                strokeWidth={12}
                tone={toneForCategory(result.category)}
                label={result.category}
                sublabel="out of 100"
              />
              <div className="mt-6 w-full space-y-3">
                {result.insights.map((ins, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 rounded-lg border border-surface-border bg-surface-muted p-3"
                  >
                    {ins.priority === "critical" ? (
                      <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-ink">{ins.title}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{ins.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 text-center">
              <ScoreGauge value={0} size={120} strokeWidth={10} tone="indigo" />
              <p className="mt-4 max-w-xs text-sm text-ink-soft">
                Adjust the sliders and calculate to see your personalized burden score and insights.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <h2 className="font-display text-base font-bold text-ink">14-day trend</h2>
        </div>
        <BurdenTrendChart history={history} />
      </Card>
    </div>
  );
}

function toneForCategory(category) {
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

function BurdenTrendChart({ history }) {
  if (!history.length) return <p className="text-sm text-ink-faint">No history yet.</p>;
  const width = 720;
  const height = 160;
  const padding = 24;
  const max = 100;
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (h.score / max) * (height - padding * 2);
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-[600px]">
        {[0, 25, 50, 75, 100].map((v) => {
          const y = height - padding - (v / max) * (height - padding * 2);
          return (
            <g key={v}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#F1F5F9" strokeWidth={1} />
              <text x={2} y={y + 3} fontSize={9} fill="#94A3B8">
                {v}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#4F46E5" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill="#4F46E5" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{new Date(history[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>
          {new Date(history[history.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}
