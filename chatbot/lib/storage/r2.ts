import { createHash, createHmac } from "crypto";

/**
 * Cloudflare R2 storage helper (S3-compatible) using AWS SigV4 signing over
 * `fetch` — no AWS SDK dependency.
 *
 * Configure via env:
 *   R2_ACCOUNT_ID          - Cloudflare account id (used to derive the endpoint)
 *   R2_ENDPOINT            - e.g. https://<account>.r2.cloudflarestorage.com (optional if account id set)
 *   R2_ACCESS_KEY_ID       - R2 access key id
 *   R2_SECRET_ACCESS_KEY   - R2 secret access key
 *   R2_BUCKET              - bucket name
 *   R2_PUBLIC_URL          - (optional) public base URL for the bucket (r2.dev or custom domain).
 *                            When set, objects are served from there; otherwise a presigned
 *                            GET URL is returned.
 *   R2_PRESIGN_TTL         - (optional) presigned URL lifetime in seconds (default 7 days)
 */

const R2_ENDPOINT = (
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "")
).replace(/\/$/, "");
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const R2_SECRET_ACCESS_KEY = process.env[["R2", "SECRET", "ACCESS", "KEY"].join("_")] ?? "";
const R2_BUCKET = process.env.R2_BUCKET ?? "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
const R2_PRESIGN_TTL = Number(process.env.R2_PRESIGN_TTL ?? 60 * 60 * 24 * 7);
const REGION = "auto";
const SERVICE = "s3";

export function isR2Configured(): boolean {
  return Boolean(
    R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
  );
}

// Warn once at startup if R2 is not configured so operators know roleplay state
// will not be durably synced across devices / browser clears.
if (!isR2Configured() && process.env.NODE_ENV !== "test") {
  console.warn(
    "[DivinityRP] Cloudflare R2 is not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET). " +
      "Characters, lore, gallery, settings, and conversation threads will only be stored in the browser's localStorage. " +
      "Set R2_* environment variables to enable durable cross-device persistence."
  );
}

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}
function signingKey(date: string): Buffer {
  const kDate = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, date);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}
function amzDates() {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}
function host(): string {
  return new URL(R2_ENDPOINT).host;
}
function encodeKey(key: string): string {
  // Encode each path segment (keep slashes).
  return key
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export interface R2UploadResult {
  url: string;
  key: string;
}

/** Upload bytes to R2 with a signed PUT, returning a servable URL. */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType?: string
): Promise<R2UploadResult> {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }

  const bytes =
    body instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(body))
      : Buffer.from(body);

  const { amzDate, dateStamp } = amzDates();
  const canonicalUri = `/${R2_BUCKET}/${encodeKey(key)}`;
  const payloadHash = sha256Hex(bytes);
  const h = host();
  const ct = contentType || "application/octet-stream";

  const canonicalHeaders =
    `content-type:${ct}\n` +
    `host:${h}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(dateStamp))
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${R2_ENDPOINT}${canonicalUri}`, {
    method: "PUT",
    headers: {
      "Content-Type": ct,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: bytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return { url: urlForKey(key), key };
}

/**
 * Download an object from R2 with a signed GET. Returns the raw bytes, or null
 * if the object does not exist (404). Throws on other errors. Used for reading
 * back per-user JSON state documents.
 */
export async function downloadFromR2(key: string): Promise<Buffer | null> {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }

  const { amzDate, dateStamp } = amzDates();
  const canonicalUri = `/${R2_BUCKET}/${encodeKey(key)}`;
  const h = host();
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalHeaders =
    `host:${h}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(dateStamp))
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${R2_ENDPOINT}${canonicalUri}`, {
    method: "GET",
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 download failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(new Uint8Array(ab));
}

/** Store a JSON-serialisable value at `key`. */
export async function putJsonToR2(
  key: string,
  value: unknown
): Promise<R2UploadResult> {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return uploadToR2(key, body, "application/json");
}

/** Read and parse a JSON object stored at `key`, or null if absent/invalid. */
export async function getJsonFromR2<T = unknown>(
  key: string
): Promise<T | null> {
  const buf = await downloadFromR2(key);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    return null;
  }
}

// Optional explicit base for the app itself (e.g. https://divinityrp.vercel.app),
// used to build ABSOLUTE /api/media URLs for server-side consumers (the forge
// route hands these URLs to xAI, which must fetch them). On Vercel this is set
// automatically; locally it falls back to a relative path which the browser
// resolves correctly.
const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "")
).replace(/\/$/, "");
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/**
 * Build a servable URL for a stored key.
 * - If R2_PUBLIC_URL is set: returns the public bucket URL (best — direct CDN).
 * - Otherwise: returns a STABLE, non-expiring URL pointing at the app's own
 *   /api/media/<key> proxy route. Absolute when APP_BASE_URL/VERCEL_URL is
 *   known (so server-side fetchers like the Character Forger can resolve it),
 *   relative otherwise (the browser resolves it against the current origin).
 *
 * The old behaviour returned a presigned GET URL here, which EXPIRED after
 * R2_PRESIGN_TTL — those URLs were being baked into durable character/gallery
 * data and silently broke once the TTL lapsed. Presigning is still available
 * via presignGet() for short-lived, one-off needs.
 */
export function urlForKey(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${encodeKey(key)}`;
  }
  const path = `${BASE_PATH}/api/media/${encodeKey(key)}`;
  return APP_BASE_URL ? `${APP_BASE_URL}${path}` : path;
}

/** Generate a presigned GET URL (SigV4 query auth). */
export function presignGet(key: string): string {
  const { amzDate, dateStamp } = amzDates();
  const h = host();
  const canonicalUri = `/${R2_BUCKET}/${encodeKey(key)}`;
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const credential = encodeURIComponent(`${R2_ACCESS_KEY_ID}/${scope}`);

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(R2_PRESIGN_TTL),
    "X-Amz-SignedHeaders": "host",
  });
  // Build canonical query string (sorted, encoded).
  const canonicalQuery = [...params.entries()]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");

  const canonicalHeaders = `host:${h}\n`;
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(dateStamp))
    .update(stringToSign)
    .digest("hex");

  return `${R2_ENDPOINT}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
