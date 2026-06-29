/**
 * DivinityRP auth-worker
 * ----------------------
 * Centralized identity for the app + the other workers. Mints HS256 JWTs that
 * media-worker, backup-worker, and enhance-worker all verify with the shared
 * JWT_SECRET.
 *
 * Endpoints (JSON, CORS-enabled):
 *   POST /register  { email, password, name? }  -> { token, user }
 *   POST /login     { email, password }          -> { token, user }
 *   POST /guest                                  -> { token, user }  (anonymous)
 *   GET  /verify    (Authorization: Bearer …)    -> { valid, user }
 *   GET  /me        (Authorization: Bearer …)    -> { user }
 *   POST /logout    (Authorization: Bearer …)    -> { ok }  (revokes jti)
 *   GET  /health                                 -> { ok, dbBound }
 *
 * Storage: D1 (users + refresh_tokens), KV (revocation set + hot session cache).
 */

import { hashPassword, signJwt, verifyJwt, verifyPassword } from "./crypto";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  APP_ORIGIN: string;
  ACCESS_TTL: string;
  ALLOW_GUEST: string;
  JWT_SECRET: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  is_anonymous: number;
  created_at: number;
  updated_at: number;
}

function cors(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isAnonymous: Boolean(u.is_anonymous),
    createdAt: u.created_at,
  };
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function mintToken(env: Env, u: UserRow): Promise<string> {
  const ttl = Number(env.ACCESS_TTL) || 604800;
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const token = await signJwt(
    {
      sub: u.id,
      email: u.email,
      isAnonymous: Boolean(u.is_anonymous),
      jti,
      exp: now + ttl,
    },
    env.JWT_SECRET
  );
  // Track the jti so /logout can revoke it (best-effort; absence = valid).
  await env.SESSIONS.put(`jti:${jti}`, u.id, { expirationTtl: ttl });
  return token;
}

async function getUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    "SELECT * FROM users WHERE email = ?1 LIMIT 1"
  )
    .bind(email.toLowerCase())
    .first<UserRow>();
  return row ?? null;
}

async function getUserById(env: Env, id: string): Promise<UserRow | null> {
  const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?1 LIMIT 1")
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

async function handleRegister(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400, origin);
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400, origin);
  }

  const existing = await getUserByEmail(env, email);
  if (existing) return json({ error: "Email already registered" }, 409, origin);

  const now = Date.now();
  const user: UserRow = {
    id: crypto.randomUUID(),
    email,
    password_hash: await hashPassword(password),
    name: body.name?.trim() || null,
    is_anonymous: 0,
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, name, is_anonymous, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)"
  )
    .bind(
      user.id,
      user.email,
      user.password_hash,
      user.name,
      user.is_anonymous,
      user.created_at,
      user.updated_at
    )
    .run();

  const token = await mintToken(env, user);
  return json({ token, user: publicUser(user) }, 201, origin);
}

async function handleLogin(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return json({ error: "Email and password required" }, 400, origin);
  }
  const user = await getUserByEmail(env, email);
  // Constant-ish response regardless of which check fails.
  if (!user || !user.password_hash) {
    return json({ error: "Invalid credentials" }, 401, origin);
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return json({ error: "Invalid credentials" }, 401, origin);

  const token = await mintToken(env, user);
  return json({ token, user: publicUser(user) }, 200, origin);
}

async function handleGuest(env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  if ((env.ALLOW_GUEST ?? "true").toLowerCase() === "false") {
    return json({ error: "Guest accounts disabled" }, 403, origin);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const user: UserRow = {
    id,
    email: `guest_${id}@anon.divinityrp`,
    password_hash: null,
    name: "Guest",
    is_anonymous: 1,
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, name, is_anonymous, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)"
  )
    .bind(user.id, user.email, null, user.name, 1, now, now)
    .run();
  const token = await mintToken(env, user);
  return json({ token, user: publicUser(user) }, 201, origin);
}

async function authedPayload(req: Request, env: Env) {
  const h = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const payload = await verifyJwt(m[1], env.JWT_SECRET);
  if (!payload) return null;
  // Honor revocation: if a jti was explicitly revoked, reject.
  if (payload.jti) {
    const revoked = await env.SESSIONS.get(`revoked:${payload.jti}`);
    if (revoked) return null;
  }
  return payload;
}

async function handleVerify(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const payload = await authedPayload(req, env);
  if (!payload) return json({ valid: false }, 200, origin);
  const user = await getUserById(env, payload.sub);
  if (!user) return json({ valid: false }, 200, origin);
  return json({ valid: true, user: publicUser(user) }, 200, origin);
}

async function handleMe(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const payload = await authedPayload(req, env);
  if (!payload) return json({ error: "Unauthorized" }, 401, origin);
  const user = await getUserById(env, payload.sub);
  if (!user) return json({ error: "Not found" }, 404, origin);
  return json({ user: publicUser(user) }, 200, origin);
}

async function handleLogout(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const payload = await authedPayload(req, env);
  if (!payload) return json({ ok: true }, 200, origin);
  if (payload.jti) {
    const ttl = Math.max(
      60,
      (payload.exp ?? Math.floor(Date.now() / 1000)) -
        Math.floor(Date.now() / 1000)
    );
    await env.SESSIONS.put(`revoked:${payload.jti}`, "1", {
      expirationTtl: ttl,
    });
  }
  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = env.APP_ORIGIN || "*";
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (pathname === "/health") {
      return json({ ok: true, dbBound: Boolean(env.DB) }, 200, origin);
    }
    if (pathname === "/register" && req.method === "POST") {
      return handleRegister(req, env);
    }
    if (pathname === "/login" && req.method === "POST") {
      return handleLogin(req, env);
    }
    if (pathname === "/guest" && req.method === "POST") {
      return handleGuest(env);
    }
    if (pathname === "/verify" && req.method === "GET") {
      return handleVerify(req, env);
    }
    if (pathname === "/me" && req.method === "GET") {
      return handleMe(req, env);
    }
    if (pathname === "/logout" && req.method === "POST") {
      return handleLogout(req, env);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};
