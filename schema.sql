-- Application schema for a new function_backend site.
-- Apply through the reviewed migration flow; never against a database that
-- already contains production data.

-- Accounts are owned by the site, not by the platform identity.
CREATE TABLE app.users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  nickname text NOT NULL,
  nickname_key text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  password_iterations integer NOT NULL,
  role text NOT NULL DEFAULT 'user',
  verified_at timestamptz,
  status text,
  sanction_until timestamptz,
  sanction_reason text,
  email text,
  email_consent boolean,
  created_at timestamptz NOT NULL
);

-- Only the SHA-256 digest of the session token is stored.
CREATE TABLE app.sessions (
  token_digest text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users (id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON app.sessions (user_id);

-- Fixed-window attempt counters (login, registration, chat, verification).
CREATE TABLE app.auth_limiter (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL
);

-- Short-lived codes the in-game plugin submits to prove nickname ownership.
CREATE TABLE app.verify_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users (id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX verify_codes_user_idx ON app.verify_codes (user_id, created_at);

CREATE TABLE app.notices (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX notices_created_idx ON app.notices (created_at);

CREATE TABLE app.updates (
  id uuid PRIMARY KEY,
  version text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX updates_created_idx ON app.updates (created_at);

CREATE TABLE app.events (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  thumbnail_path text NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX events_deleted_created_idx ON app.events (deleted, created_at);

CREATE TABLE app.chat_messages (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  body text NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX chat_messages_created_idx ON app.chat_messages (created_at, id);

-- Heartbeat written by the chat poll; the chat page lists fresh entries.
CREATE TABLE app.chat_presence (
  user_id uuid PRIMARY KEY,
  last_seen timestamptz NOT NULL
);
CREATE INDEX chat_presence_seen_idx ON app.chat_presence (last_seen);

-- Editable server identity and connection details shown on the homepage.
CREATE TABLE app.server_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Latest heartbeat from the in-game plugin. A single row keeps the homepage
-- status live without exposing the real server address.
CREATE TABLE app.server_status (
  id text PRIMARY KEY,
  online boolean NOT NULL,
  players integer NOT NULL,
  max_players integer NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Free and photo board posts; photos live in Storage and are served through
-- the Function with a short-lived signed URL.
CREATE TABLE app.posts (
  id uuid PRIMARY KEY,
  board text NOT NULL,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_path text,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX posts_board_created_idx ON app.posts (board, created_at);
CREATE INDEX posts_user_idx ON app.posts (user_id);

-- One row per mass-mail send so the admin surfaces can show history.
CREATE TABLE app.mail_log (
  id uuid PRIMARY KEY,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_count integer NOT NULL,
  sent_count integer NOT NULL,
  failed_count integer NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX mail_log_created_idx ON app.mail_log (created_at);

-- HTTPS relay that holds the Gmail credentials. Single row, id = 'default'.
CREATE TABLE app.mail_settings (
  id text PRIMARY KEY,
  relay_url text NOT NULL,
  relay_token text NOT NULL,
  sender_address text,
  updated_at timestamptz NOT NULL
);
