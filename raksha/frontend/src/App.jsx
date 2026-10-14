import { Routes, Route } from "react-router-dom";
import Shell from "./components/Shell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import BurdenCalculator from "./pages/BurdenCalculator.jsx";
import HealthTimeline from "./pages/HealthTimeline.jsx";
import CampusWhisper from "./pages/CampusWhisper.jsx";
import SafeRoute from "./pages/SafeRoute.jsx";
import TrustedCompanion from "./pages/TrustedCompanion.jsx";
import SmartCheckins from "./pages/SmartCheckins.jsx";
import Emergency from "./pages/Emergency.jsx";
import SafetyHeatmap from "./pages/SafetyHeatmap.jsx";

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="/burden" element={<BurdenCalculator />} />
        <Route path="/health" element={<HealthTimeline />} />
        <Route path="/whisper" element={<CampusWhisper />} />
        <Route path="/routes" element={<SafeRoute />} />
        <Route path="/companion" element={<TrustedCompanion />} />
        <Route path="/checkins" element={<SmartCheckins />} />
        <Route path="/heatmap" element={<SafetyHeatmap />} />
      </Routes>
    </Shell>
  );
}
