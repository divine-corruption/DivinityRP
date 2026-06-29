/**
 * DivinityRP media-worker
 * ------------------------
 * Image / video upload + storage + serving, backed by Cloudflare R2.
 *
 * Endpoints (all CORS-enabled):
 *   POST   /upload            multipart form: file=<File>, [characterId], [source]
 *                             -> { url, key, contentType, characterId? }
 *   GET    /file/<key...>     stream an object back (used when PUBLIC_BASE_URL unset)
 *   DELETE /file/<key...>     delete an object (auth required)
 *   GET    /list?characterId= list objects for a character (auth required)
 *   GET    /health            { ok, bucketBound }
 *
 * Per-character scoping: when a characterId is supplied, objects are stored under
 *   characters/<characterId>/<uuid>.<ext>
 * so each character has its own media namespace. Gallery/forge uploads without a
 * character go under gallery/ or forge/ respectively.
 */

import { bearerToken, corsHeaders, json, verifyJwt } from "./shared";

export interface Env {
  MEDIA: R2Bucket;
  APP_ORIGIN: string;
  MAX_IMAGE_BYTES: string;
  MAX_VIDEO_BYTES: string;
  PUBLIC_BASE_URL: string;
  REQUIRE_AUTH: string;
  JWT_SECRET?: string;
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
];

function extFromName(name: string, fallback: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : fallback;
}

function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

/** Build the public URL for a stored key. */
function urlForKey(env: Env, req: Request, key: string): string {
  if (env.PUBLIC_BASE_URL) {
    return `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }
  // Serve through this worker.
  const origin = new URL(req.url).origin;
  return `${origin}/file/${key}`;
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

async function handleUpload(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";

  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart/form-data" }, 400, origin);
  }

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return json({ error: "No file provided" }, 400, origin);
  }
  const file = fileEntry as unknown as File;

  const characterId = (form.get("characterId") as string | null)?.trim() || null;
  const source = (form.get("source") as string | null)?.trim() || null;

  const type = file.type || "";
  const isImage = ALLOWED_IMAGE_TYPES.includes(type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(type);

  if (type && !isImage && !isVideo) {
    return json(
      {
        error:
          "Unsupported file type. Images: JPEG/PNG/WEBP/GIF/AVIF. Videos: MP4/WEBM/MOV/OGG.",
      },
      400,
      origin
    );
  }

  const maxBytes = isVideo
    ? Number(env.MAX_VIDEO_BYTES) || 100 * 1024 * 1024
    : Number(env.MAX_IMAGE_BYTES) || 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return json(
      {
        error: isVideo
          ? "Video must be 100MB or smaller"
          : "Image must be 10MB or smaller",
      },
      413,
      origin
    );
  }

  const ext = extFromName(file.name, isVideo ? "mp4" : "png");
  const uuid = crypto.randomUUID();

  let prefix: string;
  if (characterId) {
    prefix = `characters/${sanitizeSegment(characterId)}`;
  } else if (isVideo) {
    prefix = "gallery/videos";
  } else if (source === "forge") {
    prefix = "forge";
  } else {
    prefix = "gallery/images";
  }
  const key = `${prefix}/${uuid}.${ext}`;

  const bytes = await file.arrayBuffer();
  await env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: type || "application/octet-stream",
      // 1 year immutable cache — keys are content-unique (uuid).
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      ...(characterId ? { characterId } : {}),
      ...(source ? { source } : {}),
      uploadedBy: auth.userId,
      originalName: sanitizeSegment(file.name),
    },
  });

  return json(
    {
      url: urlForKey(env, req, key),
      key,
      filename: key,
      contentType: type || "application/octet-stream",
      type: isVideo ? "video" : "image",
      ...(characterId ? { characterId } : {}),
    },
    200,
    origin
  );
}

async function handleServe(req: Request, env: Env, key: string): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const obj = await env.MEDIA.get(key);
  if (!obj) return json({ error: "Not found" }, 404, origin);

  const headers = new Headers(corsHeaders(origin));
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  return new Response(obj.body, { headers });
}

async function handleDelete(req: Request, env: Env, key: string): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);
  await env.MEDIA.delete(key);
  return json({ ok: true, key }, 200, origin);
}

async function handleList(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";
  const auth = await requireAuth(req, env);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401, origin);

  const url = new URL(req.url);
  const characterId = url.searchParams.get("characterId");
  if (!characterId) {
    return json({ error: "characterId required" }, 400, origin);
  }
  const prefix = `characters/${sanitizeSegment(characterId)}/`;
  const listed = await env.MEDIA.list({ prefix, limit: 1000 });
  const items = listed.objects.map((o) => ({
    key: o.key,
    url: urlForKey(env, req, o.key),
    size: o.size,
    uploaded: o.uploaded,
    contentType: o.httpMetadata?.contentType,
    characterId: o.customMetadata?.characterId,
    source: o.customMetadata?.source,
  }));
  return json({ items, characterId }, 200, origin);
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
      return json({ ok: true, bucketBound: Boolean(env.MEDIA) }, 200, origin);
    }

    if (pathname === "/upload" && req.method === "POST") {
      return handleUpload(req, env);
    }

    if (pathname === "/list" && req.method === "GET") {
      return handleList(req, env);
    }

    if (pathname.startsWith("/file/")) {
      const key = decodeURIComponent(pathname.slice("/file/".length));
      if (!key) return json({ error: "key required" }, 400, origin);
      if (req.method === "GET") return handleServe(req, env, key);
      if (req.method === "DELETE") return handleDelete(req, env, key);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};
