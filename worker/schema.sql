-- Co-op radio room directory for The Last Dead · Blackwater.
-- Mirrors sites/blackwater/drizzle/0000_glorious_reavers.sql so the standalone
-- Worker and the Sites deployment can share the same protocol and schema.
CREATE TABLE IF NOT EXISTS coop_rooms (
  code TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_token TEXT NOT NULL,
  host_seen INTEGER NOT NULL,
  host_json TEXT DEFAULT '{}' NOT NULL,
  guest_name TEXT DEFAULT '' NOT NULL,
  guest_token TEXT,
  guest_seen INTEGER DEFAULT 0 NOT NULL,
  guest_json TEXT DEFAULT '{}' NOT NULL,
  status TEXT DEFAULT 'waiting' NOT NULL
);
