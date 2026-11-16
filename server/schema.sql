-- Portable schema for the self-hosted (SQLite) deployment.
-- Mirrors functions/router.mjs table/column expectations.
-- Timestamps are stored as ISO-8601 text; booleans as 0/1 integers.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  nickname_key TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  verified_at TEXT,
  status TEXT,
  sanction_until TEXT,
  sanction_reason TEXT,
  email TEXT,
  email_consent INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS auth_limiter (
  key TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verify_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS verify_codes_user_idx ON verify_codes (user_id, created_at);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notices_created_idx ON notices (created_at);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS updates_created_idx ON updates (created_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_deleted_created_idx ON events (deleted, created_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at, id);

CREATE TABLE IF NOT EXISTS chat_presence (
  user_id TEXT PRIMARY KEY,
  last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_presence_seen_idx ON chat_presence (last_seen);

CREATE TABLE IF NOT EXISTS server_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS server_status (
  id TEXT PRIMARY KEY,
  online INTEGER NOT NULL,
  players INTEGER NOT NULL,
  max_players INTEGER NOT NULL,
  host TEXT,
  java_port INTEGER,
  bedrock_port INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_path TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_board_created_idx ON posts (board, created_at);
CREATE INDEX IF NOT EXISTS posts_user_idx ON posts (user_id);

CREATE TABLE IF NOT EXISTS mail_log (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  sent_count INTEGER NOT NULL,
  failed_count INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mail_log_created_idx ON mail_log (created_at);

CREATE TABLE IF NOT EXISTS mail_settings (
  id TEXT PRIMARY KEY,
  relay_url TEXT NOT NULL,
  relay_token TEXT NOT NULL,
  sender_address TEXT,
  updated_at TEXT NOT NULL
);
