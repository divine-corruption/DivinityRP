import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { join } from "path";
import { isR2Configured, uploadToR2 } from "@/lib/storage/r2";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 10MB or smaller" },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type (use JPEG, PNG, WEBP or GIF)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const filename = `forge/${randomUUID()}.${ext}`;

    // Preferred: Cloudflare R2 object storage.
    if (isR2Configured()) {
      const { url } = await uploadToR2(
        filename,
        bytes,
        file.type || undefined
      );
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
    const filepath = join(process.cwd(), "public", "uploads", localName);
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
