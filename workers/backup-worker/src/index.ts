/**
 * DivinityRP backup-worker
 * ------------------------
 * Versioned snapshots of each user's roleplay state in R2, with point-in-time
 * recovery and a scheduled (cron) safety heartbeat.
 *
 * The Next.js app stores per-user state as a single "latest" JSON doc at:
 *   state/users/<userId>/roleplay.json        (last-write-wins, read by the app)
 *
 * This worker keeps that pointer compatible AND adds an append-only history:
 *   state/users/<userId>/history/<timestampMs>.json
 * so state can be recovered after loss/corruption. Old versions beyond
 * MAX_VERSIONS are pruned automatically on each snapshot.
 *
 * Endpoints (all JSON, CORS-enabled, auth via auth-worker JWT):
 *   GET    /health                  -> { ok, bucketBound }
 *   POST   /snapshot                body { state, label? }
 *                                   -> { ok, version, key }
 *   GET    /versions                -> { versions: [{ version, key, size, uploaded, label }] }
 *   GET    /snapshot?version=<ts>   -> { version, state }  (latest if version omitted)
 *   POST   /restore                 body { version }
 *                                   -> { ok, restoredFrom, newVersion }
 *   DELETE /versions/<ts>           -> { ok }
 *
 * Scheduled:
 *   cron "0 *6 * * *" -> logged retention heartbeat (non-destructive).
 */

import { bearerToken, corsHeaders, json, verifyJwt } from "./shared";

export interface Env {
  STATE: R2Bucket;
  APP_ORIGIN: string;
  MAX_VERSIONS: string;
  REQUIRE_AUTH: string;
  JWT_SECRET?: string;
}

/** Key of the "latest" pointer the app reads/writes. */
function latestKey(userId: string): string {
  return `state/users/${userId}/roleplay.json`;
}

/** Prefix under which versioned history snapshots live for a user. */
function historyPrefix(userId: string): string {
  return `state/users/${userId}/history/`;
}

/** Key of a specific versioned history snapshot. */
function historyKey(userId: string, version: number): string {
  return `${historyPrefix(userId)}${version}.json`;
}

/** Parse the numeric timestamp version from a history key filename. */
function versionFromKey(key: string): number | null {
  const file = key.split("/").pop() ?? "";
  const base = file.replace(/\.json$/i, "");
  const n = Number(base);
  return Number.isFinite(n) && base !== "" ? n : null;
}

async function requireAuth(
  req: Request,
  env: Env
): Promise<{ ok: true; userId: string } | { ok: false }> {
  if ((env.REQUIRE_AUTH ?? "true").toLowerCase() === "false") {
    return { ok: true, userId: "anonymous" };
  }
  const token = bearerToken(req);
  if (!token || !env.JWT_SECRET) return { ok: false };
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return { ok: false };
  return { ok: true, userId: payload.sub };
}

/** List all history snapshots for a user, sorted newest-first. */
async function listVersions(
  env: Env,
  userId: string
): Promise<
  Array<{
    version: number;
    key: string;
    size: number;
    uploaded: Date;
    label: string | null;
  }>
> {
  const prefix = historyPrefix(userId);
  const out: Array<{
    version: number;
    key: string;
    size: number;
    uploaded: Date;
    label: string | null;
  }> = [];

  let cursor: string | undefined;
  do {
    const listed = await env.STATE.list({ prefix, limit: 1000, cursor });
    for (const o of listed.objects) {
      const version = versionFromKey(o.key);
      if (version === null) continue;
      out.push({
        version,
        key: o.key,
        size: o.size,
        uploaded: o.uploaded,
        label: o.customMetadata?.label ?? null,
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  out.sort((a, b) => b.version - a.version);
  return out;
}

/**
 * Write a versioned history snapshot for the user. Returns the version (ts).
 * Also prunes the oldest versions beyond MAX_VERSIONS.
 */
async function writeHistory(
  env: Env,
  userId: string,
  state: unknown,
  label: string | null,
  version: number
): Promise<void> {
  const body = JSON.stringify(state);
  await env.STATE.put(historyKey(userId, version), body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      ...(label ? { label } : {}),
      createdAt: new Date(version).toISOString(),
    },
  });

  // Prune oldest beyond MAX_VERSIONS.
  const max = Number(env.MAX_VERSIONS) || 50;
  const versions = await listVersions(env, userId); // newest-first
  if (versions.length > max) {
    const toDelete = versions.slice(max); // oldest entries
    for (const v of toDelete) {
      await env.STATE.delete(v.key);
    }
  }
}

async function handleSnapshotWrite(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return json({ error: "Expected JSON body" }, 400, origin);
  }
  const bodyObj = (parsed ?? {}) as { state?: unknown; label?: unknown };
  if (typeof bodyObj.state !== "object" || bodyObj.state === null) {
    return json({ error: "Body must include a 'state' object" }, 400, origin);
  }
  const state = bodyObj.state;
  const label =
    typeof bodyObj.label === "string" && bodyObj.label.trim()
      ? bodyObj.label.trim().slice(0, 200)
      : null;

  const version = Date.now();
  const body = JSON.stringify(state);

  // 1) Update the "latest" pointer the app reads.
  await env.STATE.put(latestKey(auth.userId), body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      ...(label ? { label } : {}),
      version: String(version),
      updatedAt: new Date(version).toISOString(),
    },
  });

  // 2) Write the versioned history copy + prune.
  await writeHistory(env, auth.userId, state, label, version);

  return json(
    { ok: true, version, key: historyKey(auth.userId, version) },
    200,
    origin
  );
}

