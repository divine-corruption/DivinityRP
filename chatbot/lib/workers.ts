/**
 * Server-side clients for the DivinityRP Cloudflare Workers.
 *
 * These wrap the four edge workers (media / auth / backup / enhance). Each is
 * optional: if its *_WORKER_URL env var is unset, the helper reports
 * "not configured" and the caller falls back to the app's existing behavior
 * (R2-direct, Vercel Blob, local FS, or simply skipping enhancement). This keeps
 * the app fully functional whether or not the workers are deployed.
 *
 * All mutating worker calls forward a bearer JWT. In this codebase the app and
 * the workers share `JWT_SECRET`; `mintInternalToken` issues a short-lived token
 * the workers accept, so server routes can call workers without a user session.
 */

import { createHmac } from "crypto";

const MEDIA_WORKER_URL = process.env.MEDIA_WORKER_URL?.replace(/\/$/, "") ?? "";
const AUTH_WORKER_URL = process.env.AUTH_WORKER_URL?.replace(/\/$/, "") ?? "";
const BACKUP_WORKER_URL = process.env.BACKUP_WORKER_URL?.replace(/\/$/, "") ?? "";
const ENHANCE_WORKER_URL =
  process.env.ENHANCE_WORKER_URL?.replace(/\/$/, "") ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? process.env.AUTH_SECRET ?? "";

export const workers = {
  media: Boolean(MEDIA_WORKER_URL),
  auth: Boolean(AUTH_WORKER_URL),
  backup: Boolean(BACKUP_WORKER_URL),
  enhance: Boolean(ENHANCE_WORKER_URL),
};

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Mint a short-lived HS256 JWT the workers will accept (same shape auth-worker
 * issues). Used for server->worker calls that aren't tied to a user session.
 */
export function mintInternalToken(
  sub = "app-internal",
  ttlSeconds = 300
): string | null {
  if (!JWT_SECRET) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub, iat: now, exp: now + ttlSeconds, internal: true })
  );
  const data = `${header}.${payload}`;
  const sig = b64url(createHmac("sha256", JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

function authHeaders(token?: string | null): Record<string, string> {
  const t = token ?? mintInternalToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ---- media-worker -----------------------------------------------------------

export interface MediaUploadResult {
  url: string;
  key: string;
  contentType: string;
  type: "image" | "video";
  characterId?: string;
}

/**
 * Upload bytes to the media-worker. Returns null if the worker isn't configured
 * so the caller can fall back to its existing storage path.
 */
export async function mediaWorkerUpload(
  bytes: ArrayBuffer | Buffer | Uint8Array,
  filename: string,
  contentType: string,
  opts?: { characterId?: string; source?: string; token?: string | null }
): Promise<MediaUploadResult | null> {
  if (!MEDIA_WORKER_URL) return null;

  const form = new FormData();
  const blob = new Blob([bytes as BlobPart], {
    type: contentType || "application/octet-stream",
  });
  form.append("file", blob, filename);
  if (opts?.characterId) form.append("characterId", opts.characterId);
  if (opts?.source) form.append("source", opts.source);

  const res = await fetch(`${MEDIA_WORKER_URL}/upload`, {
    method: "POST",
    headers: authHeaders(opts?.token),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`media-worker upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as MediaUploadResult;
}

// ---- enhance-worker ---------------------------------------------------------

export interface EnhanceResult {
  enhanced: string;
  fallback?: boolean;
}

/**
 * Ask the enhance-worker to enrich a draft reply. Returns null if not configured
 * or on any error — the caller should then keep the original draft.
 */
export async function enhanceResponse(input: {
  draft: string;
  character?: string;
  recentContext?: string;
  intensity?: "subtle" | "normal" | "extreme";
  token?: string | null;
}): Promise<EnhanceResult | null> {
  if (!ENHANCE_WORKER_URL) return null;
  try {
    const res = await fetch(`${ENHANCE_WORKER_URL}/enhance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(input.token),
      },
      body: JSON.stringify({
        draft: input.draft,
        character: input.character,
        recentContext: input.recentContext,
        intensity: input.intensity ?? "normal",
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as EnhanceResult;
  } catch {
    return null;
  }
}

// ---- backup-worker ----------------------------------------------------------

/** Push a versioned snapshot of a user's state to the backup-worker. */
export async function backupSnapshot(
  state: unknown,
  opts?: { label?: string; token?: string | null }
): Promise<{ ok: boolean; version?: number } | null> {
  if (!BACKUP_WORKER_URL) return null;
  try {
    const res = await fetch(`${BACKUP_WORKER_URL}/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(opts?.token),
      },
      body: JSON.stringify({ state, label: opts?.label }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { ok: boolean; version?: number };
  } catch {
    return null;
  }
}

export const workerUrls = {
  media: MEDIA_WORKER_URL,
  auth: AUTH_WORKER_URL,
  backup: BACKUP_WORKER_URL,
  enhance: ENHANCE_WORKER_URL,
};
