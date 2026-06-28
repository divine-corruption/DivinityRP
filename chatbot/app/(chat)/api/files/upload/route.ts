import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { join } from "path";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { isR2Configured, uploadToR2 } from "@/lib/storage/r2";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_BYTES, {
      message: "File size should be less than 50MB",
    })
    .refine((file) => ALLOWED_TYPES.includes(file.type), {
      message: "File type should be an image (JPEG/PNG/WebP/GIF) or video (MP4/WebM/OGG/MOV)",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  // Allow unauthenticated requests in dev mode (guest/dev bypass).
  if (!session && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();
    const contentType = (file as File).type || undefined;

    try {
      // Preferred: Cloudflare R2.
      if (isR2Configured()) {
        const key = `chat/${randomUUID()}-${safeName}`;
        const { url } = await uploadToR2(key, fileBuffer, contentType);
        return NextResponse.json({
          url,
          pathname: key,
          contentType: contentType ?? "application/octet-stream",
        });
      }

      // Fallback: Vercel Blob.
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const data = await put(`${safeName}`, fileBuffer, {
          access: "public",
        });
        return NextResponse.json(data);
      }

      // Local dev fallback: write to public/uploads.
      const ext = safeName.split(".").pop() ?? "bin";
      const localName = `${randomUUID()}.${ext}`;
      const filepath = join(process.cwd(), "public", "uploads", localName);
      await writeFile(filepath, Buffer.from(fileBuffer));

      const host = request.headers.get("host") ?? "localhost:3000";
      const protocol = host.startsWith("localhost") ? "http" : "https";
      const url = `${protocol}://${host}/uploads/${localName}`;

      return NextResponse.json({ url, pathname: localName, contentType: contentType ?? "application/octet-stream" });
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
