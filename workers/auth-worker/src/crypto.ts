/**
 * Crypto helpers for auth-worker: HS256 JWT mint/verify + PBKDF2 password
 * hashing. All via WebCrypto (no node bcrypt — unavailable in Workers).
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- base64url --------------------------------------------------------------
function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function strToB64url(s: string): string {
  return bytesToB64url(enc.encode(s));
}

// ---- JWT (HS256) ------------------------------------------------------------
export interface JwtPayload {
  sub: string;
  email?: string;
  isAnonymous?: boolean;
  jti?: string;
  iat: number;
  exp: number;
  [k: string]: unknown;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp"> & { iat?: number; exp: number },
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = payload.iat ?? Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat };
  const headerB64 = strToB64url(JSON.stringify(header));
  const payloadB64 = strToB64url(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${bytesToB64url(new Uint8Array(sig))}`;
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sigB64),
      enc.encode(`${headerB64}.${payloadB64}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64urlToBytes(payloadB64))) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- PBKDF2 password hashing ------------------------------------------------
const PBKDF2_ITERATIONS = 210000; // OWASP-recommended floor for PBKDF2-SHA256

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    256
  );
  const hash = new Uint8Array(bits);
  return `${PBKDF2_ITERATIONS}:${bytesToB64url(salt)}:${bytesToB64url(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  try {
    const [iterStr, saltB64, hashB64] = stored.split(":");
    const iterations = Number(iterStr);
    if (!iterations || !saltB64 || !hashB64) return false;
    const salt = b64urlToBytes(saltB64);
    const expected = b64urlToBytes(hashB64);
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      baseKey,
      expected.length * 8
    );
    const actual = new Uint8Array(bits);
    // Constant-time comparison.
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
