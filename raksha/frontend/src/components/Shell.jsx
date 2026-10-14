import { NavLink } from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  Gauge,
  CalendarHeart,
  MessagesSquare,
  Route,
  Users,
  TimerReset,
  Map as MapIcon,
  Siren,
} from "lucide-react";
import { SafetyChips, SosButton, FallBanner, SosResultBanner } from "./SafetyBar.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/emergency", label: "Emergency & Device", icon: Siren },
  { to: "/burden", label: "Invisible Burden AI", icon: Gauge },
  { to: "/health", label: "Health Timeline", icon: CalendarHeart },
  { to: "/whisper", label: "Campus Whisper", icon: MessagesSquare },
  { to: "/routes", label: "Safe Route Score", icon: Route },
  { to: "/companion", label: "Trusted Companion", icon: Users },
  { to: "/checkins", label: "Smart Check-ins", icon: TimerReset },
  { to: "/heatmap", label: "Safety Heatmap", icon: MapIcon },
];

export default function Shell({ children }) {
  return (
    <div className="flex min-h-screen bg-surface-muted">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-surface-border bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-surface-border px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500">
            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <p className="font-display text-base font-extrabold leading-none tracking-tight text-ink">
              RAKSHA
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
              Safety & Response
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-ink-soft hover:bg-surface-subtle hover:text-ink"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-surface-border p-4">
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="text-xs font-semibold text-ink">Ananya Rao</p>
            <p className="text-xs text-ink-faint">Demo workspace</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 justify-between border-b border-surface-border bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <span className="font-display text-sm font-extrabold text-ink">RAKSHA</span>
          </div>
          <div className="hidden lg:block"><SafetyChips /></div>
          <SosButton compact />
        </header>
        <div className="px-6 pt-3 lg:hidden"><SafetyChips /></div>
        <SosResultBanner />
        <main className="flex-1 px-6 py-8">{children}</main>
        <FallBanner />
      </div>
    </div>
  );
}
