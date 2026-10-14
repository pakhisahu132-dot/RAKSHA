import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const Ctx = createContext(null);
export const useSafety = () => useContext(Ctx);
const QKEY = "raksha.pendingSos";
const RANK = { RELIABLE: 3, APPROXIMATE: 2, STALE: 1, UNAVAILABLE: 0 };
const readQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } };
const writeQ = (q) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* storage unavailable */ } };
const newId = () => `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function SafetyProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [backendUp, setBackendUp] = useState(true);
  const [browserLoc, setBrowserLoc] = useState(null); // raw browser fix
  const [browserAssessed, setBrowserAssessed] = useState(null);
  const [locError, setLocError] = useState(null);
  const [localQueue, setLocalQueue] = useState(readQ());
  const [lastSos, setLastSos] = useState(null);
  const watchRef = useRef(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = () => api.getStatus().then((s) => alive && (setStatus(s), setBackendUp(true))).catch(() => alive && setBackendUp(false));
    tick(); const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const enableLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError("Browser geolocation not supported"); return; }
    if (watchRef.current != null) return;
    setLocError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setBrowserLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy,
        timestamp: new Date(p.timestamp).toISOString(), source: "browser GPS" }),
      (e) => { setLocError(e.code === 1 ? "Location permission denied" : e.code === 3 ? "Location request timed out" : "Location unavailable"); watchRef.current = null; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }, []);
  useEffect(() => () => watchRef.current != null && navigator.geolocation.clearWatch(watchRef.current), []);

  // Server-side assessment keeps one source of truth for thresholds; nothing is stored.
  useEffect(() => {
    if (!browserLoc) return;
    const run = () => api.assessLocation(browserLoc).then(setBrowserAssessed).catch(() => {});
    run(); const id = setInterval(run, 10000); return () => clearInterval(id);
  }, [browserLoc]);

  const bestLocation = [status?.location, browserAssessed].filter(Boolean)
    .sort((a, b) => RANK[b.status] - RANK[a.status] || (a.ageSeconds ?? 1e9) - (b.ageSeconds ?? 1e9))[0] || null;

  const flushQueue = useCallback(async () => {
    const q = readQ(); if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try { const r = await api.sos(item); setLastSos({ ...r, fromQueue: true }); }
      catch (e) { if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) remaining.push(item); /* 4xx: drop invalid */ }
    }
    writeQ(remaining); setLocalQueue(remaining);
  }, []);
  useEffect(() => { const id = setInterval(flushQueue, 5000); window.addEventListener("online", flushQueue); return () => { clearInterval(id); window.removeEventListener("online", flushQueue); }; }, [flushQueue]);

  /** Fires immediately with whatever is cached — never waits on sensors or GPS. Duplicate clicks are ignored. */
  const sendSos = useCallback(async ({ landmarkNote, contactIds } = {}) => {
    if (busy.current) return { ignored: true };
    busy.current = true; setTimeout(() => (busy.current = false), 3000);
    const payload = { clientEventId: newId(), type: "MANUAL_SOS", userId: "demo-user", contactIds, landmarkNote: landmarkNote || undefined, location: browserLoc || undefined };
    try { const r = await api.sos(payload); setLastSos(r); return r; }
    catch (e) {
      if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) {
        const q = [...readQ(), payload]; writeQ(q); setLocalQueue(q);
        const r = { queuedLocally: true, payload }; setLastSos(r); return r;
      }
      const r = { error: e.message }; setLastSos(r); return r;
    }
  }, [browserLoc]);

  const online = (typeof navigator === "undefined" ? true : navigator.onLine) && backendUp;
  return (
    <Ctx.Provider value={{ status, backendUp, online, browserLoc, locError, enableLocation, bestLocation, sendSos, lastSos, localQueue, flushQueue }}>
      {children}
    </Ctx.Provider>
  );
}
