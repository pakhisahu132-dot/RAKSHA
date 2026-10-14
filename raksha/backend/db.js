// SQLite persistence (better-sqlite3). Incidents, alerts, events, readings and trips survive restarts.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_PATH || path.join(here, "data", "raksha.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new Database(file);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY, client_event_id TEXT UNIQUE, type TEXT NOT NULL, user_id TEXT NOT NULL,
  created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', simulated INTEGER NOT NULL DEFAULT 0,
  trip_id TEXT, location TEXT NOT NULL, sensors TEXT NOT NULL, device TEXT NOT NULL,
  contact_ids TEXT NOT NULL, landmark_note TEXT, summary_ai TEXT);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, dedupe_key TEXT UNIQUE NOT NULL, channel TEXT NOT NULL,
  recipient TEXT NOT NULL, chat_id TEXT, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, created_at TEXT NOT NULL, next_attempt_at INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT, acknowledged_at TEXT, ack_token TEXT UNIQUE, provider_ref TEXT);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, event TEXT NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS ev_entity ON events(entity_id);
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, source TEXT NOT NULL, spo2 REAL, temp_c REAL);
CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, json TEXT NOT NULL);
`);

export const logEvent = (entityType, entityId, event, detail = null) =>
  db.prepare("INSERT INTO events (ts, entity_type, entity_id, event, detail) VALUES (?,?,?,?,?)")
    .run(new Date().toISOString(), entityType, entityId, event, detail ? JSON.stringify(detail) : null);
