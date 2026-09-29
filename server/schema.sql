-- BTTN ladder server (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  flagged INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS saves (
  player_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  ts INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ladder (
  player_id TEXT PRIMARY KEY,
  season INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  cls TEXT NOT NULL,
  lvl INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  power INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ladder_depth ON ladder (season, depth DESC, power DESC);
CREATE INDEX IF NOT EXISTS ladder_power ON ladder (season, power DESC);
