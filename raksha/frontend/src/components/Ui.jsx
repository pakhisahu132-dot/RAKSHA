export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl2 border border-surface-border bg-white p-6 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-500">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

const BADGE_TONES = {
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  teal: "bg-teal-50 text-teal-600 border-teal-100",
  amber: "bg-amber-50 text-amber-500 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
  slate: "bg-surface-subtle text-ink-soft border-surface-border",
};

export function Badge({ tone = "slate", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-500 text-white hover:bg-indigo-600",
    teal: "bg-teal-500 text-white hover:bg-teal-600",
    outline: "border border-surface-border bg-white text-ink hover:bg-surface-subtle",
    danger: "bg-rose-500 text-white hover:bg-rose-600",
    ghost: "text-ink-soft hover:bg-surface-subtle",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Slider({ value, onChange, min = 0, max = 10, step = 1 }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-subtle accent-indigo-500"
      />
      <span className="w-10 shrink-0 rounded-md bg-surface-subtle px-2 py-1 text-center font-mono text-xs font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-surface-border bg-surface-muted py-16 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-ink-faint" strokeWidth={1.5} />}
      <p className="font-display text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-soft">{description}</p>}
    </div>
  );
}
