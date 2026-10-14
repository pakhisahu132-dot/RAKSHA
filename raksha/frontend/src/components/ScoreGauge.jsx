// The signature visual element of RAKSHA: every quantified score in the
// app (Burden Score, Comfort Score, Report Severity) renders through this
// same dial, so the person learns one visual language for "how much" across
// very different features.

const TONE_STYLES = {
  indigo: { track: "#E0E7FF", fill: "#4F46E5" },
  teal: { track: "#CCFBF1", fill: "#0D9488" },
  amber: { track: "#FEF3C7", fill: "#D97706" },
  rose: { track: "#FFE4E6", fill: "#DC2626" },
};

export default function ScoreGauge({
  value,
  max = 100,
  size = 96,
  strokeWidth = 8,
  tone = "indigo",
  label,
  sublabel,
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / max) * circumference;
  const colors = TONE_STYLES[tone] || TONE_STYLES.indigo;

  return (
    <div className="inline-flex flex-col items-center" role="img" aria-label={`${label || "Score"}: ${clamped} of ${max}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.track}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.fill}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="font-display font-bold"
          fill="#0F172A"
          fontSize={size * 0.26}
        >
          {Math.round(clamped)}
        </text>
      </svg>
      {label && <span className="mt-2 text-sm font-semibold text-ink">{label}</span>}
      {sublabel && <span className="text-xs text-ink-soft">{sublabel}</span>}
    </div>
  );
}