async function handleSnapshotRead(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  const url = new URL(req.url);
  const versionParam = url.searchParams.get("version");

  let key: string;
  let version: number | null;
  if (versionParam) {
    const v = Number(versionParam);
    if (!Number.isFinite(v)) {
      return json({ error: "Invalid version" }, 400, origin);
    }
    version = v;
    key = historyKey(auth.userId, v);
  } else {
    version = null;
    key = latestKey(auth.userId);
  }

  const obj = await env.STATE.get(key);
  if (!obj) return json({ error: "Not found" }, 404, origin);

  let state: unknown;
  try {
    state = await obj.json();
  } catch {
    return json({ error: "Stored snapshot is not valid JSON" }, 500, origin);
  }

  const resolvedVersion =
    version ??
    (obj.customMetadata?.version ? Number(obj.customMetadata.version) : null);

  return json({ version: resolvedVersion, state }, 200, origin);
}

async function handleVersions(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  const versions = await listVersions(env, auth.userId);
  return json(
    {
      versions: versions.map((v) => ({
        version: v.version,
        key: v.key,
        size: v.size,
        uploaded: v.uploaded,
        label: v.label,
      })),
    },
    200,
    origin
  );
}

async function handleRestore(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return json({ error: "Expected JSON body" }, 400, origin);
  }
  const bodyObj = (parsed ?? {}) as { version?: unknown };
  const version = Number(bodyObj.version);
  if (!Number.isFinite(version)) {
    return json({ error: "Body must include a numeric 'version'" }, 400, origin);
  }

  const src = await env.STATE.get(historyKey(auth.userId, version));
  if (!src) return json({ error: "Version not found" }, 404, origin);

  let state: unknown;
  try {
    state = await src.json();
  } catch {
    return json({ error: "Stored snapshot is not valid JSON" }, 500, origin);
  }

  const body = JSON.stringify(state);
  const newVersion = Date.now();
  const label = `restore of ${version}`;

  // 1) Overwrite the "latest" pointer with the historical state.
  await env.STATE.put(latestKey(auth.userId), body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      label,
      version: String(newVersion),
      restoredFrom: String(version),
      updatedAt: new Date(newVersion).toISOString(),
    },
  });

  // 2) Record the restore as a new history entry (+ prune).
  await writeHistory(env, auth.userId, state, label, newVersion);

  return json(
    { ok: true, restoredFrom: version, newVersion },
    200,
    origin
  );
}

async function handleDeleteVersion(
  req: Request,
  env: Env,
  version: number
): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  if (!Number.isFinite(version)) {
    return json({ error: "Invalid version" }, 400, origin);
  }
  await env.STATE.delete(historyKey(auth.userId, version));
  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = env.APP_ORIGIN || "*";
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (pathname === "/health") {
      return json({ ok: true, bucketBound: Boolean(env.STATE) }, 200, origin);
    }

    if (pathname === "/snapshot") {
      if (req.method === "POST") return handleSnapshotWrite(req, env);
      if (req.method === "GET") return handleSnapshotRead(req, env);
    }

    if (pathname === "/versions" && req.method === "GET") {
      return handleVersions(req, env);
    }

    if (pathname === "/restore" && req.method === "POST") {
      return handleRestore(req, env);
    }

    if (pathname.startsWith("/versions/") && req.method === "DELETE") {
      const raw = decodeURIComponent(pathname.slice("/versions/".length));
      const version = Number(raw);
      return handleDeleteVersion(req, env, version);
    }

    return json({ error: "Not found" }, 404, origin);
  },

  async scheduled(
    event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Non-destructive retention heartbeat. Per-user snapshots are pushed by the
    // app (which also prunes), so the cron only logs liveness here. Kept as a
    // safe stub that performs no destructive work.
    void ctx;
    console.log(
      JSON.stringify({
        event: "backup-worker.scheduled",
        cron: event.cron,
        scheduledTime: event.scheduledTime,
        bucketBound: Boolean(env.STATE),
        maxVersions: Number(env.MAX_VERSIONS) || 50,
        at: new Date().toISOString(),
      })
    );
  },
};
