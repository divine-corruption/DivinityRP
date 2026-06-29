-- DivinityRP auth-worker schema (Cloudflare D1 / SQLite)
-- Mirrors the app's Postgres "User" table shape closely enough to interoperate.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,            -- uuid
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                        -- PBKDF2 "iterations:saltB64:hashB64"; null for anonymous
  name          TEXT,
  is_anonymous  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,            -- epoch ms
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Optional audit of issued refresh tokens (revocation support).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
