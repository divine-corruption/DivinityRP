/**
 * Shared JWT (HS256) verification + CORS helpers for DivinityRP workers.
 *
 * Tokens are minted by auth-worker and signed with a shared HMAC secret
 * (JWT_SECRET). We verify signature + expiry here using WebCrypto (available in
 * the Workers runtime) — no external dependency.
 */

export interface JwtPayload {
  sub: string; // user id
  email?: string;
  isAnonymous?: boolean;
  iat: number;
  exp: number;
  [k: string]: unknown;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToString(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

/**
 * Verify an HS256 JWT. Returns the decoded payload on success, or null if the
 * token is malformed, has a bad signature, or is expired.
 */
export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = b64urlToBytes(sigB64);
    const ok = await crypto.subtle.verify("HMAC", key, sig, data);
    if (!ok) return null;

    const payload = JSON.parse(
      bytesToString(b64urlToBytes(payloadB64))
    ) as JwtPayload;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Extract a bearer token from the Authorization header (or null). */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

/** Build CORS headers for the configured app origin. */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/** JSON response with CORS. */
export function json(
  body: unknown,
  status: number,
  origin: string,
  extra?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...(extra ?? {}),
    },
  });
}
