import { NextResponse } from "next/server";
import { downloadFromR2, isR2Configured } from "@/lib/storage/r2";

/**
 * Stable media-serving route.
 *
 * Serves objects stored in Cloudflare R2 through the app itself at
 *   /api/media/<key>
 * so that stored image/video URLs (character avatars, gallery items, forge
 * reference images, generated images) are PERMANENT and never expire.
 *
 * This is what `urlForKey()` points at when R2_PUBLIC_URL is not configured,
 * replacing the old behaviour of baking time-limited presigned URLs into
 * durable character data (which silently broke images after the TTL elapsed).
 *
 * Range requests are not implemented here (R2 download is whole-object); for
 * large videos behind a CDN/custom domain, set R2_PUBLIC_URL instead so bytes
 * are served directly from the bucket's public endpoint.
 */

// Cache served media aggressively at the edge/browser. Object keys embed a
// random UUID per upload, so a given key is immutable.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
      return "video/ogg";
    case "mov":
      return "video/quicktime";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Media storage is not configured" },
      { status: 503 }
    );
  }

  const { key: segments } = await params;
  // Reassemble the object key and guard against path traversal.
  const key = (segments ?? []).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Invalid media key" }, { status: 400 });
  }

  try {
    const bytes = await downloadFromR2(key);
    if (!bytes) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Content-Length": String(bytes.length),
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error("Media serve error:", error);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 502 }
    );
  }
}
