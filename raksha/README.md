# RAKSHA — Safety & Emergency Response (upgrade of HER-SHIELD)

React + Vite + Tailwind + Leaflet frontend, Express backend, **SQLite** persistence (better-sqlite3), optional ESP32-C3 device.
Every original feature is kept; RAKSHA adds an honest emergency layer on top. **Prototype — not a certified emergency or medical system.**

## Run on macOS (Node 18+)
```bash
cd raksha/backend && cp .env.example .env && npm install && npm start      # API :4000
cd raksha/frontend && npm install && npm run dev                           # UI  :5173
cd raksha/backend && npm test                                              # 13 tests
```
Open http://localhost:5173 → **Emergency & Device**. No hardware? Click **Start demo mode** (labelled `SIMULATED — DEVICE OFFLINE`).
For a delivery demo without Telegram set `DELIVERY_MODE=mock` (labelled "mock (simulated)").

## Environment variables (backend/.env, never in frontend)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (default recipient chat), `PUBLIC_BASE_URL` (enables acknowledge link), `DEVICE_API_KEY`
(device must send `x-device-key`), `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (optional summary), `DELIVERY_MODE`, tunables
`GPS_STALE_AFTER_S` `GPS_RELIABLE_M` `FALL_IMPACT_G` `FALL_CONFIRM_WINDOW_S` `SOS_COOLDOWN_S` `MAX_ATTEMPTS`.
Telegram setup: create a bot with @BotFather, message it (or add to a group), get the chat id from `getUpdates`.

## Implemented / simulated / future
| Implemented & tested (automated) | Simulated (labelled in UI) | Not implemented / untested |
|---|---|---|
| Location Confidence Engine, telemetry validation, fall state machine (synthetic data), SOS idempotency + cooldown, SQLite persistence, delivery queue with retries/backoff/FAILED, missed check-in → one incident + queued alerts, incident card, deterministic summary | Demo device (GPS fixed at sample route start, accel, SpO₂ 97, temp 36.6), synthetic fall, `mock` delivery, trip route progress when no browser GPS | **Telegram live send** (code written, not run: no token here), **AI summary live call**, **firmware + serial bridge on real hardware**, SpO₂/temperature drivers, SMS/WhatsApp/emergency-service dispatch (none exist) |

## Existing features: preserved / repaired / changed
- **Preserved**: Dashboard, Invisible Burden AI, Health Timeline (+cycle prediction), Campus Whisper reports, Safe Route Score + Night Mode, Heatmap, Trusted Companion, Smart Check-ins, SMS fallback, all existing API contracts (verified HTTP 200 on every original endpoint).
- **Repaired**: Smart Check-ins re-escalated every 2 s (stale React closure) and a missed check-in only changed a label → now the backend escalates **once** and queues real alerts; trips persist across restarts; timers start immediately; errors are shown; Trusted Companion can use real browser GPS (was always simulated) and shows per-contact alert status; GPS timestamp bug found by tests.
- **Changed for honesty**: "Safest Route" → "Highest-comfort Route (estimate)" + disclaimer; SMS links are "manual — delivery not tracked"; simulated trip positions are never reported as a location in alerts.
- **Removed**: the header notification bell (decorative, did nothing). Nothing else removed.
- **Not changed**: Safe Routes still uses the original sample routes (no live routing API) and has no geolocation prompt.

## API (all under /api)
```bash
curl -XPOST :4000/api/sos -H 'content-type: application/json' -d '{"clientEventId":"evt-123456","landmarkNote":"Gate 2","location":{"lat":22.72,"lng":75.86,"accuracy":15,"timestamp":"2026-01-01T10:00:00Z"}}'
curl :4000/api/incidents ; curl :4000/api/incidents/INC_ID/card ; curl :4000/api/incidents/INC_ID/summary
curl -XPOST :4000/api/device/telemetry -H 'content-type: application/json' -d '{"deviceId":"esp32c3-1","gps":{"fix":true,"lat":22.72,"lng":75.86},"accel":{"x":0,"y":0,"z":1}}'
curl :4000/api/status ; curl :4000/api/device/status ; curl ':4000/api/alerts?incidentId=INC_ID'
curl -XPOST :4000/api/alerts/ALERT_ID/retry ; curl -XPOST :4000/api/device/simulate -d '{"enabled":true}' -H 'content-type: application/json'
curl -XPOST :4000/api/checkins/start -H 'content-type: application/json' -d '{"destination":"Home","windowMinutes":1,"contactIds":["tc-1"]}'
curl :4000/api/checkins/TRIP_ID/events      # persisted check-in transitions
```
Also: `POST /device/fall/{cancel,confirm}`, `POST /device/simulate/fall`, `GET /device/readings`, `POST /checkins/:id/{confirm,cancel,escalate,location}`, `GET /alerts/ack/:token`, `POST /location/assess`.
Alert states: QUEUED → SENDING → SENT → ACKNOWLEDGED | FAILED. SENT = the provider API accepted it. ACKNOWLEDGED only when the contact opens the ack link. Contacts with no usable channel show FAILED ("use manual SMS link").

## Behaviour notes / known limits
- Location status: RELIABLE (accuracy known ≤ 50 m and ≤ 60 s old), APPROXIMATE (low or **unknown** accuracy), STALE (> 60 s), UNAVAILABLE (no fix/invalid). Accuracy is never invented.
- Fall detector: impact ≥ 2.5 g then ~1 g stillness for 1.5 s → confirmation window (20 s) → auto-SOS. Threshold baseline tested only on **synthetic** data; no real-world accuracy claim. Manual SOS is always in the header.
- Offline: if the backend is unreachable the browser stores the SOS locally (shown as "NOT sent") and retries; its server timestamp will be the time it finally arrives. Server-side alert retry is bounded (6 attempts, exponential backoff), then FAILED with manual Retry.
- Browser GPS is only read after you click Enable (or start a trip) and is sent to the server only with an SOS or active trip.
- Privacy: DB file `backend/data/raksha.db` (git-ignored); sensor history sampled ≤ 1/30 s, kept 7 days; secrets only in backend env.
- Auth is not implemented (single demo user). Do not expose the server publicly without adding it.

## Hardware (UNVERIFIED — firmware has never run on a board)
Files: `firmware/raksha_device/` (Arduino, libs **TinyGPSPlus**, **U8g2**), `tools/serial-bridge.js`.
1. Read the labels/datasheets of your real modules. ESP32-C3 GPIO is **3.3 V only**; check each module's supply (3.3 V vs 5 V) and logic level. The "S6MV2" GPS label could not be mapped to a known chip — confirm NMEA baud with a serial monitor.
2. Edit `config.h`: GPS RX/TX pins, I2C SDA/SCL, accelerometer type (scan I2C: 0x68 MPU6050-class, 0x53 ADXL345, 0x3C OLED), touch pin. The sketch refuses to compile until pins are set. Wire GPS TX→ESP RX, GPS RX→ESP TX, shared GND.
3. Flash; open serial monitor @115200: expect `{"type":"telemetry",…}` lines. SpO₂/temperature are not implemented (show "Unavailable").
4. `node tools/serial-bridge.js /dev/cu.usbmodemXXXX` (find port with `ls /dev/cu.*`). Header chip should become **Device: LIVE**; demo mode disables itself.
5. Checklist: ☐ GPS shows SEARCHING → LOCATION outdoors ☐ Status shows accel Available ☐ unplug USB → device goes offline within ~15 s ☐ one touch = exactly one incident (try rapid taps) ☐ OLED shows SOS INITIATED then Alert queued/sent/failed matching the Emergency page ☐ stop backend → OLED "Connection unavailable" ☐ shake/drop-test gently (soft surface) and confirm the fall banner, then cancel.
Real-time fall detection depends on the device sending the strongest sample each 100 ms; tune `FALL_IMPACT_G` on your hardware.

## Test results (executed in this build)
`npm test`: 13/13 pass (unit: location, telemetry validation, fall detector incl. false-positive cases; API: SOS idempotency/concurrency/cooldown, retry→SENT, bounded retry→FAILED, no-channel→FAILED, hardware vs simulated separation, invalid telemetry 400, simulated fall → cancel, card + AI-less summary, missed check-in escalates once, persistence across restart). Frontend `vite build` passes; all original endpoints return 200 via the Vite proxy.
**Not executed**: browser click-through of every page, Telegram, AI provider, hardware, mobile layout.
