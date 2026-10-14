const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Burden
  getBurdenHistory: (userId) => request(`/burden/history/${userId}`),
  calculateBurden: (payload) => request(`/burden/calculate`, { method: "POST", body: JSON.stringify(payload) }),

  // Health
  getHealthTimeline: (userId) => request(`/health/timeline/${userId}`),
  getHealthPrediction: (userId) => request(`/health/predict/${userId}`),
  addHealthEntry: (payload) => request(`/health/entry`, { method: "POST", body: JSON.stringify(payload) }),

  // Whisper
  getWhisperReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/whisper/reports${qs ? `?${qs}` : ""}`);
  },
  submitWhisperReport: (payload) => request(`/whisper/reports`, { method: "POST", body: JSON.stringify(payload) }),

  // Routes
  scoreRoutes: (payload) => request(`/routes/score`, { method: "POST", body: JSON.stringify(payload) }),
  getRouteOptions: () => request(`/routes/options`),

  // Check-ins / Trusted Companion
  startTrip: (payload) => request(`/checkins/start`, { method: "POST", body: JSON.stringify(payload) }),
  getActiveTrips: (userId) => request(`/checkins/active/${userId}`),
  getTrip: (tripId) => request(`/checkins/${tripId}`),
  confirmTrip: (tripId) => request(`/checkins/${tripId}/confirm`, { method: "POST" }),
  cancelTrip: (tripId) => request(`/checkins/${tripId}/cancel`, { method: "POST" }),
  escalateTrip: (tripId, reason) =>
    request(`/checkins/${tripId}/escalate`, { method: "POST", body: JSON.stringify({ reason }) }),

  // SMS fallback
  checkConnectivity: (signalStrength) =>
    request(`/sms/check-connectivity`, { method: "POST", body: JSON.stringify({ signalStrength }) }),
  sendSmsFallback: (payload) => request(`/sms/fallback`, { method: "POST", body: JSON.stringify(payload) }),

  // Heatmap
  getHeatmapPoints: () => request(`/heatmap/points`),

  // Emergency (RAKSHA)
  getStatus: () => request(`/status`),
  sos: (payload) => request(`/sos`, { method: "POST", body: JSON.stringify(payload) }),
  getIncidents: () => request(`/incidents`),
  getIncidentCard: (id) => request(`/incidents/${id}/card`),
  getIncidentSummary: (id) => request(`/incidents/${id}/summary`),
  resolveIncident: (id) => request(`/incidents/${id}/resolve`, { method: "POST" }),
  retryAlert: (id) => request(`/alerts/${id}/retry`, { method: "POST" }),
  assessLocation: (location) => request(`/location/assess`, { method: "POST", body: JSON.stringify({ location }) }),
  setSimulation: (enabled) => request(`/device/simulate`, { method: "POST", body: JSON.stringify({ enabled }) }),
  simulateFall: () => request(`/device/simulate/fall`, { method: "POST", body: "{}" }),
  cancelFall: () => request(`/device/fall/cancel`, { method: "POST", body: "{}" }),
  confirmFall: () => request(`/device/fall/confirm`, { method: "POST", body: "{}" }),
  getReadings: () => request(`/device/readings`),
  sendTripLocation: (tripId, loc) => request(`/checkins/${tripId}/location`, { method: "POST", body: JSON.stringify(loc) }),

  // Users
  getUser: (id) => request(`/users/${id}`),
};
