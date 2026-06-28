import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { join } from "path";
import { isR2Configured, uploadToR2 } from "@/lib/storage/r2";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    // Optional: scope upload to a specific character
    const characterId = formData.get("characterId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (file.type && !isImage && !isVideo) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use JPEG, PNG, WEBP, GIF for images or MP4, WEBM, MOV, OGG for videos.",
        },
        { status: 400 }
      );
    }

    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: isVideo
            ? "Video must be 100MB or smaller"
            : "Image must be 10MB or smaller",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "png");

    // Build a storage path scoped to the character when possible
    const prefix = characterId
      ? `characters/${characterId}`
      : isVideo
      ? "gallery/videos"
      : "forge";
    const filename = `${prefix}/${randomUUID()}.${ext}`;

    // Preferred: Cloudflare R2 object storage.
    if (isR2Configured()) {
      const { url } = await uploadToR2(filename, bytes, file.type || undefined);
      return NextResponse.json({ url, filename });
    }

    // Fallback: Vercel Blob (Vercel's filesystem is read-only).
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const data = await put(filename, bytes, {
        access: "public",
        contentType: file.type || undefined,
      });
      return NextResponse.json({ url: data.url, filename: data.pathname });
    }

    // Local dev fallback: write to public/uploads and serve from there.
    const localName = `${randomUUID()}.${ext}`;
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filepath = join(uploadsDir, localName);
    await writeFile(filepath, Buffer.from(bytes));

    const host = request.headers.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/uploads/${localName}`;

    return NextResponse.json({ url, filename: localName });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to upload file: ${error.message}`
            : "Failed to upload file",
      },
      { status: 500 }
    );
  }
}
